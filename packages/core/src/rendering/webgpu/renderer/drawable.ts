import { v4 as uuidv4 } from 'uuid';
import type { Arrays, ArraysOptions } from 'webgpu-utils';
import { createBufferLayoutsFromArrays } from 'webgpu-utils';
import { isBranded } from '../foundation';
import type { ResourceSlot } from '../resources';
import {
    asManaged,
    type BufferResource,
    isResource,
    makeRawBufferResource,
    type RawBufferResource,
    type Resource,
} from '../resources';
import type { RenderingContext } from './context-types';
import type { BuiltPipeline } from './pipelines/build';
import {
    interleaveVertexBuffer,
    type VertexAttrData,
    type VertexLayoutDeclaration,
} from './pipelines/vertex-layout';

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
 *  buffer resource the encoder feeds into `setVertexBuffer`. */
export interface VertexBufferBinding {
    /** Buffer resource wrapping the underlying `BufferHandle`. */
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
    /** Construct a sibling `Drawable` sharing this one's vertex / index buffers (and any
     *  unspecified bindings) but using a new pipeline and/or binding overrides. Useful for
     *  multi-pipeline patterns (e.g. one geometry rendered with both a colour-pass and a
     *  picking-pass pipeline). The sibling is owned by the same context. */
    reuse(spec: DrawableReuseSpec): Drawable;
}

/** Runtime discriminator for `Drawable`. */
export function isDrawable(value: unknown): value is Drawable {
    return isBranded(value, DRAWABLE_BRAND);
}

/** A `Drawable` plus its internal teardown method. Lifetime is driven inside the renderer
 *  (context on dispose, scene on removal); the public `Drawable` type hides `destroy()`. */
export type ManagedDrawable = Drawable & { destroy(): void };

/** Reinterpret a public `Drawable` as its `ManagedDrawable` runtime shape. */
export function asManagedDrawable(drawable: Drawable): ManagedDrawable {
    return drawable as ManagedDrawable;
}

// ---- Spec / Input shapes ----------------------------------------------------------------------

/** Map<bufferSlot, pre-built BufferResource | RawBufferResource>. The keys are slot indices
 *  into `pipeline.state.vertex.buffers`; the drawable takes its own reference to each. */
