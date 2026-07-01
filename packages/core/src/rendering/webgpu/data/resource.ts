/**
 * Data-bearing `Resource` family — the runtime counterpart to a `ResourceSlot`.
 *
 * Where a `ResourceSlot` is a *descriptor* (`{name, type, kind, ...}`), a `Resource` is an
 * *instance* that carries an actual `GPUBuffer` (via a `BufferHandle`), `GPUTexture`,
 * `GPUSampler`, or `GPUExternalTexture`. `RenderingContext.resource(slot, init?)` is the only
 * public constructor; raw exports here are kinds and the discriminated union type.
 *
 * Tier-1 type safety: a `BufferResource<T>` carries `T` (the host-side shape of the slot's
 * struct, declared via `struct<T>(...)` and threaded through `slot.uniform<T>(...)`). `set()`
 * accepts `Partial<T>` and `setField<K extends keyof T>(k, v: T[K])` is field-checked at
 * compile time. Reflection (`webgpu-utils.makeShaderDataDefinitions` over a synthetic WGSL
 * snippet built from the slot's `StructDecl`) is cached per-slot in a module-level WeakMap, so
 * repeated `ctx.resource(slot)` calls pay the reflection cost exactly once per slot.
 *
 * Refcount semantics:
 *   - Every freshly-constructed resource has `refcount === 1`.
 *   - `share()` increments the refcount and returns `this` (so call sites can write
 *     `const child = parent.share()`).
 *   - `destroy()` decrements the refcount; when it reaches 0 the resource releases its
 *     `BufferHandle` (or destroys its texture/sampler) and is left in a `disposed === true`
 *     state. Further calls to `destroy()` are no-ops, so callers can always pair their
 *     constructions and tearings-down 1:1 without tracking who has the "last" reference.
 *
 * Slab-readiness: every WebGPU API call on a `BufferResource` threads `handle.offset` + the
 * appropriate byte range through `queue.writeBuffer` so a future `SlabBufferManager` (one
 * giant `GPUBuffer` carved into slices) is a drop-in replacement for `BatchPoolBufferManager`.
 */

import { makeStructuredView, makeShaderDataDefinitions } from 'webgpu-utils';
import type { StructDefinition, StructuredView, VariableDefinition } from 'webgpu-utils';
import type { BufferHandle, BufferManager, BufferUsageFlags } from '../memory/types';
import type {
    ExternalTextureSlot,
    ResourceSlot,
    SamplerSlot,
    StorageSlot,
    StorageTextureSlot,
    TextureSlot,
    UniformSlot,
} from '../resources/resource';
import type { StructDeclaration } from '../shaders';

// ---- Brand & shared base ----------------------------------------------------------------------

/** Brand symbol used by `isResource` to discriminate `Resource` objects at runtime. */
export const RESOURCE_BRAND: unique symbol = Symbol.for('vis-core.webgpu.Resource');

/** Brand + lifecycle fields shared by every `Resource` variant — including slot-less ones
 *  such as `RawBufferResource` (used for vertex/index buffers in `Drawable`). */
interface ResourceLifecycle {
    readonly __brand: typeof RESOURCE_BRAND;
    /** Monotonically increasing version, bumped on every committed mutation. Drives the
     *  bind-group cache invalidation key in Phase 7. */
    readonly version: number;
    /** `true` once the underlying GPU resource has been released. */
    readonly disposed: boolean;
    /** Current refcount; starts at `1`, incremented by `share()`, decremented by `destroy()`. */
    readonly refcount: number;
    /** Increment the refcount and return `this`. Use for explicit cross-Drawable sharing. */
    share(): this;
    /** Decrement the refcount; release the underlying GPU resource when it reaches `0`. */
    destroy(): void;
}

/** Fields common to every slot-bound `Resource` variant (everything except `RawBufferResource`). */
interface ResourceCommon extends ResourceLifecycle {
    readonly kind: ResourceSlot['kind'];
    readonly slot: ResourceSlot;
}

// ---- BufferResource ---------------------------------------------------------------------------

/**
 * Buffer-backed resource for `slot.uniform` / `slot.storage` declarations.
 *
 * `view` is a `webgpu-utils` `StructuredView` over `arrayBuffer`; mutate via `set()` /
 * `setField()` then `commit(device)` to upload to the GPU. `view.views.<fieldName>` exposes
 * the raw typed-array views per struct member for advanced patterns (e.g. partial-region
 * uploads) that the typed `set()` API doesn't cover.
 *
 * `T` is the host-side shape derived from the slot's `StructDecl<T>`; `unknown` when the slot
 * carried only a raw WGSL type identifier.
 */
