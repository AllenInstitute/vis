/**
 * `Drawable` — a `BuiltPipeline` + its concrete vertex / index / binding `Resource`s + a
 * `DrawCall`. The atomic unit emitted by Phase 6 `Scene`'s `draw(...)` leaves and rendered by
 * the Phase 7 `Encoder`.
 *
 * Construction funnels through `RenderingContext.drawable(spec)`; this module exports the
 * public types (`Drawable`, `DrawCall`, `DrawableSpec`, …) and the internal `buildDrawable`
 * helper invoked by the context.
 *
 * **Lifecycle**: every `Drawable` is constructed with `refcount === 1` on each of the
 * resources it owns. The drawable always calls `share()` on a caller-supplied pre-built
 * `Resource`, so the caller retains its own refcount independently of the drawable's. When
 * `drawable.destroy()` runs it decrefs every owned resource exactly once — pre-built ones
 * fall back to the caller's refcount, freshly-created ones (the raw-arrays path) drop to 0
 * and release their `BufferHandle`s.
 *
 * **Slab-readiness**: every vertex / index allocation goes through `bufferManager.acquire`
 * (the raw-arrays path) — `device.createBuffer` is never called from this module. Uploads
 * use `queue.writeBuffer(handle.gpu, handle.offset, data)` so a future `SlabBufferManager`
 * is a drop-in replacement.
 */

import { v4 as uuidv4 } from 'uuid';
import { createBufferLayoutsFromArrays } from 'webgpu-utils';
import type { Arrays, ArraysOptions } from 'webgpu-utils';
import type { BufferManager } from './memory/types';
import {
    type BufferResource,
    type RawBufferResource,
    type Resource,
    isResource,
    makeRawBufferResource,
} from './data/resource';
import type { BuiltPipeline } from './pipelines/build';
import type { ResourceSlot } from './resources/resource';

// ---- Brand & identity -------------------------------------------------------------------------

/** Brand symbol used by `isDrawable` to discriminate `Drawable` objects at runtime. */
export const DRAWABLE_BRAND: unique symbol = Symbol.for('vis-core.webgpu.Drawable');

// ---- DrawCall ---------------------------------------------------------------------------------

/** Non-indexed draw — corresponds to `passEncoder.draw(...)`. */
export interface ArrayDrawCall {
    readonly kind: 'array';
    readonly vertexCount: number;
    readonly instanceCount?: number;
    readonly firstVertex?: number;
    readonly firstInstance?: number;
}

/** Indexed draw — corresponds to `passEncoder.drawIndexed(...)`. */
export interface IndexedDrawCall {
    readonly kind: 'indexed';
    readonly indexCount: number;
    readonly instanceCount?: number;
    readonly firstIndex?: number;
    readonly baseVertex?: number;
    readonly firstInstance?: number;
}

/** Discriminated union of every draw-call variant. `kind: 'indexed'` requires an
 *  `indexBuffer` on the owning `Drawable`. */
export type DrawCall = ArrayDrawCall | IndexedDrawCall;

// ---- Drawable interfaces ----------------------------------------------------------------------

/** Bound vertex buffer for a single slot (matches `pipeline.vertex.buffers[slot]`). Carries the
 *  refcounted resource plus the layout the buffer was allocated against. */
export interface VertexBufferBinding {
    /** Refcount-managed wrapper around the underlying `BufferHandle`. */
    readonly resource: BufferResource<unknown> | RawBufferResource;
}

/** Bound index buffer for a `Drawable`. */
export interface IndexBufferBinding {
    readonly resource: BufferResource<unknown> | RawBufferResource;
    readonly format: GPUIndexFormat;
}

