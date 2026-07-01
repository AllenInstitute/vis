/**
 * `GraphEncoder` — Phase 7 of the WebGPU rendering refactor.
 *
 * Walks a `Scene` against a recording `GPURenderPassEncoder`, emitting state-deduplicated
 * draw commands. State elision is driven by an `ActiveState` instance maintained for the
 * lifetime of the pass.
 *
 * ## Subtree-command caching (Phase 7.1)
 *
 * Every composite node (`container` / `viewport` / `scissor` / `stencilref` / `blendconstant`
 * / `override`) is a candidate for command-list caching. The cache is keyed by `NodeId` and
 * lives on the encoder (one cache per `Scene`, held in a `WeakMap<Scene, ...>` so scene GC
 * naturally drops entries). Each entry records the sequence of `PassCommand`s the walk
 * emitted for that subtree plus the running `ActiveState` snapshots at subtree entry and
 * exit.
 *
 * On each `encode(scene)` walk of a composite node:
 *   - **Cache hit** (node id absent from `scene.dirty` AND we have a cached entry AND the
 *     current `ActiveState` structurally matches the cached entry snapshot) → replay the
 *     cached commands into the pass encoder, then fast-forward `ActiveState` from the cached
 *     exit snapshot. Skips `buildBindGroupsForDraw`, `walk`-function dispatch, and every
 *     per-slot equality check inside the subtree.
 *   - **Cache miss / dirty / entry-state mismatch** → walk the subtree the normal way but tee
 *     every emitted command into a fresh `Recorder`; on subtree exit, cache the recorded
 *     commands + entry/exit snapshots. Nested composites each start their own recorder so
 *     inner subtrees are independently replayable; commands from an inner replay ARE also
 *     appended to any active outer recorder so the outer cache is complete.
 *
 * Cache invalidation is a combination of two mechanisms:
 *   1. Consulting `scene.dirty` at each composite: caller mutations (`add` / `remove` /
 *      `replace` / `markDirty`) already propagate dirty up to the root, so a subtree is
 *      re-recorded whenever anything below it changed.
 *   2. Subscribing to `scene.on('structure-changed', ...)` on first sight of a scene: on
 *      `remove` / `replace` we drop the affected node ids from the cache. This prevents
 *      unbounded growth for scenes that churn subtrees.
 *
 * v1 simplifications (documented for follow-up work):
 *   - **Pipeline-layout compatibility** for `setPipeline`-induced bind-group invalidation is
 *     treated as "identity = compatible". When `setPipeline` swaps pipelines, we conservatively
 *     drop every `ActiveState.bindGroups` entry so the encoder re-emits `setBindGroup` for
 *     every slot the new pipeline needs. A future refinement can compare
 *     `pipeline.layout` / `pipeline.bindGroupLayouts` and elide bind groups where layouts match.
 *
 * State-node semantics (scoped):
 *   - On entry to `ViewportNode` / `ScissorNode` / `StencilRefNode` / `BlendConstantNode`:
 *     snapshot the corresponding `ActiveState` field, apply the node's value (emitting the
 *     setter only if it differs from current).
 *   - On exit: if the snapshotted value differs from what's currently active, emit the
 *     restoration setter (or — if the snapshot is `undefined` — leave the state as-is; WebGPU
 *     has no "unset" verb, but the very-first-frame snapshot of `undefined` is moot because
 *     nothing reads it past the pass boundary).
 *   - `BindingOverrideNode`: pushes its overrides onto a stack consulted by the bind-group
 *     builder; on exit, pops them. The bind groups bound under the override are tagged in the
 *     cache key, so the executor naturally re-binds the original groups on exit when it
 *     encounters the next draw whose cache key differs.
 */