export type PreBuiltVertexData = ReadonlyMap<
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
export interface RawArraysVertexData {
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
export type VertexData = PreBuiltVertexData | RawArraysVertexData | TypedVertexData;

/**
 * Declaration-driven typed vertex input. Uses a `vertexLayout(...)` as the single source of truth
 * for byte packing: `data` supplies each attribute's flat host array (keyed by attribute name),
 * which is interleaved per the derived offsets/stride, allocated through `ctx.bufferManager`, and
 * uploaded via `queue.writeBuffer`. One buffer is produced per entry in the layout.
 *
 * For `float16` attributes supply raw half-float bits; for normalized (`unorm*`/`snorm*`) formats
 * supply pre-encoded integers — floats are not auto-quantized.
 */
export interface TypedVertexData {
    readonly kind: 'typed';
    /** The layout declaration whose buffers/attributes drive packing. */
    readonly layout: VertexLayoutDeclaration;
    /** Per-attribute host data, keyed by attribute name. */
    readonly data: Readonly<Record<string, VertexAttrData>>;
    /** Optional override for the per-buffer slot index. Defaults to the buffer's index. */
    readonly bufferSlots?: readonly number[];
}

/** Pre-built index input — caller has already allocated a buffer and wrapped it. */
export interface PreBuiltIndexData {
    readonly resource: BufferResource<unknown> | RawBufferResource;
    readonly format: GPUIndexFormat;
}

/** Raw-array index input — the drawable allocates + uploads through `ctx.bufferManager`. */
export interface RawArrayIndexData {
    readonly kind: 'arrays';
    /** Index data. `Uint16Array` ⇒ `format: 'uint16'`; `Uint32Array` ⇒ `'uint32'`. Plain
     *  `number[]` defaults to `uint32`. */
    readonly data: Uint16Array | Uint32Array | readonly number[];
    /** Override the auto-detected index format. */
    readonly format?: GPUIndexFormat;
}

/** Union of every accepted index input shape for `ctx.drawable({...})`. */
export type IndexData = PreBuiltIndexData | RawArrayIndexData;

/** Spec passed to `ctx.drawable({...})`. */
export interface DrawableSpec {
    /** The pipeline this drawable will render with. Must come from the same `RenderingContext`
     *  (or one targeting the same `GPUDevice`). */
    readonly pipeline: BuiltPipeline;
    /** Vertex input — either a pre-built `Map<bufferSlot, BufferResource>` or a raw-arrays
     *  descriptor that allocates through `ctx.bufferManager`. */
    readonly vertex: VertexData;
    /** Optional index input. Required when `draw.kind === 'indexed'`. */
    readonly index?: IndexData;
    /** Bindings keyed by `ResourceSlot.name` (matching slots declared in `pipeline.slotIndex`)
     *  or directly by `ResourceSlot`. Every slot in `pipeline.slotIndex` must be present;
     *  resource kinds are validated against slot kinds. */
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
     *  (and are shared into the new drawable). */
    readonly bindings?: Record<string, Resource> | ReadonlyMap<ResourceSlot, Resource>;
    /** Optional replacement draw-call. Defaults to `this.draw`. */
    readonly draw?: DrawCall;
    /** Optional debug label for the new drawable. */
    readonly label?: string;
}

// ---- Internal builder -------------------------------------------------------------------------

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
 *      matches `slot.kind`. Take a reference to every supplied resource.
 *   4. Assemble a frozen `Drawable`, wiring `destroy()` to release every owned resource and
 *      `reuse()` to produce a sibling drawable that re-shares the geometry.
 */
export function buildDrawable(
    ctx: RenderingContext,
    spec: DrawableSpec,
    track: (drawable: ManagedDrawable) => void
): ManagedDrawable {
    // ---- Vertex buffers ---------------------------------------------------
    const vertexBuffers = resolveVertexData(
        ctx,
        spec.vertex,
        spec.label ?? spec.pipeline.fingerprint
    );

    // ---- Index buffer (optional) ------------------------------------------
    const indexBuffer =
        spec.index !== undefined
            ? resolveIndexData(ctx, spec.index, spec.label ?? spec.pipeline.fingerprint)
            : undefined;

    if (spec.draw.kind === 'indexed' && indexBuffer === undefined) {
        // Tear down anything we've already shared before throwing.
        for (const b of vertexBuffers.values()) asManaged(b.resource).destroy();
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
        for (const b of vertexBuffers.values()) asManaged(b.resource).destroy();
        if (indexBuffer !== undefined) asManaged(indexBuffer.resource).destroy();
        throw err;
    }

    // ---- Build the frozen Drawable ----------------------------------------
    return makeFrozenDrawable(
        ctx,
        track,
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
    ctx: RenderingContext,
    track: (drawable: ManagedDrawable) => void,
    args: {
        readonly pipeline: BuiltPipeline;
        readonly draw: DrawCall;
        readonly label?: string;
    },
    vertexBuffers: Map<number, VertexBufferBinding>,
    indexBuffer: IndexBufferBinding | undefined,
    bindings: Map<ResourceSlot, Resource>
): ManagedDrawable {
    let disposed = false;

    const drawable: ManagedDrawable = {
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
            for (const b of vertexBuffers.values()) asManaged(b.resource).destroy();
            if (indexBuffer !== undefined) asManaged(indexBuffer.resource).destroy();
            for (const r of bindings.values()) asManaged(r).destroy();
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
                sharedVertex.set(slot, { resource: asManaged(binding.resource).share() });
            }
            const sharedIndex: IndexBufferBinding | undefined =
                indexBuffer !== undefined
                    ? { resource: asManaged(indexBuffer.resource).share(), format: indexBuffer.format }
                    : undefined;

            return makeFrozenDrawable(
                ctx,
                track,
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

    const frozen = Object.freeze(drawable);
    track(frozen);
    return frozen;
}

/** Decide whether the user-supplied `vertex` arg is the pre-built shape (a `Map`). */
function isPreBuiltVertex(v: VertexData): v is PreBuiltVertexData {
    return v instanceof Map;
}

/** Decide whether the user-supplied `index` arg is the pre-built shape. */
function isPreBuiltIndex(i: IndexData): i is PreBuiltIndexData {
    // `RawArrayIndexData` carries a `kind: 'arrays'` literal; pre-built carries a `resource`
    // (which is brand-checkable).
    return 'resource' in i && isResource(i.resource);
}

function resolveVertexData(
    ctx: RenderingContext,
    input: VertexData,
    labelForErrors: string
): Map<number, VertexBufferBinding> {
    const out = new Map<number, VertexBufferBinding>();

    if (isPreBuiltVertex(input)) {
        for (const [bufferSlot, resource] of input) {
            assertBufferLikeUsage(resource, GPUBufferUsage.VERTEX, 'vertex', labelForErrors);
            out.set(bufferSlot, { resource: asManaged(resource).share() });
        }
        return out;
    }

    if (input.kind === 'typed') {
        return resolveTypedVertexData(ctx, input, labelForErrors);
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
        if (!bm.precheck(byteLength)) {
            throw new Error(
                `ctx.drawable '${labelForErrors}': buffer-manager precheck refused ${byteLength} B ` +
                    `for vertex buffer slot ${input.bufferSlots?.[i] ?? i}. The request exceeds the ` +
                    'current memory budget.'
            );
        }
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

/** Resolve the declaration-driven typed vertex input: interleave each buffer's attribute data
 *  per its derived layout, allocate through the buffer manager, and upload. */
function resolveTypedVertexData(
    ctx: RenderingContext,
    input: TypedVertexData,
    labelForErrors: string
): Map<number, VertexBufferBinding> {
    const bm = ctx.bufferManager;
    if (bm === undefined) {
        throw new Error(
            `ctx.drawable '${labelForErrors}': typed vertex input requires a bufferManager; ` +
                'pass one to renderingContext({ device, bufferManager }).'
        );
    }

    const out = new Map<number, VertexBufferBinding>();
    input.layout.buffers.forEach((buffer, i) => {
        const bytes = interleaveVertexBuffer(buffer, input.data);
        const usage = GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST;
        const slotIndex = input.bufferSlots?.[i] ?? i;
        if (!bm.precheck(bytes.byteLength)) {
            throw new Error(
                `ctx.drawable '${labelForErrors}': buffer-manager precheck refused ${bytes.byteLength} B ` +
                    `for vertex buffer slot ${slotIndex}. The request exceeds the current memory budget.`
            );
        }
        const handle = bm.acquire(bytes.byteLength, usage);
        ctx.device.queue.writeBuffer(handle.gpu, handle.offset, bytes);
        const resource = makeRawBufferResource(handle, usage, `${labelForErrors}.vertex[${slotIndex}]`);
        out.set(slotIndex, { resource });
    });

    return out;
}

function resolveIndexData(
    ctx: RenderingContext,
    input: IndexData,
    labelForErrors: string
): IndexBufferBinding {
    if (isPreBuiltIndex(input)) {
        assertBufferLikeUsage(input.resource, GPUBufferUsage.INDEX, 'index', labelForErrors);
        return {
            resource: asManaged(input.resource).share(),
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
    if (!bm.precheck(typedArray.byteLength)) {
        throw new Error(
            `ctx.drawable '${labelForErrors}': buffer-manager precheck refused ${typedArray.byteLength} B ` +
                'for index buffer. The request exceeds the current memory budget.'
        );
    }
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

function normalizeIndexArray(input: RawArrayIndexData): {
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
                    `slot '${slot.name}' (kind '${slot.kind}') required by pipeline ${pipeline.fingerprint}.`
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
        out.set(slot, asManaged(resource).share());
    }

    // Detect stray entries supplied for slots the pipeline doesn't declare. (Map case only —
    // record-shaped inputs may carry extras through other-shader bindings.)
    if (inputIsMap) {
        for (const k of input.keys()) {
            if (!consumedKeys.has(k)) {
                // Decref everything we already shared before throwing.
                for (const r of out.values()) asManaged(r).destroy();
                throw new Error(
                    `ctx.drawable${label !== undefined ? ` '${label}'` : ''}: bindings entry for slot ` +
                        `'${k.name}' is not referenced by pipeline ${pipeline.fingerprint}.`
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
            for (const r of out.values()) asManaged(r).destroy();
            throw new Error(
                `Drawable.reuse${label !== undefined ? ` '${label}'` : ''}: missing binding for slot ` +
                    `'${slot.name}' required by pipeline ${newPipeline.fingerprint}.`
            );
        }
        if (candidate.kind === 'rawBuffer') {
            if (slot.kind !== 'uniform' && slot.kind !== 'storage') {
                for (const r of out.values()) asManaged(r).destroy();
                throw new Error(
                    `Drawable.reuse${label !== undefined ? ` '${label}'` : ''}: binding for slot '${slot.name}' ` +
                        `(kind '${slot.kind}') cannot be a RawBufferResource.`
                );
            }
        } else if (candidate.kind !== slot.kind) {
            for (const r of out.values()) asManaged(r).destroy();
            throw new Error(
                `Drawable.reuse${label !== undefined ? ` '${label}'` : ''}: binding kind mismatch for slot ` +
                    `'${slot.name}' — pipeline expects '${slot.kind}' but resource is '${candidate.kind}'.`
            );
        }
        out.set(slot, asManaged(candidate).share());
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