/** The atomic, ready-to-encode draw unit. Frozen at construction. */
export interface Drawable {
    /** Stable per-instance id (UUID). */
    readonly id: string;
    /** Optional debug label. Threaded through error messages. */
    readonly label?: string;
    /** Brand for `isDrawable`. */
    readonly __brand: typeof DRAWABLE_BRAND;
    /** The pipeline this drawable will render with. */
    readonly pipeline: BuiltPipeline;
    /** Vertex buffers keyed by the **buffer slot index** (i.e. the index into
     *  `pipeline.state.vertex.buffers`), NOT a shader location. Each entry's
     *  resource carries a `BufferHandle` that the encoder feeds into
     *  `setVertexBuffer(slot, gpu, offset, size)`. */
    readonly vertexBuffers: ReadonlyMap<number, VertexBufferBinding>;
    /** Optional index buffer + format. Required when `draw.kind === 'indexed'`. */
    readonly indexBuffer?: IndexBufferBinding;
    /** Resource per `ResourceSlot` in `pipeline.slotIndex`. Every required slot must be
     *  present; missing or kind-mismatched entries cause `ctx.drawable()` to throw. */
    readonly bindings: ReadonlyMap<ResourceSlot, Resource>;
    /** The draw-call descriptor consumed by the encoder. */
    readonly draw: DrawCall;
    /** Decrement the refcount on every owned resource. Idempotent — second call is a no-op. */
    destroy(): void;
    /** Construct a sibling `Drawable` sharing this one's vertex / index buffers (and any
     *  unspecified bindings) but using a new pipeline and/or binding overrides. Useful for
     *  multi-pipeline patterns (e.g. one geometry rendered with both a colour-pass and a
     *  picking-pass pipeline). */
    reuse(spec: DrawableReuseSpec): Drawable;
}

/** Runtime discriminator for `Drawable`. */
export function isDrawable(value: unknown): value is Drawable {
    return (
        typeof value === 'object' &&
        value !== null &&
        '__brand' in value &&
        (value as { __brand: unknown }).__brand === DRAWABLE_BRAND
    );
}

// ---- Spec / Input shapes ----------------------------------------------------------------------

/** Map<bufferSlot, pre-built BufferResource | RawBufferResource>. The keys are slot indices
 *  into `pipeline.state.vertex.buffers`; values are refcounted buffer wrappers. The drawable
 *  calls `share()` on each so the caller's refcount is preserved. */
export type PreBuiltVertexInput = ReadonlyMap<
    number,
    BufferResource<unknown> | RawBufferResource
>;

/**
 * Raw-arrays vertex input. The drawable runs `webgpu-utils.createBufferLayoutsFromArrays` on
 * `arrays` to derive interleaved byte layouts (NOT to create GPU buffers — the buffer
 * manager owns all GPU buffer creation), then allocates exactly one buffer per layout via
 * `ctx.bufferManager.acquire` and uploads the interleaved bytes via `queue.writeBuffer`.
 *
 * Requires `ctx.bufferManager` to have been supplied at context construction.
 */
export interface RawArraysVertexInput {
    readonly kind: 'arrays';
    /** Named arrays consumed by `webgpu-utils.createBufferLayoutsFromArrays`. */
    readonly arrays: Arrays;
    /** Optional pass-through for stepMode / interleave / shaderLocation defaults. */
    readonly options?: ArraysOptions;
    /** Optional override for the per-layout buffer slot index. Defaults to the layout's index
     *  in the returned `bufferLayouts` array (i.e. `[0, 1, 2, …]`). */
    readonly bufferSlots?: readonly number[];
}

/** Union of every accepted vertex input shape for `ctx.drawable({...})`. */
export type VertexInput = PreBuiltVertexInput | RawArraysVertexInput;

/** Pre-built index input — caller has already allocated a buffer and wrapped it. */
export interface PreBuiltIndexInput {
    readonly resource: BufferResource<unknown> | RawBufferResource;
    readonly format: GPUIndexFormat;
}

/** Raw-array index input — the drawable allocates + uploads through `ctx.bufferManager`. */
export interface RawArrayIndexInput {
    readonly kind: 'arrays';
    /** Index data. `Uint16Array` ⇒ `format: 'uint16'`; `Uint32Array` ⇒ `'uint32'`. Plain
     *  `number[]` defaults to `uint32`. */
    readonly data: Uint16Array | Uint32Array | readonly number[];
    /** Override the auto-detected index format. */
    readonly format?: GPUIndexFormat;
}

/** Union of every accepted index input shape for `ctx.drawable({...})`. */
export type IndexInput = PreBuiltIndexInput | RawArrayIndexInput;