export interface BufferResource<T = unknown> extends ResourceCommon {
    readonly kind: 'uniform' | 'storage';
    readonly slot: UniformSlot | StorageSlot;
    /** Underlying `BufferHandle` (carries `gpu` + `offset` + `size`). */
    readonly handle: BufferHandle;
    /** The `webgpu-utils` structured view backing `set()` / `setField()`. */
    readonly view: StructuredView;
    /** The CPU-side `ArrayBuffer` that `commit()` uploads. Alias for `view.arrayBuffer`. */
    readonly arrayBuffer: ArrayBuffer;
    /** Usage flag-set this resource's `handle` was allocated with. */
    readonly usage: BufferUsageFlags;
    /** Typed bulk update: `view.set(values)` followed by a `version` bump on next `commit`. */
    set(values: Partial<T>): void;
    /** Typed field update: convenience over `view.views[k] = v; nextCommitBumps()`. */
    setField<K extends keyof T>(key: K, value: T[K]): void;
    /** Flush the CPU-side `arrayBuffer` to GPU via `queue.writeBuffer(gpu, offset, ...)`. */
    commit(device: GPUDevice): void;
}

// ---- RawBufferResource ------------------------------------------------------------------------

/**
 * Slot-less buffer wrapper used for vertex / index buffers in `Drawable`. Unlike
 * `BufferResource<T>`, a `RawBufferResource` has no `ResourceSlot`, no `StructuredView`, and
 * no typed `set()` / `setField()` — it exists solely to carry a `BufferHandle` through the
 * `Drawable` lifecycle with proper refcount + share + destroy semantics.
 *
 * `ctx.drawable()` constructs these internally when given a raw-arrays vertex/index input;
 * callers building drawables from pre-allocated `BufferHandle`s use `makeRawBufferResource`
 * directly.
 */
export interface RawBufferResource extends ResourceLifecycle {
    readonly kind: 'rawBuffer';
    /** Underlying `BufferHandle` (carries `gpu` + `offset` + `size`). */
    readonly handle: BufferHandle;
    /** Usage flag-set the handle was allocated with. */
    readonly usage: BufferUsageFlags;
    /** Optional debug label, threaded through error messages. */
    readonly label?: string;
}

// ---- Texture / Sampler / External wrappers ---------------------------------------------------

/** Wrapper around a pre-built `GPUTexture` (+ default view) for sampled-texture bindings. */
export interface TextureResource extends ResourceCommon {
    readonly kind: 'texture';
    readonly slot: TextureSlot;
    readonly texture: GPUTexture;
    readonly view: GPUTextureView;
}

/** Wrapper around a `GPUTexture` whose usage includes `STORAGE_BINDING`. */
export interface StorageTextureResource extends ResourceCommon {
    readonly kind: 'storageTexture';
    readonly slot: StorageTextureSlot;
    readonly texture: GPUTexture;
    readonly view: GPUTextureView;
}

/** Wrapper around a `GPUSampler`. */
export interface SamplerResource extends ResourceCommon {
    readonly kind: 'sampler';
    readonly slot: SamplerSlot;
    readonly sampler: GPUSampler;
}

/** Wrapper around a `GPUExternalTexture` (typically `device.importExternalTexture(...)`). */
export interface ExternalTextureResource extends ResourceCommon {
    readonly kind: 'externalTexture';
    readonly slot: ExternalTextureSlot;
    readonly external: GPUExternalTexture;
}

/** Discriminated union of every concrete `Resource` flavor. */
export type Resource =
    | BufferResource<unknown>
    | RawBufferResource
    | StorageTextureResource
    | TextureResource
    | SamplerResource
    | ExternalTextureResource;

/** Runtime discriminator for `Resource` (mirror of `isResourceSlot`). */
export function isResource(value: unknown): value is Resource {
    return (
        typeof value === 'object' &&
        value !== null &&
        '__brand' in value &&
        (value as { __brand: unknown }).__brand === RESOURCE_BRAND
    );
}

// ---- Init shapes ------------------------------------------------------------------------------

/**
 * Per-kind initializers accepted by `ctx.resource(slot, init?)`.
 *
 * - Buffer slots accept an optional `Partial<T>` of initial values (committed during
 *   construction so the first `commit()` after construction is a no-op until a `set()` runs).
 * - Texture / storage-texture slots require a pre-built `GPUTexture` (and optional `view`).
 * - Sampler slots accept either a pre-built `GPUSampler` or a `GPUSamplerDescriptor` (in which
 *   case the constructor calls `device.createSampler(descriptor)`).
 * - External-texture slots require a pre-built `GPUExternalTexture`.
 */
