import type { BufferHandle } from '../memory/types';
import type { BuiltPipeline } from '../pipelines/build';

/** Snapshotable viewport state. */
export interface ViewportValue {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly minDepth: number;
    readonly maxDepth: number;
}

/** Snapshotable scissor rect. */
export interface ScissorValue {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/** RGBA tuple normalised to a 4-number array for structural equality. */
export type BlendConstantValue = readonly [number, number, number, number];

/** Index-buffer binding snapshot. */
export interface IndexBufferState {
    readonly handle: BufferHandle;
    readonly format: GPUIndexFormat;
}

/**
 * Mutable running state. Owned by the encoder; reset at the start of every pass.
 *
 * ## Immutability invariant (load-bearing for `snapshot()`)
 *
 * Every object-valued field on this class — `pipeline`, `viewport`, `scissor`,
 * `blendConstant`, `indexBuffer`, and the values stored in `bindGroups` / `vertexBuffers` —
 * is treated as **immutable after assignment**. State transitions must always **replace**
 * the field with a freshly-constructed object (or a new bind-group / handle reference from
 * upstream caches); they must never mutate the currently-stored object in place.
 *
 * `snapshot()` captures references, not deep copies. The subtree-command cache in
 * `encoder.ts` compares snapshots via `activeStateSnapshotsEqual`, which relies on object
 * identity / structural equality of the referenced values. If a walk function ever mutated
 * an already-stored value (e.g. reused a scratch `ViewportValue` and wrote to its fields),
 * every previously-taken snapshot would silently drift — a cached subtree could hit as
 * equal while representing different pass state, producing wrong replays.
 *
 * Correspondingly, the encoder's walk helpers always build a fresh literal (`const desired:
 * ViewportValue = { x, y, … }`) and assign it. Keep it that way.
 */
export class ActiveState {
    pipeline: BuiltPipeline | undefined;
    /** Bind groups currently set on the pass, keyed by group index. */
    readonly bindGroups: Map<number, GPUBindGroup> = new Map();
    /** Vertex buffers currently set on the pass, keyed by buffer slot index. */
    readonly vertexBuffers: Map<number, BufferHandle> = new Map();
    indexBuffer: IndexBufferState | undefined;
    viewport: ViewportValue | undefined;
    scissor: ScissorValue | undefined;
    stencilRef: number | undefined;
    blendConstant: BlendConstantValue | undefined;

    reset(): void {
        this.pipeline = undefined;
        this.bindGroups.clear();
        this.vertexBuffers.clear();
        this.indexBuffer = undefined;
        this.viewport = undefined;
        this.scissor = undefined;
        this.stencilRef = undefined;
        this.blendConstant = undefined;
    }

    snapshotViewport(): ViewportValue | undefined {
        return this.viewport;
    }
    snapshotScissor(): ScissorValue | undefined {
        return this.scissor;
    }
    snapshotStencilRef(): number | undefined {
        return this.stencilRef;
    }
    snapshotBlendConstant(): BlendConstantValue | undefined {
        return this.blendConstant;
    }
    /** Snapshot which bind groups are currently set, so a scoped binding-override can restore. */
    snapshotBindGroups(groups: readonly number[]): Map<number, GPUBindGroup | undefined> {
        const out = new Map<number, GPUBindGroup | undefined>();
        for (const g of groups) out.set(g, this.bindGroups.get(g));
        return out;
    }

    /**
     * Capture a full snapshot of the current state. Used by the encoder's subtree-command cache
     * to record the state at subtree entry / exit so a later replay can verify entry-state
     * compatibility and restore exit state without re-walking.
     */
    snapshot(): ActiveStateSnapshot {
        return {
            pipeline: this.pipeline,
            bindGroups: new Map(this.bindGroups),
            vertexBuffers: new Map(this.vertexBuffers),
            indexBuffer: this.indexBuffer,
            viewport: this.viewport,
            scissor: this.scissor,
            stencilRef: this.stencilRef,
            blendConstant: this.blendConstant,
        };
    }