/** Spec passed to `ctx.drawable({...})`. */
export interface DrawableSpec {
    /** The pipeline this drawable will render with. Must come from the same `RenderingContext`
     *  (or one targeting the same `GPUDevice`). */
    readonly pipeline: BuiltPipeline;
    /** Vertex input — either a pre-built `Map<bufferSlot, BufferResource>` or a raw-arrays
     *  descriptor that allocates through `ctx.bufferManager`. */
    readonly vertex: VertexInput;
    /** Optional index input. Required when `draw.kind === 'indexed'`. */
    readonly index?: IndexInput;
    /** Bindings keyed by `ResourceSlot.name` (matching slots declared in `pipeline.slotIndex`)
     *  or directly by `ResourceSlot`. Every slot in `pipeline.slotIndex` must be present;
     *  resource kinds are validated against slot kinds. The drawable calls `share()` on each
     *  supplied resource. */
    readonly bindings: Record<string, Resource> | ReadonlyMap<ResourceSlot, Resource>;
    /** The draw-call descriptor. */
    readonly draw: DrawCall;
    /** Optional debug label. */
    readonly label?: string;
}

/** Spec passed to `drawable.reuse({...})`. */
export interface DrawableReuseSpec {
    /** Optional replacement pipeline. Defaults to `this.pipeline`. The new pipeline must be
     *  compatible with the existing vertex / index buffers (their byte layouts are not
     *  re-validated — caller is responsible for picking a compatible pipeline). */
    readonly pipeline?: BuiltPipeline;
    /** Bindings to override. Slots not present in `bindings` inherit from `this.bindings`
     *  (and are `share()`'d into the new drawable). */
    readonly bindings?: Record<string, Resource> | ReadonlyMap<ResourceSlot, Resource>;
    /** Optional replacement draw-call. Defaults to `this.draw`. */
    readonly draw?: DrawCall;
    /** Optional debug label for the new drawable. */
    readonly label?: string;
}

// ---- Internal builder -------------------------------------------------------------------------

/** Subset of `RenderingContext` needed by `buildDrawable`. Avoids a circular import. */
export interface DrawableBuildContext {
    readonly device: GPUDevice;
    readonly bufferManager?: BufferManager;
    readonly label?: string;
}

/**
 * Build a `Drawable` from a `DrawableSpec`. Internal — call sites use `ctx.drawable(spec)`,
 * which validates the spec, then forwards to this builder.
 *
 * Steps:
 *   1. Resolve vertex input → `Map<bufferSlot, VertexBufferBinding>` (sharing pre-built
 *      resources, or allocating + uploading via `ctx.bufferManager` for the raw-arrays path).
 *   2. Resolve index input similarly. Validate `draw.kind === 'indexed' ⇔ indexBuffer !== undefined`.
 *   3. Resolve bindings against `pipeline.slotIndex` (matching by slot, or by `slot.name` for
 *      record-shaped inputs). Validate every required slot is present and `resource.kind`
 *      matches `slot.kind`. Call `share()` on every supplied resource.
 *   4. Assemble a frozen `Drawable`, wiring `destroy()` to decref every owned resource and
 *      `reuse()` to produce a sibling drawable that re-shares the geometry.
 */
export function buildDrawable(ctx: DrawableBuildContext, spec: DrawableSpec): Drawable {
    // ---- Vertex buffers ---------------------------------------------------
    const vertexBuffers = resolveVertexInput(ctx, spec.vertex, spec.label ?? spec.pipeline.id);

    // ---- Index buffer (optional) ------------------------------------------
    const indexBuffer =
        spec.index !== undefined
            ? resolveIndexInput(ctx, spec.index, spec.label ?? spec.pipeline.id)
            : undefined;

    if (spec.draw.kind === 'indexed' && indexBuffer === undefined) {
        // Tear down anything we've already shared before throwing.
        for (const b of vertexBuffers.values()) b.resource.destroy();
        throw new Error(
            `ctx.drawable${spec.label !== undefined ? ` '${spec.label}'` : ''}: draw.kind === 'indexed' ` +
                'requires an `index` input on the spec.'
        );
    }

    // ---- Bindings ---------------------------------------------------------
    let bindings: Map<ResourceSlot, Resource>;
    try {
        bindings = resolveBindings(spec.pipeline, spec.bindings, spec.label);
    } catch (err) {
        // Tear down everything we've shared so far before bubbling out.
        for (const b of vertexBuffers.values()) b.resource.destroy();
        indexBuffer?.resource.destroy();
        throw err;
    }

    // ---- Build the frozen Drawable ----------------------------------------
    return makeFrozenDrawable(
        ctx,
        {
            pipeline: spec.pipeline,
            draw: spec.draw,
            ...(spec.label !== undefined && { label: spec.label }),
        },
        vertexBuffers,
        indexBuffer,
        bindings
    );
}