export type ResourceInit<S extends ResourceSlot> = S extends UniformSlot
    ? Partial<Record<string, unknown>> | undefined
    : S extends StorageSlot
      ? Partial<Record<string, unknown>> | undefined
      : S extends TextureSlot
        ? { texture: GPUTexture; view?: GPUTextureView }
        : S extends StorageTextureSlot
          ? { texture: GPUTexture; view?: GPUTextureView }
          : S extends SamplerSlot
            ? GPUSampler | GPUSamplerDescriptor | undefined
            : S extends ExternalTextureSlot
              ? GPUExternalTexture
              : never;

// ---- Reflection cache -------------------------------------------------------------------------

/**
 * Per-context memo of `(slot) → webgpu-utils VariableDefinition`, keyed by slot identity.
 * Owned by the `RenderingContext` (created via `makeSlotReflectionCache()`) and threaded into
 * `makeBufferResource` so the reflection cost is paid once per (context, slot) instead of via
 * module-global state. Slots whose `type` is a raw WGSL identifier (no `StructDeclaration`)
 * cache `undefined` so subsequent lookups stay fast.
 */
export type SlotReflectionCache = WeakMap<ResourceSlot, VariableDefinition | undefined>;

/** Construct an empty {@link SlotReflectionCache}. */
export function makeSlotReflectionCache(): SlotReflectionCache {
    return new WeakMap<ResourceSlot, VariableDefinition | undefined>();
}

/**
 * Return the `VariableDefinition` reflected from `slot.type`, or `undefined` if not a struct.
 * When a `cache` is supplied the result is memoized on it (checking `has` so a cached
 * `undefined` still short-circuits); without a cache the reflection is recomputed each call.
 */
function reflectSlot(
    slot: UniformSlot | StorageSlot,
    cache?: SlotReflectionCache
): VariableDefinition | undefined {
    if (cache?.has(slot)) return cache.get(slot);
    const def = computeSlotDef(slot);
    cache?.set(slot, def);
    return def;
}

function computeSlotDef(slot: UniformSlot | StorageSlot): VariableDefinition | undefined {
    const t = slot.type;
    if (typeof t === 'string') return undefined;
    if (!isStructDeclaration(t)) return undefined;
    const addressSpace =
        slot.kind === 'storage'
            ? slot.accessMode !== undefined
                ? `storage, ${slot.accessMode}`
                : 'storage'
            : 'uniform';
    const wgsl = `${t.__gen()};\n@group(0) @binding(0) var<${addressSpace}> __slot: ${t.name};`;
    const defs = makeShaderDataDefinitions(wgsl);
    return slot.kind === 'storage' ? defs.storages.__slot : defs.uniforms.__slot;
}

function isStructDeclaration(t: unknown): t is StructDeclaration {
    return (
        typeof t === 'object' &&
        t !== null &&
        '__identType' in t &&
        (t as { __identType: unknown }).__identType === 'struct'
    );
}

// ---- Construction helpers (used by RenderingContext.resource) --------------------------------

/**
 * Default minimum `GPUBufferUsage` flag-set for a buffer-backed slot. `RenderingContext`
 * uses this when the caller doesn't supply an explicit usage (the common path).
 */
export function defaultBufferUsageFor(slot: UniformSlot | StorageSlot): BufferUsageFlags {
    return slot.kind === 'storage'
        ? GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        : GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
}

/**
 * Construct a `BufferResource<T>` for a buffer-backed slot. Internal — call sites go through
 * `ctx.resource(slot, init?)`.
 */