    /**
     * Overwrite this state with the contents of `snap`. Used by the subtree-command cache to
     * fast-forward `active` to a subtree's cached exit state after a replay.
     */
    restore(snap: ActiveStateSnapshot): void {
        this.pipeline = snap.pipeline;
        this.bindGroups.clear();
        for (const [k, v] of snap.bindGroups) this.bindGroups.set(k, v);
        this.vertexBuffers.clear();
        for (const [k, v] of snap.vertexBuffers) this.vertexBuffers.set(k, v);
        this.indexBuffer = snap.indexBuffer;
        this.viewport = snap.viewport;
        this.scissor = snap.scissor;
        this.stencilRef = snap.stencilRef;
        this.blendConstant = snap.blendConstant;
    }
}

/**
 * Frozen-shape snapshot of an `ActiveState`, produced by `ActiveState.snapshot()`. All maps
 * are independent copies (mutating the `ActiveState` after taking a snapshot leaves the
 * snapshot intact).
 */
export interface ActiveStateSnapshot {
    readonly pipeline: BuiltPipeline | undefined;
    readonly bindGroups: ReadonlyMap<number, GPUBindGroup>;
    readonly vertexBuffers: ReadonlyMap<number, BufferHandle>;
    readonly indexBuffer: IndexBufferState | undefined;
    readonly viewport: ViewportValue | undefined;
    readonly scissor: ScissorValue | undefined;
    readonly stencilRef: number | undefined;
    readonly blendConstant: BlendConstantValue | undefined;
}

/** Compare two index-buffer states for full equality. `undefined` vs `undefined` is true. */
export function indexBuffersEqual(
    a: IndexBufferState | undefined,
    b: IndexBufferState | undefined
): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    return (
        a.handle.gpu === b.handle.gpu &&
        a.handle.offset === b.handle.offset &&
        a.handle.size === b.handle.size &&
        a.format === b.format
    );
}

export function vertexHandlesEqual(a: BufferHandle | undefined, b: BufferHandle | undefined): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    return a.gpu === b.gpu && a.offset === b.offset && a.size === b.size;
}

export function viewportsEqual(a: ViewportValue | undefined, b: ViewportValue | undefined): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    return (
        a.x === b.x &&
        a.y === b.y &&
        a.width === b.width &&
        a.height === b.height &&
        a.minDepth === b.minDepth &&
        a.maxDepth === b.maxDepth
    );
}

export function scissorsEqual(a: ScissorValue | undefined, b: ScissorValue | undefined): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

export function blendConstantsEqual(
    a: BlendConstantValue | undefined,
    b: BlendConstantValue | undefined
): boolean {
    if (a === undefined && b === undefined) return true;
    if (a === undefined || b === undefined) return false;
    return a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];
}

/** Normalise a `GPUColorDict | readonly [r,g,b,a]` into the tuple form ActiveState stores. */
export function normalizeBlendConstant(
    color: GPUColorDict | readonly [number, number, number, number]
): BlendConstantValue {
    if (Array.isArray(color)) {
        const [r, g, b, a] = color as readonly [number, number, number, number];
        return [r, g, b, a];
    }
    const dict = color as GPUColorDict;
    return [dict.r, dict.g, dict.b, dict.a];
}

function bindGroupMapsEqual(
    a: ReadonlyMap<number, GPUBindGroup>,
    b: ReadonlyMap<number, GPUBindGroup>
): boolean {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
        if (b.get(k) !== v) return false;
    }
    return true;
}

function vertexBufferMapsEqual(
    a: ReadonlyMap<number, BufferHandle>,
    b: ReadonlyMap<number, BufferHandle>
): boolean {
    if (a.size !== b.size) return false;
    for (const [k, v] of a) {
        const other = b.get(k);
        if (!vertexHandlesEqual(v, other)) return false;
    }
    return true;
}

/**
 * Structural equality across every field an `ActiveStateSnapshot` carries. The subtree-command
 * cache uses this to check whether the current running state matches a cached entry state — a
 * mismatch means the cached commands were recorded under different assumptions and cannot be
 * safely replayed (they might, for example, omit a `setPipeline` the current caller needs).
 *
 * Field semantics: `pipeline` by reference (the per-context pipeline cache guarantees one
 * `BuiltPipeline` instance per fingerprint); `bindGroups` by cached `GPUBindGroup` identity;
 * `vertexBuffers` / `indexBuffer` by `(handle.gpu, offset, size[, format])` so two slices of one
 * slab buffer compare unequal; state-node values structurally.
 */
export function activeStateSnapshotsEqual(
    a: ActiveStateSnapshot,
    b: ActiveStateSnapshot
): boolean {
    if (a === b) return true;
    // Pipelines compared by reference — the per-context pipeline cache guarantees one
    // `BuiltPipeline` instance per fingerprint, so `===` is the tightest sound predicate.
    if (a.pipeline !== b.pipeline) return false;
    if (!indexBuffersEqual(a.indexBuffer, b.indexBuffer)) return false;
    if (!viewportsEqual(a.viewport, b.viewport)) return false;
    if (!scissorsEqual(a.scissor, b.scissor)) return false;
    if (a.stencilRef !== b.stencilRef) return false;
    if (!blendConstantsEqual(a.blendConstant, b.blendConstant)) return false;
    if (!bindGroupMapsEqual(a.bindGroups, b.bindGroups)) return false;
    if (!vertexBufferMapsEqual(a.vertexBuffers, b.vertexBuffers)) return false;
    return true;
}