// ---- Helpers ----------------------------------------------------------------------------------

function makeFrozenDrawable(
    ctx: DrawableBuildContext,
    args: {
        readonly pipeline: BuiltPipeline;
        readonly draw: DrawCall;
        readonly label?: string;
    },
    vertexBuffers: Map<number, VertexBufferBinding>,
    indexBuffer: IndexBufferBinding | undefined,
    bindings: Map<ResourceSlot, Resource>
): Drawable {
    let disposed = false;

    const drawable: Drawable = {
        __brand: DRAWABLE_BRAND,
        id: uuidv4(),
        ...(args.label !== undefined && { label: args.label }),
        pipeline: args.pipeline,
        vertexBuffers,
        ...(indexBuffer !== undefined && { indexBuffer }),
        bindings,
        draw: args.draw,
        destroy(): void {
            if (disposed) return;
            disposed = true;
            for (const b of vertexBuffers.values()) b.resource.destroy();
            indexBuffer?.resource.destroy();
            for (const r of bindings.values()) r.destroy();
        },
        reuse(reuseSpec: DrawableReuseSpec): Drawable {
            if (disposed) {
                throw new Error(
                    `Drawable${args.label !== undefined ? ` '${args.label}'` : ''}: reuse() after destroy().`
                );
            }
            const newPipeline = reuseSpec.pipeline ?? args.pipeline;
            const newDraw = reuseSpec.draw ?? args.draw;
            const newLabel = reuseSpec.label;

            // 1. Build new bindings: start from the override map (validated against the new
            //    pipeline), then fill in any unspecified slots from `this.bindings` (matched
            //    by slot identity). Every retained resource is `share()`'d.
            const overrideMap = reuseSpec.bindings;
            const merged = mergeBindingsForReuse(newPipeline, bindings, overrideMap, newLabel);

            // 2. Share vertex / index buffers — produce a sibling map keyed on the same
            //    bufferSlots. NOTE: `vertexBuffers` slot indices must still be valid for the
            //    new pipeline; we don't re-derive layouts from arrays here.
            const sharedVertex = new Map<number, VertexBufferBinding>();
            for (const [slot, binding] of vertexBuffers) {
                sharedVertex.set(slot, { resource: binding.resource.share() });
            }
            const sharedIndex: IndexBufferBinding | undefined =
                indexBuffer !== undefined
                    ? { resource: indexBuffer.resource.share(), format: indexBuffer.format }
                    : undefined;

            return makeFrozenDrawable(
                ctx,
                {
                    pipeline: newPipeline,
                    draw: newDraw,
                    ...(newLabel !== undefined && { label: newLabel }),
                },
                sharedVertex,
                sharedIndex,
                merged
            );
        },
    };

    return Object.freeze(drawable);
}

/** Decide whether the user-supplied `vertex` arg is the pre-built shape (a `Map`). */
function isPreBuiltVertex(v: VertexInput): v is PreBuiltVertexInput {
    return v instanceof Map;
}

/** Decide whether the user-supplied `index` arg is the pre-built shape. */
function isPreBuiltIndex(i: IndexInput): i is PreBuiltIndexInput {
    // `RawArrayIndexInput` carries a `kind: 'arrays'` literal; pre-built carries a `resource`
    // (which is brand-checkable).
    return 'resource' in i && isResource(i.resource);
}