import { v4 as uuidv4 } from 'uuid';
import type { BufferHandle } from '../memory/types';
import type { Resource } from '../data/resource';
import type { Drawable } from '../drawable';
import type {
    BindingOverrideNode,
    BlendConstantNode,
    DrawableNode,
    NodeId,
    RenderTarget,
    Scene,
    SceneEvent,
    SceneNode,
    ScissorNode,
    StencilRefNode,
    ViewportNode,
} from '../scene/types';
import type { ResourceSlot } from '../resources/resource';
import type { RenderingContext } from '../context-types';
import {
    type BindGroupCacheStore,
    buildBindGroupsForDraw,
} from './bind-group-builder';
import { applyPassCommand, type PassCommand } from './pass-commands';
import {
    ActiveState,
    type ActiveStateSnapshot,
    type BlendConstantValue,
    type ScissorValue,
    type ViewportValue,
    activeStateSnapshotsEqual,
    blendConstantsEqual,
    indexBuffersEqual,
    normalizeBlendConstant,
    scissorsEqual,
    vertexHandlesEqual,
    viewportsEqual,
} from './state';

/** Public stats emitted by `encoder.lastStats()` after a `submit(scene)`. */
export interface EncoderStats {
    /** Number of `passEncoder.setPipeline` calls emitted. */
    readonly setPipelineCalls: number;
    /** Number of `passEncoder.setBindGroup` calls emitted. */
    readonly setBindGroupCalls: number;
    /** Number of `passEncoder.setVertexBuffer` calls emitted. */
    readonly setVertexBufferCalls: number;
    /** Number of `passEncoder.setIndexBuffer` calls emitted. */
    readonly setIndexBufferCalls: number;
    /** Number of `passEncoder.draw` + `drawIndexed` calls emitted (i.e. drawables visited). */
    readonly drawCalls: number;
    /** Number of `passEncoder.setViewport` calls emitted (entry + restore combined). */
    readonly setViewportCalls: number;
    /** Number of `passEncoder.setScissorRect` calls emitted. */
    readonly setScissorCalls: number;
    /** Number of `passEncoder.setStencilReference` calls emitted. */
    readonly setStencilRefCalls: number;
    /** Number of `passEncoder.setBlendConstant` calls emitted. */
    readonly setBlendConstantCalls: number;
    /** Number of composite subtrees replayed from the subtree-command cache this frame. */
    readonly subtreeCacheHits: number;
    /** Number of composite subtrees walked (and re-recorded into the cache) this frame. */
    readonly subtreeCacheMisses: number;
}

const ZERO_STATS: EncoderStats = Object.freeze({
    setPipelineCalls: 0,
    setBindGroupCalls: 0,
    setVertexBufferCalls: 0,
    setIndexBufferCalls: 0,
    drawCalls: 0,
    setViewportCalls: 0,
    setScissorCalls: 0,
    setStencilRefCalls: 0,
    setBlendConstantCalls: 0,
    subtreeCacheHits: 0,
    subtreeCacheMisses: 0,
});

/** Brand symbol used by `isGraphEncoder` to discriminate encoder objects at runtime. */
export const GRAPH_ENCODER_BRAND: unique symbol = Symbol.for('vis-core.webgpu.GraphEncoder');

/** The persistent encoder — bound to a single `RenderingContext`, reusable across frames. */
export interface GraphEncoder {
    readonly __brand: typeof GRAPH_ENCODER_BRAND;
    readonly id: string;
    /** Encode + submit `scene` to the device queue. */
    submit(scene: Scene): GPUCommandBuffer;
    /** Encode `scene` and return the finished command buffer (no queue submit). */
    encode(scene: Scene): GPUCommandBuffer;
    /** Stats from the most recent `submit` / `encode` call (zeroed before each). */
    lastStats(): EncoderStats;
    /**
     * Drop every cached subtree recording for every scene the encoder has seen. Called from
     * `RenderingContext.dispose()`. Callers rarely need to invoke this directly; the encoder
     * evicts stale entries automatically on scene structure changes.
     */
    clearSubtreeCache(): void;
    /** Number of cached subtree entries across every scene the encoder has seen. Testing hook. */
    subtreeCacheSize(): number;
}