export function makeBufferResource<T>(
    slot: UniformSlot | StorageSlot,
    bufferManager: BufferManager,
    init: Partial<T> | undefined,
    cache?: SlotReflectionCache
): BufferResource<T> {
    const def = reflectSlot(slot, cache);
    if (def === undefined) {
        throw new Error(
            `RenderingContext.resource: slot '${slot.name}' (kind '${slot.kind}') must carry a ` +
                'StructDecl type (see `struct(...)` in shaders) to construct a BufferResource. ' +
                'Raw WGSL string types are not supported in v1.'
        );
    }
    // `makeStructuredView` accepts both `VariableDefinition` and `StructDefinition`; we pass the
    // `VariableDefinition` so it picks the correct `typeDefinition` internally.
    const view = makeStructuredView(def);
    const sizeBytes = view.arrayBuffer.byteLength;
    const usage = defaultBufferUsageFor(slot);
    // Fast-fail at the budget boundary before issuing any partial allocations.
    if (!bufferManager.precheck(sizeBytes)) {
        throw new Error(
            `RenderingContext.resource: buffer-manager precheck refused ${sizeBytes} B for slot ` +
                `'${slot.name}' (kind '${slot.kind}'). The request exceeds the current memory ` +
                'budget and no batches can be evicted to satisfy it.'
        );
    }
    const handle = bufferManager.acquireForSlot(slot, sizeBytes, usage);

    let refcount = 1;
    let version = 0;
    let disposed = false;

    const resource = {
        __brand: RESOURCE_BRAND,
        kind: slot.kind,
        slot,
        handle,
        view,
        arrayBuffer: view.arrayBuffer,
        usage,
        get version(): number {
            return version;
        },
        get refcount(): number {
            return refcount;
        },
        get disposed(): boolean {
            return disposed;
        },
        set(values: Partial<T>): void {
            if (disposed) throw new Error(`BufferResource '${slot.name}': set() after destroy().`);
            view.set(values as unknown);
        },
        setField<K extends keyof T>(key: K, value: T[K]): void {
            if (disposed) throw new Error(`BufferResource '${slot.name}': setField() after destroy().`);
            const views = view.views as Record<string, unknown>;
            const target = views[key as string];
            if (target === undefined) {
                throw new Error(
                    `BufferResource '${slot.name}': setField('${String(key)}') — no such field in struct '${(slot.type as StructDeclaration).name}'.`
                );
            }
            // Reuse `set()` for typed-array vs scalar handling.
            view.set({ [key as string]: value } as unknown);
        },
        commit(device: GPUDevice): void {
            if (disposed) throw new Error(`BufferResource '${slot.name}': commit() after destroy().`);
            device.queue.writeBuffer(handle.gpu, handle.offset, view.arrayBuffer);
            version += 1;
        },
        share(): BufferResource<T> {
            if (disposed) throw new Error(`BufferResource '${slot.name}': share() after destroy().`);
            refcount += 1;
            return resource;
        },
        destroy(): void {
            if (disposed) return;
            refcount -= 1;
            if (refcount > 0) return;
            handle.release();
            disposed = true;
        },
    } satisfies BufferResource<T> & { share(): BufferResource<T> };

    // Seed initial values without a `commit` — defer device upload until the caller chooses.
    if (init !== undefined) {
        view.set(init as unknown);
    }
    return resource as BufferResource<T>;
}

/** Construct a `SamplerResource` from either a prebuilt `GPUSampler` or a descriptor. */
export function makeSamplerResource(
    slot: SamplerSlot,
    device: GPUDevice,
    init: GPUSampler | GPUSamplerDescriptor | undefined
): SamplerResource {
    const sampler =
        init === undefined
            ? device.createSampler()
            : isGPUSampler(init)
              ? init
              : device.createSampler(init);

    let refcount = 1;
    let disposed = false;

    const resource = {
        __brand: RESOURCE_BRAND,
        kind: 'sampler' as const,
        slot,
        sampler,
        version: 0,
        get refcount(): number {
            return refcount;
        },
        get disposed(): boolean {
            return disposed;
        },
        share(): SamplerResource {
            if (disposed) throw new Error(`SamplerResource '${slot.name}': share() after destroy().`);
            refcount += 1;
            return resource;
        },
        destroy(): void {
            if (disposed) return;
            refcount -= 1;
            if (refcount > 0) return;
            // GPUSampler has no .destroy() — drop the reference and mark disposed.
            disposed = true;
        },
    } satisfies SamplerResource & { share(): SamplerResource };

    return resource as SamplerResource;
}

/** Construct a `TextureResource` from a prebuilt `GPUTexture` (+ optional explicit view). */
export function makeTextureResource(
    slot: TextureSlot,
    init: { texture: GPUTexture; view?: GPUTextureView }
): TextureResource {
    const texture = init.texture;
    const view = init.view ?? texture.createView();

    let refcount = 1;
    let disposed = false;

    const resource = {
        __brand: RESOURCE_BRAND,
        kind: 'texture' as const,
        slot,
        texture,
        view,
        version: 0,
        get refcount(): number {
            return refcount;
        },
        get disposed(): boolean {
            return disposed;
        },
        share(): TextureResource {
            if (disposed) throw new Error(`TextureResource '${slot.name}': share() after destroy().`);
            refcount += 1;
            return resource;
        },
        destroy(): void {
            if (disposed) return;
            refcount -= 1;
            if (refcount > 0) return;
            texture.destroy();
            disposed = true;
        },
    } satisfies TextureResource & { share(): TextureResource };

    return resource as TextureResource;
}