function resolveVertexInput(
    ctx: DrawableBuildContext,
    input: VertexInput,
    labelForErrors: string
): Map<number, VertexBufferBinding> {
    const out = new Map<number, VertexBufferBinding>();

    if (isPreBuiltVertex(input)) {
        for (const [bufferSlot, resource] of input) {
            assertBufferLikeUsage(resource, GPUBufferUsage.VERTEX, 'vertex', labelForErrors);
            out.set(bufferSlot, { resource: resource.share() as typeof resource });
        }
        return out;
    }

    // Raw-arrays path.
    const bm = ctx.bufferManager;
    if (bm === undefined) {
        throw new Error(
            `ctx.drawable '${labelForErrors}': raw-arrays vertex input requires a bufferManager; ` +
                'pass one to renderingContext({ device, bufferManager }).'
        );
    }

    // `createBufferLayoutsFromArrays` returns the **layouts only** and the corresponding typed
    // arrays. We never call `createBuffersAndAttributesFromArrays` because that creates GPU
    // buffers — the buffer manager owns all GPU buffer creation in this architecture.
    const { bufferLayouts, typedArrays } = createBufferLayoutsFromArrays(
        input.arrays,
        input.options
    );

    for (let i = 0; i < bufferLayouts.length; i++) {
        const layout = bufferLayouts[i];
        const ta = typedArrays[i];
        if (layout === undefined || ta === undefined) continue;
        const data = ta.data;
        const byteLength = data.byteLength;
        const usage = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
        const handle = bm.acquire(byteLength, usage);
        // Always include `handle.offset` so a future slab manager works transparently.
        ctx.device.queue.writeBuffer(handle.gpu, handle.offset, data);
        const slotIndex = input.bufferSlots?.[i] ?? i;
        const resource = makeRawBufferResource(
            handle,
            usage,
            `${labelForErrors}.vertex[${slotIndex}]`
        );
        out.set(slotIndex, { resource });
    }

    return out;
}

function resolveIndexInput(
    ctx: DrawableBuildContext,
    input: IndexInput,
    labelForErrors: string
): IndexBufferBinding {
    if (isPreBuiltIndex(input)) {
        assertBufferLikeUsage(input.resource, GPUBufferUsage.INDEX, 'index', labelForErrors);
        return {
            resource: input.resource.share() as typeof input.resource,
            format: input.format,
        };
    }

    const bm = ctx.bufferManager;
    if (bm === undefined) {
        throw new Error(
            `ctx.drawable '${labelForErrors}': raw-arrays index input requires a bufferManager; ` +
                'pass one to renderingContext({ device, bufferManager }).'
        );
    }

    const { typedArray, format } = normalizeIndexArray(input);
    const usage = GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST;
    const handle = bm.acquire(typedArray.byteLength, usage);
    // Cast through `BufferSource` — the WebGPU types model `writeBuffer`'s data param as
    // `GPUAllowSharedBufferSource`, which the union `Uint16Array | Uint32Array` does not
    // narrow to cleanly without a non-shared `<ArrayBuffer>` annotation.
    ctx.device.queue.writeBuffer(
        handle.gpu,
        handle.offset,
        typedArray as unknown as BufferSource
    );
    const resource = makeRawBufferResource(handle, usage, `${labelForErrors}.index`);
    return { resource, format };
}

function normalizeIndexArray(input: RawArrayIndexInput): {
    typedArray: Uint16Array | Uint32Array;
    format: GPUIndexFormat;
} {
    if (input.data instanceof Uint16Array) {
        return { typedArray: input.data, format: input.format ?? 'uint16' };
    }
    if (input.data instanceof Uint32Array) {
        return { typedArray: input.data, format: input.format ?? 'uint32' };
    }
    // Plain array → default to uint32 unless explicitly overridden to uint16.
    const fmt: GPUIndexFormat = input.format ?? 'uint32';
    const typedArray =
        fmt === 'uint16' ? new Uint16Array(input.data) : new Uint32Array(input.data);
    return { typedArray, format: fmt };
}