/** Construct a `GraphEncoder`. Internal — call `ctx.encoder()` instead.
 *
 * `cacheStore` is passed separately because the `GPUBindGroup` cache is a private field of the
 * context (not part of the public `RenderingContext` interface); the context threads its own
 * store in when it calls this factory. */
export function makeGraphEncoder(
    rc: RenderingContext,
    cacheStore: BindGroupCacheStore
): GraphEncoder {
    const id = uuidv4();
    let stats: EncoderStats = ZERO_STATS;
    // Per-scene subtree cache. Boxed so `clearSubtreeCache()` can reassign — WeakMap has no
    // `clear` and can't be iterated, so wholesale invalidation requires a fresh instance.
    // Scene GC drops entries automatically via the WeakMap.
    const perSceneBox: { map: WeakMap<Scene, PerSceneCache> } = { map: new WeakMap() };
    // Parallel Set of every subscription unsubscribe fn so `clearSubtreeCache()` can eagerly
    // detach from every scene we've hooked. Not a leak: unsubscribe closures hold a ref to
    // the scene's internal listener array only — they do not keep the scene alive on their
    // own once every other reference is dropped.
    const activeSubscriptions: Set<() => void> = new Set();
    // Tracks how many entries exist across all seen scenes.
    let totalCacheEntries = 0;

    const ensureSceneCache = (scene: Scene): PerSceneCache => {
        let entry = perSceneBox.map.get(scene);
        if (entry !== undefined) return entry;
        const cache: Map<NodeId, CachedSubtree> = new Map();
        const listener = (ev: SceneEvent): void => {
            if (ev.type !== 'structure-changed') return;
            // Evict the primary node id; on 'remove' also evict every descendant id the event
            // carries (Scene populates `removedNodeIds` for `remove` and any composite→composite
            // replace that dropped children).
            if (cache.delete(ev.nodeId)) totalCacheEntries -= 1;
            if (ev.removedNodeIds !== undefined) {
                for (const rid of ev.removedNodeIds) {
                    if (cache.delete(rid)) totalCacheEntries -= 1;
                }
            }
        };
        const off = scene.on('structure-changed', listener);
        activeSubscriptions.add(off);
        entry = { cache, off };
        perSceneBox.map.set(scene, entry);
        return entry;
    };

    const submit = (scene: Scene): GPUCommandBuffer => {
        const cb = encode(scene);
        rc.device.queue.submit([cb]);
        return cb;
    };

    const encode = (scene: Scene): GPUCommandBuffer => {
        const sceneCache = ensureSceneCache(scene);
        const commandEncoder = rc.device.createCommandEncoder({
            label: `${rc.label ?? 'ctx'}.encoder`,
        });
        const passDesc = makeBeginPassDescriptor(scene.target);
        const pass = commandEncoder.beginRenderPass(passDesc);

        const ctx: WalkContext = {
            pass,
            active: new ActiveState(),
            overrideStack: [],
            counters: mkCounters(),
            recorders: [],
            sceneCache: sceneCache.cache,
            sceneDirty: scene.dirty,
            rc,
            bindGroupCache: cacheStore,
            cacheEntryDelta: 0,
        };

        walk(scene.root, ctx);

        pass.end();
        scene.clearDirty();
        totalCacheEntries += ctx.cacheEntryDelta;
        stats = freezeStats(ctx.counters);
        return commandEncoder.finish();
    };

    const lastStats = (): EncoderStats => stats;

    const clearSubtreeCache = (): void => {
        for (const off of activeSubscriptions) off();
        activeSubscriptions.clear();
        perSceneBox.map = new WeakMap();
        totalCacheEntries = 0;
    };

    const subtreeCacheSize = (): number => totalCacheEntries;

    return Object.freeze({
        __brand: GRAPH_ENCODER_BRAND,
        id,
        submit,
        encode,
        lastStats,
        clearSubtreeCache,
        subtreeCacheSize,
    });
}

export function isGraphEncoder(value: unknown): value is GraphEncoder {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __brand?: unknown }).__brand === GRAPH_ENCODER_BRAND
    );
}

// ---- internals --------------------------------------------------------------------------------