/** Construct a `StorageTextureResource` from a prebuilt `GPUTexture`. */
export function makeStorageTextureResource(
    slot: StorageTextureSlot,
    init: { texture: GPUTexture; view?: GPUTextureView }
): StorageTextureResource {
    const texture = init.texture;
    const view = init.view ?? texture.createView();

    let refcount = 1;
    let disposed = false;

    const resource = {
        __brand: RESOURCE_BRAND,
        kind: 'storageTexture' as const,
        slot,
        texture,
        view,
        version: 0,
        get refcount(): number {
            return refcount;
        },
        get disposed(): boolean {
            return disposed;
        },
        share(): StorageTextureResource {
            if (disposed) throw new Error(`StorageTextureResource '${slot.name}': share() after destroy().`);
            refcount += 1;
            return resource;
        },
        destroy(): void {
            if (disposed) return;
            refcount -= 1;
            if (refcount > 0) return;
            texture.destroy();
            disposed = true;
        },
    } satisfies StorageTextureResource & { share(): StorageTextureResource };

    return resource as StorageTextureResource;
}

/** Construct an `ExternalTextureResource` from a prebuilt `GPUExternalTexture`. */
export function makeExternalTextureResource(
    slot: ExternalTextureSlot,
    external: GPUExternalTexture
): ExternalTextureResource {
    let refcount = 1;
    let disposed = false;

    const resource = {
        __brand: RESOURCE_BRAND,
        kind: 'externalTexture' as const,
        slot,
        external,
        version: 0,
        get refcount(): number {
            return refcount;
        },
        get disposed(): boolean {
            return disposed;
        },
        share(): ExternalTextureResource {
            if (disposed) throw new Error(`ExternalTextureResource '${slot.name}': share() after destroy().`);
            refcount += 1;
            return resource;
        },
        destroy(): void {
            if (disposed) return;
            refcount -= 1;
            if (refcount > 0) return;
            // GPUExternalTexture has no .destroy() in v1 spec — drop the reference and mark disposed.
            disposed = true;
        },
    } satisfies ExternalTextureResource & { share(): ExternalTextureResource };

    return resource as ExternalTextureResource;
}

/**
 * Construct a `RawBufferResource` wrapping a pre-allocated `BufferHandle`. Used by
 * `ctx.drawable()` for raw-arrays vertex / index buffers; also re-exported for callers who
 * manage their own `BufferManager` allocations and want a refcounted lifecycle wrapper.
 *
 * The wrapper takes ownership of the handle: `destroy()` (when refcount hits 0) calls
 * `handle.release()`. Callers must not invoke `handle.release()` themselves while a
 * `RawBufferResource` holds a reference.
 */
export function makeRawBufferResource(
    handle: BufferHandle,
    usage: BufferUsageFlags,
    label?: string
): RawBufferResource {
    let refcount = 1;
    let disposed = false;

    const resource: RawBufferResource & { share(): RawBufferResource } = {
        __brand: RESOURCE_BRAND,
        kind: 'rawBuffer' as const,
        handle,
        usage,
        ...(label !== undefined && { label }),
        version: 0,
        get refcount(): number {
            return refcount;
        },
        get disposed(): boolean {
            return disposed;
        },
        share(): RawBufferResource {
            if (disposed) {
                throw new Error(
                    `RawBufferResource${label !== undefined ? ` '${label}'` : ''}: share() after destroy().`
                );
            }
            refcount += 1;
            return resource;
        },
        destroy(): void {
            if (disposed) return;
            refcount -= 1;
            if (refcount > 0) return;
            handle.release();
            disposed = true;
        },
    };

    return resource;
}

// ---- Internal helpers -------------------------------------------------------------------------

function isGPUSampler(v: unknown): v is GPUSampler {
    return (
        typeof v === 'object' &&
        v !== null &&
        // GPUSampler has a `label` getter and no method named `addressModeU` (those live on the
        // descriptor). Brand-check via class-string when available; fall back to descriptor
        // detection (absence of any descriptor-only properties).
        !('addressModeU' in v) &&
        !('magFilter' in v)
    );
}

/** Internal export used by the test suite to exercise reflection in isolation. */
export const __internal = {
    isStructDeclaration,
} as const;

// Avoid an "unused import" error when only the StructDefinition type is referenced via JSDoc.
export type { StructDefinition };