function resolveBindings(
    pipeline: BuiltPipeline,
    input: DrawableSpec['bindings'],
    label: string | undefined
): Map<ResourceSlot, Resource> {
    const out = new Map<ResourceSlot, Resource>();
    const inputIsMap = input instanceof Map;
    // Track which input entries got consumed — we can warn (via throw) if extras are supplied.
    const consumedKeys = new Set<unknown>();

    for (const slot of pipeline.slotIndex.keys()) {
        let resource: Resource | undefined;
        if (inputIsMap) {
            resource = input.get(slot);
            if (resource !== undefined) consumedKeys.add(slot);
        } else {
            const rec = input as Record<string, Resource>;
            resource = rec[slot.name];
            if (resource !== undefined) consumedKeys.add(slot.name);
        }
        if (resource === undefined) {
            throw new Error(
                `ctx.drawable${label !== undefined ? ` '${label}'` : ''}: missing binding for ` +
                    `slot '${slot.name}' (kind '${slot.kind}') required by pipeline ${pipeline.id}.`
            );
        }
        if (!isResource(resource)) {
            throw new Error(
                `ctx.drawable${label !== undefined ? ` '${label}'` : ''}: binding for slot '${slot.name}' ` +
                    'is not a Resource (did you forget to call `ctx.resource(slot, …)`?).'
            );
        }
        // Buffer-like slot kinds tolerate either a slot-bound `BufferResource` or a
        // `RawBufferResource`; texture / sampler / external kinds must match exactly.
        if (resource.kind === 'rawBuffer') {
            if (slot.kind !== 'uniform' && slot.kind !== 'storage') {
                throw new Error(
                    `ctx.drawable${label !== undefined ? ` '${label}'` : ''}: binding for slot '${slot.name}' ` +
                        `(kind '${slot.kind}') cannot be a RawBufferResource (only uniform/storage slots accept raw buffers).`
                );
            }
        } else if (resource.kind !== slot.kind) {
            throw new Error(
                `ctx.drawable${label !== undefined ? ` '${label}'` : ''}: binding kind mismatch for slot ` +
                    `'${slot.name}' — pipeline expects '${slot.kind}' but resource is '${resource.kind}'.`
            );
        }
        out.set(slot, resource.share());
    }

    // Detect stray entries supplied for slots the pipeline doesn't declare. (Map case only —
    // record-shaped inputs may carry extras through other-shader bindings.)
    if (inputIsMap) {
        for (const k of input.keys()) {
            if (!consumedKeys.has(k)) {
                // Decref everything we already shared before throwing.
                for (const r of out.values()) r.destroy();
                throw new Error(
                    `ctx.drawable${label !== undefined ? ` '${label}'` : ''}: bindings entry for slot ` +
                        `'${k.name}' is not referenced by pipeline ${pipeline.id}.`
                );
            }
        }
    }
    return out;
}

function mergeBindingsForReuse(
    newPipeline: BuiltPipeline,
    base: ReadonlyMap<ResourceSlot, Resource>,
    overrides: DrawableSpec['bindings'] | undefined,
    label: string | undefined
): Map<ResourceSlot, Resource> {
    const out = new Map<ResourceSlot, Resource>();
    const overridesMap = overrides instanceof Map ? overrides : undefined;
    const overridesRecord =
        overrides !== undefined && !(overrides instanceof Map)
            ? (overrides as Record<string, Resource>)
            : undefined;

    for (const slot of newPipeline.slotIndex.keys()) {
        let candidate: Resource | undefined;
        if (overridesMap !== undefined) candidate = overridesMap.get(slot);
        if (candidate === undefined && overridesRecord !== undefined)
            candidate = overridesRecord[slot.name];
        if (candidate === undefined) candidate = base.get(slot);
        if (candidate === undefined) {
            // Decref whatever we've already shared before throwing.
            for (const r of out.values()) r.destroy();
            throw new Error(
                `Drawable.reuse${label !== undefined ? ` '${label}'` : ''}: missing binding for slot ` +
                    `'${slot.name}' required by pipeline ${newPipeline.id}.`
            );
        }
        if (candidate.kind === 'rawBuffer') {
            if (slot.kind !== 'uniform' && slot.kind !== 'storage') {
                for (const r of out.values()) r.destroy();
                throw new Error(
                    `Drawable.reuse${label !== undefined ? ` '${label}'` : ''}: binding for slot '${slot.name}' ` +
                        `(kind '${slot.kind}') cannot be a RawBufferResource.`
                );
            }
        } else if (candidate.kind !== slot.kind) {
            for (const r of out.values()) r.destroy();
            throw new Error(
                `Drawable.reuse${label !== undefined ? ` '${label}'` : ''}: binding kind mismatch for slot ` +
                    `'${slot.name}' — pipeline expects '${slot.kind}' but resource is '${candidate.kind}'.`
            );
        }
        out.set(slot, candidate.share());
    }
    return out;
}

/** Ensure a buffer-like resource's `usage` mask carries the required bit (VERTEX / INDEX). */
function assertBufferLikeUsage(
    resource: BufferResource<unknown> | RawBufferResource,
    requiredBit: GPUBufferUsageFlags,
    role: 'vertex' | 'index',
    labelForErrors: string
): void {
    if ((resource.usage & requiredBit) !== requiredBit) {
        const roleName = role === 'vertex' ? 'GPUBufferUsage.VERTEX' : 'GPUBufferUsage.INDEX';
        throw new Error(
            `ctx.drawable '${labelForErrors}': ${role} buffer resource was allocated without ` +
                `${roleName} in its usage mask (got 0x${resource.usage.toString(16)}).`
        );
    }
}