/** Per-scene bookkeeping stored in the encoder's `WeakMap<Scene, ...>`. */
interface PerSceneCache {
    readonly cache: Map<NodeId, CachedSubtree>;
    readonly off: () => void;
}

/** Cache entry for a single composite node's subtree. */
interface CachedSubtree {
    /** Running state at the moment the walk entered this subtree. A later replay is only
     *  safe if the encoder's current state structurally matches this snapshot. */
    readonly entryState: ActiveStateSnapshot;
    /** Running state at the moment the walk exited this subtree. Applied to `ActiveState`
     *  after a successful replay so subsequent siblings see the correct state. */
    readonly exitState: ActiveStateSnapshot;
    /** The recorded pass commands, in the order the walk emitted them. */
    readonly commands: readonly PassCommand[];
    /** Snapshot (by reference) of the override maps on the stack at record time. If the
     *  current override stack differs — compared by map object identity, per index — we must
     *  re-record: the recorded bind groups were resolved under a different override context and
     *  may reference the wrong resources. Override maps are immutable-per-node (`Scene.replace`
     *  produces a new map), so identity comparison is exact. */
    readonly overrideStack: readonly ReadonlyMap<ResourceSlot, Resource>[];
}

/**
 * A single command-list recording in progress. The recorder stack in `WalkContext` lets a
 * re-recording ancestor capture the commands emitted by nested re-records and nested replays
 * alike, so the outer cache entry is a complete self-contained sequence.
 */
interface Recorder {
    readonly nodeId: NodeId;
    readonly entryState: ActiveStateSnapshot;
    readonly overrideStack: readonly ReadonlyMap<ResourceSlot, Resource>[];
    readonly commands: PassCommand[];
}

interface WalkContext {
    readonly pass: GPURenderPassEncoder;
    readonly active: ActiveState;
    readonly overrideStack: ReadonlyMap<ResourceSlot, Resource>[];
    readonly counters: Counters;
    readonly recorders: Recorder[];
    readonly sceneCache: Map<NodeId, CachedSubtree>;
    readonly sceneDirty: ReadonlySet<NodeId>;
    readonly rc: RenderingContext;
    readonly bindGroupCache: BindGroupCacheStore;
    /** Net add/remove count of cache entries this walk applied. Reconciled into the
     *  encoder's running total at end of encode. */
    cacheEntryDelta: number;
}

interface Counters {
    setPipelineCalls: number;
    setBindGroupCalls: number;
    setVertexBufferCalls: number;
    setIndexBufferCalls: number;
    drawCalls: number;
    setViewportCalls: number;
    setScissorCalls: number;
    setStencilRefCalls: number;
    setBlendConstantCalls: number;
    subtreeCacheHits: number;
    subtreeCacheMisses: number;
}

function mkCounters(): Counters {
    return {
        setPipelineCalls: 0,
        setBindGroupCalls: 0,
        setVertexBufferCalls: 0,
        setIndexBufferCalls: 0,
        drawCalls: 0,
        setViewportCalls: 0,
        setScissorCalls: 0,
        setStencilRefCalls: 0,
        setBlendConstantCalls: 0,
        subtreeCacheHits: 0,
        subtreeCacheMisses: 0,
    };
}

function freezeStats(c: Counters): EncoderStats {
    return Object.freeze({ ...c });
}

function makeBeginPassDescriptor(target: RenderTarget): GPURenderPassDescriptor {
    const desc: GPURenderPassDescriptor = {
        colorAttachments: [...target.color],
        ...(target.depthStencil !== undefined && { depthStencilAttachment: target.depthStencil }),
        ...(target.label !== undefined && { label: target.label }),
    };
    return desc;
}

/**
 * Emit `cmd`: apply to the real pass encoder, tee to every active recorder in the stack, and
 * increment the corresponding counter. Every state change / draw the encoder produces must
 * go through this helper so recording, counting, and replaying stay perfectly consistent.
 */
function emit(cmd: PassCommand, ctx: WalkContext): void {
    applyPassCommand(ctx.pass, cmd);
    for (const r of ctx.recorders) r.commands.push(cmd);
    incrementCounter(cmd, ctx.counters);
}

function incrementCounter(cmd: PassCommand, c: Counters): void {
    switch (cmd.kind) {
        case 'setPipeline':
            c.setPipelineCalls += 1;
            return;
        case 'setBindGroup':
            c.setBindGroupCalls += 1;
            return;
        case 'setVertexBuffer':
            c.setVertexBufferCalls += 1;
            return;
        case 'setIndexBuffer':
            c.setIndexBufferCalls += 1;
            return;
        case 'setViewport':
            c.setViewportCalls += 1;
            return;
        case 'setScissorRect':
            c.setScissorCalls += 1;
            return;
        case 'setStencilReference':
            c.setStencilRefCalls += 1;
            return;
        case 'setBlendConstant':
            c.setBlendConstantCalls += 1;
            return;
        case 'draw':
        case 'drawIndexed':
            c.drawCalls += 1;
            return;
    }
}

/**
 * Whether two override stacks match. Compared by override-map object identity, per index —
 * the override maps are `ReadonlyMap` and treated as immutable per-node (callers who want to
 * change overrides use `Scene.replace`, which produces a new node object and a new map), so
 * identity comparison is exact. Stacks are shallow (one entry per nested `override` on the
 * path), so the per-index scan is cheaper than building and comparing a serialized key.
 */
function overrideStacksEqual(
    a: readonly ReadonlyMap<ResourceSlot, Resource>[],
    b: readonly ReadonlyMap<ResourceSlot, Resource>[]
): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Attempt to serve `node` from the subtree cache; if not possible, walk it and record a
 * fresh entry. Composite nodes only — draw leaves are handled by `walkDraw` directly.
 */
function walkComposite(node: SceneNode, ctx: WalkContext, walkChildren: () => void): void {
    const cached = ctx.sceneCache.get(node.id);
    const dirty = ctx.sceneDirty.has(node.id);
    const currentEntry = ctx.active.snapshot();

    if (
        !dirty &&
        cached !== undefined &&
        overrideStacksEqual(ctx.overrideStack, cached.overrideStack) &&
        activeStateSnapshotsEqual(currentEntry, cached.entryState)
    ) {
        // Cache hit — replay commands directly.
        for (const cmd of cached.commands) {
            applyPassCommand(ctx.pass, cmd);
            // Tee into every outer recorder so their cache entries stay complete.
            for (const r of ctx.recorders) r.commands.push(cmd);
            incrementCounter(cmd, ctx.counters);
        }
        ctx.active.restore(cached.exitState);
        ctx.counters.subtreeCacheHits += 1;
        return;
    }

    // Cache miss / dirty / mismatch — record a fresh entry. Snapshot the override stack by
    // reference (the live `ctx.overrideStack` is mutated via push/pop as the walk descends).
    const recorder: Recorder = {
        nodeId: node.id,
        entryState: currentEntry,
        overrideStack: [...ctx.overrideStack],
        commands: [],
    };
    ctx.recorders.push(recorder);
    walkChildren();
    ctx.recorders.pop();
    const exitState = ctx.active.snapshot();
    const isNew = !ctx.sceneCache.has(node.id);
    ctx.sceneCache.set(node.id, {
        entryState: recorder.entryState,
        exitState,
        commands: recorder.commands,
        overrideStack: recorder.overrideStack,
    });
    if (isNew) ctx.cacheEntryDelta += 1;
    ctx.counters.subtreeCacheMisses += 1;
}

function walk(node: SceneNode, ctx: WalkContext): void {
    switch (node.kind) {
        case 'container':
            walkComposite(node, ctx, () => {
                for (const c of node.children) walk(c, ctx);
            });
            return;
        case 'viewport':
            walkComposite(node, ctx, () => walkViewport(node, ctx));
            return;
        case 'scissor':
            walkComposite(node, ctx, () => walkScissor(node, ctx));
            return;
        case 'stencilref':
            walkComposite(node, ctx, () => walkStencilRef(node, ctx));
            return;
        case 'blendconstant':
            walkComposite(node, ctx, () => walkBlendConstant(node, ctx));
            return;
        case 'override':
            walkComposite(node, ctx, () => walkOverride(node, ctx));
            return;
        case 'draw':
            walkDraw(node, ctx);
            return;
    }
}

function walkViewport(node: ViewportNode, ctx: WalkContext): void {
    const prior = ctx.active.snapshotViewport();
    const desired: ViewportValue = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
        minDepth: node.minDepth,
        maxDepth: node.maxDepth,
    };
    if (!viewportsEqual(prior, desired)) {
        emit(
            {
                kind: 'setViewport',
                x: desired.x,
                y: desired.y,
                width: desired.width,
                height: desired.height,
                minDepth: desired.minDepth,
                maxDepth: desired.maxDepth,
            },
            ctx
        );
        ctx.active.viewport = desired;
    }
    for (const c of node.children) walk(c, ctx);
    if (!viewportsEqual(prior, ctx.active.viewport)) {
        if (prior !== undefined) {
            emit(
                {
                    kind: 'setViewport',
                    x: prior.x,
                    y: prior.y,
                    width: prior.width,
                    height: prior.height,
                    minDepth: prior.minDepth,
                    maxDepth: prior.maxDepth,
                },
                ctx
            );
        }
        ctx.active.viewport = prior;
    }
}

function walkScissor(node: ScissorNode, ctx: WalkContext): void {
    const prior = ctx.active.snapshotScissor();
    const desired: ScissorValue = {
        x: node.x,
        y: node.y,
        width: node.width,
        height: node.height,
    };
    if (!scissorsEqual(prior, desired)) {
        emit(
            {
                kind: 'setScissorRect',
                x: desired.x,
                y: desired.y,
                width: desired.width,
                height: desired.height,
            },
            ctx
        );
        ctx.active.scissor = desired;
    }
    for (const c of node.children) walk(c, ctx);
    if (!scissorsEqual(prior, ctx.active.scissor)) {
        if (prior !== undefined) {
            emit(
                {
                    kind: 'setScissorRect',
                    x: prior.x,
                    y: prior.y,
                    width: prior.width,
                    height: prior.height,
                },
                ctx
            );
        }
        ctx.active.scissor = prior;
    }
}

function walkStencilRef(node: StencilRefNode, ctx: WalkContext): void {
    const prior = ctx.active.snapshotStencilRef();
    if (prior !== node.value) {
        emit({ kind: 'setStencilReference', value: node.value }, ctx);
        ctx.active.stencilRef = node.value;
    }
    for (const c of node.children) walk(c, ctx);
    if (ctx.active.stencilRef !== prior) {
        if (prior !== undefined) {
            emit({ kind: 'setStencilReference', value: prior }, ctx);
        }
        ctx.active.stencilRef = prior;
    }
}

function walkBlendConstant(node: BlendConstantNode, ctx: WalkContext): void {
    const prior = ctx.active.snapshotBlendConstant();
    const desired: BlendConstantValue = normalizeBlendConstant(node.color);
    if (!blendConstantsEqual(prior, desired)) {
        emit(
            {
                kind: 'setBlendConstant',
                color: { r: desired[0], g: desired[1], b: desired[2], a: desired[3] },
            },
            ctx
        );
        ctx.active.blendConstant = desired;
    }
    for (const c of node.children) walk(c, ctx);
    if (!blendConstantsEqual(prior, ctx.active.blendConstant)) {
        if (prior !== undefined) {
            emit(
                {
                    kind: 'setBlendConstant',
                    color: { r: prior[0], g: prior[1], b: prior[2], a: prior[3] },
                },
                ctx
            );
        }
        ctx.active.blendConstant = prior;
    }
}

function walkOverride(node: BindingOverrideNode, ctx: WalkContext): void {
    ctx.overrideStack.push(node.overrides);
    for (const c of node.children) walk(c, ctx);
    ctx.overrideStack.pop();
    // No explicit "restore" of bind groups needed: the next draw past the override will
    // produce a different cache key (no override tag) and naturally rebind the unwrapped
    // groups. We DO need to flush bind-group state so the next draw's elision logic re-emits.
    ctx.active.bindGroups.clear();
}

function walkDraw(node: DrawableNode, ctx: WalkContext): void {
    emitDraw(node.drawable, ctx);
}

function emitDraw(drawable: Drawable, ctx: WalkContext): void {
    // ---- setPipeline (with bind-group invalidation on swap) ----
    // Reference equality is sound: `RenderingContext.pipeline()` caches by fingerprint, so a
    // given fingerprint yields exactly one `BuiltPipeline` instance per context.
    if (ctx.active.pipeline !== drawable.pipeline) {
        emit({ kind: 'setPipeline', pipeline: drawable.pipeline.gpu }, ctx);
        ctx.active.pipeline = drawable.pipeline;
        // Conservative: clear bind-group state since layout compatibility checks are not yet
        // implemented. The encoder will re-emit setBindGroup below for the new pipeline.
        ctx.active.bindGroups.clear();
    }

    // ---- setBindGroup ----
    const resolved = buildBindGroupsForDraw({
        device: ctx.rc.device,
        pipeline: drawable.pipeline,
        drawable,
        overrideStack: ctx.overrideStack,
        store: ctx.bindGroupCache,
    });
    for (const [groupIdx, bg] of resolved.groups) {
        if (ctx.active.bindGroups.get(groupIdx) !== bg) {
            emit({ kind: 'setBindGroup', index: groupIdx, bindGroup: bg }, ctx);
            ctx.active.bindGroups.set(groupIdx, bg);
        }
    }

    // ---- setVertexBuffer ----
    for (const [slot, binding] of drawable.vertexBuffers) {
        const handle = bufferHandleOf(binding.resource);
        if (handle === undefined) continue;
        if (!vertexHandlesEqual(ctx.active.vertexBuffers.get(slot), handle)) {
            emit(
                {
                    kind: 'setVertexBuffer',
                    slot,
                    buffer: handle.gpu,
                    offset: handle.offset,
                    size: handle.size,
                },
                ctx
            );
            ctx.active.vertexBuffers.set(slot, handle);
        }
    }

    // ---- setIndexBuffer ----
    if (drawable.indexBuffer !== undefined) {
        const handle = bufferHandleOf(drawable.indexBuffer.resource);
        if (handle !== undefined) {
            const desired = { handle, format: drawable.indexBuffer.format };
            if (!indexBuffersEqual(ctx.active.indexBuffer, desired)) {
                emit(
                    {
                        kind: 'setIndexBuffer',
                        buffer: handle.gpu,
                        format: desired.format,
                        offset: handle.offset,
                        size: handle.size,
                    },
                    ctx
                );
                ctx.active.indexBuffer = desired;
            }
        }
    }

    // ---- draw / drawIndexed ----
    const draw = drawable.draw;
    if (draw.kind === 'array') {
        emit(
            {
                kind: 'draw',
                vertexCount: draw.vertexCount,
                instanceCount: draw.instanceCount ?? 1,
                firstVertex: draw.firstVertex ?? 0,
                firstInstance: draw.firstInstance ?? 0,
            },
            ctx
        );
    } else {
        emit(
            {
                kind: 'drawIndexed',
                indexCount: draw.indexCount,
                instanceCount: draw.instanceCount ?? 1,
                firstIndex: draw.firstIndex ?? 0,
                baseVertex: draw.baseVertex ?? 0,
                firstInstance: draw.firstInstance ?? 0,
            },
            ctx
        );
    }
}

function bufferHandleOf(resource: Resource): BufferHandle | undefined {
    if (resource.kind === 'uniform' || resource.kind === 'storage' || resource.kind === 'rawBuffer') {
        return (resource as { handle: BufferHandle }).handle;
    }
    return undefined;
}
