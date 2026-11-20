import { v4 as uuidv4 } from 'uuid';
import type { StructuredView, VariableDefinition } from 'webgpu-utils';
import { makeShaderDataDefinitions, makeStructuredView } from 'webgpu-utils';
import { isBranded } from '../../foundation';
import type { BufferHandle, BufferManager, BufferUsageFlags } from '../../memory';
import type { StructDeclaration } from '../../shaders';
import type {
    ExternalTextureSlot,
    ResourceSlot,
    SamplerSlot,
    StorageSlot,
    StorageTextureSlot,
    TextureSlot,
    UniformSlot,
} from '../binding/slot';

// ---- Brand & shared base ----------------------------------------------------------------------

/** Brand symbol used by `isResource` to discriminate `Resource` objects at runtime. */
export const RESOURCE_BRAND: unique symbol = Symbol.for('vis-core.webgpu.Resource');

/** Callback a resource invokes when a mutation (`commit()`) or teardown (`destroy()`) means
 *  any cached `GPUBindGroup` referencing it must be dropped. Wired by `RenderingContext` so
 *  the bind-group cache is swept automatically; resources built outside a context leave it
 *  unset and rely on `ctx.sweepBindGroups(...)`. */
export type ResourceInvalidateHook = (resource: Resource) => void;

/** Public identity + cache metadata carried by every `Resource`. Read-only; carries no
 *  memory-management surface (see `ResourceLifecycle`, which is internal). Includes slot-less
 *  variants such as `RawBufferResource` (used for vertex/index buffers in `Drawable`). */
interface ResourceIdentity {
    readonly brand: typeof RESOURCE_BRAND;
    /** Globally-unique identity (UUIDv4), stable for the resource's lifetime. Distinguishes
     *  two resources that share a slot + `version` in the bind-group cache key. */
    readonly id: string;
    /** Monotonically increasing version, bumped on every committed mutation. Drives the
     *  bind-group cache invalidation key. */
    readonly version: number;
}

/** Fields common to every slot-bound `Resource` variant (everything except `RawBufferResource`). */
interface ResourceCommon extends ResourceIdentity {
    readonly kind: ResourceSlot['kind'];
    readonly slot: ResourceSlot;
}

/**
 * Internal reference-counting surface. Deliberately **not** part of the public `Resource` type:
 * resource lifetime is owned by the `RenderingContext` (everything it builds is destroyed on
 * `ctx.dispose()`) and by the `Scene` (drawables are destroyed when removed), so library users
 * never call these. Reachable inside the renderer via `asManaged(resource)` / `ManagedResource`.
 */
export interface ResourceLifecycle {
    /** Current refcount; starts at `1`, incremented by `share()`, decremented by `destroy()`. */
    readonly refcount: number;
    /** `true` once the underlying GPU resource has been released. */
    readonly disposed: boolean;
    /** Increment the refcount and return `this`. */
    share(): this;
    /** Decrement the refcount; release the underlying GPU resource when it reaches `0`. */
    destroy(): void;
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
export interface RawBufferResource extends ResourceIdentity {
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
    return isBranded(value, RESOURCE_BRAND);
}

/** A `Resource` plus its internal reference-counting surface. Used inside the renderer wherever
 *  lifetime must be driven; never exposed to library consumers. */
export type ManagedResource = Resource & ResourceLifecycle;

/** Reinterpret a public `Resource` as its `ManagedResource` runtime shape. Every `Resource`
 *  built by this module carries the lifecycle members — the public type merely hides them. */
export function asManaged<R extends Resource>(resource: R): R & ResourceLifecycle {
    return resource as R & ResourceLifecycle;
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
function reflectSlot(slot: UniformSlot | StorageSlot, cache?: SlotReflectionCache): VariableDefinition | undefined {
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
    const wgsl = `${t.gen()};\n@group(0) @binding(0) var<${addressSpace}> __slot: ${t.name};`;
    const defs = makeShaderDataDefinitions(wgsl);
    return slot.kind === 'storage' ? defs.storages.__slot : defs.uniforms.__slot;
}

function isStructDeclaration(t: unknown): t is StructDeclaration {
    return (
        typeof t === 'object' && t !== null && 'identType' in t && (t as { identType: unknown }).identType === 'struct'
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

/** Control handle passed to a resource's field-builder so its data methods can guard against
 *  use-after-destroy and record committed mutations. */
interface ResourceControl {
    /** Throw a consistent use-after-destroy error for `method`. */
    guard(method: string): void;
    /** Bump `version` and sweep any cached bind groups referencing this resource. */
    commit(): void;
}

/**
 * Assemble a `ManagedResource` from its data fields plus the shared reference-counting machinery
 * (`id` / `version` / `refcount` / `disposed` / `share` / `destroy`). `makeFields` receives a
 * `ResourceControl` so buffer resources can wire `set()` / `commit()`; `cleanup` releases the
 * backing GPU object once the refcount reaches `0`.
 */
function createManagedResource<Fields extends object>(
    typeName: string,
    label: () => string,
    makeFields: (ctl: ResourceControl) => Fields,
    cleanup: () => void,
    onInvalidate: ResourceInvalidateHook | undefined
): Fields & ResourceIdentity & ResourceLifecycle {
    let refcount = 1;
    let version = 0;
    let disposed = false;
    // Referenced by the closures below; assigned immediately after construction.
    let resource!: Fields & ResourceIdentity & ResourceLifecycle;

    const ctl: ResourceControl = {
        guard(method: string): void {
            if (disposed) throw new Error(`${typeName} '${label()}': ${method}() after destroy().`);
        },
        commit(): void {
            version += 1;
            onInvalidate?.(resource as unknown as Resource);
        },
    };

    resource = {
        brand: RESOURCE_BRAND,
        id: uuidv4(),
        ...makeFields(ctl),
        get version(): number {
            return version;
        },
        get refcount(): number {
            return refcount;
        },
        get disposed(): boolean {
            return disposed;
        },
        share(): typeof resource {
            if (disposed) throw new Error(`${typeName} '${label()}': share() after destroy().`);
            refcount += 1;
            return resource;
        },
        destroy(): void {
            if (disposed) return;
            refcount -= 1;
            if (refcount > 0) return;
            cleanup();
            disposed = true;
            onInvalidate?.(resource as unknown as Resource);
        },
    } as Fields & ResourceIdentity & ResourceLifecycle;

    return resource;
}

/**
 * Construct a `BufferResource<T>` for a buffer-backed slot. Internal — call sites go through
 * `ctx.resource(slot, init?)`.
 *
 * `T` is the host-side struct shape (from `struct<T>(...)` via `slot.uniform<T>(...)`), so `set()`
 * takes `Partial<T>` and `setField` is field-checked. Reflection over the slot's `StructDecl` is
 * cached per-slot on the owning `RenderingContext` (via `cache`), so repeated `ctx.resource(slot)`
 * calls pay it once. Every GPU write threads `handle.offset` + byte range through `queue.writeBuffer`,
 * keeping a future slab manager (one big `GPUBuffer` carved into slices) a drop-in replacement.
 */
export function makeBufferResource<T>(
    slot: UniformSlot | StorageSlot,
    bufferManager: BufferManager,
    init: Partial<T> | undefined,
    cache?: SlotReflectionCache,
    onInvalidate?: ResourceInvalidateHook
): BufferResource<T> & ResourceLifecycle {
    const def = reflectSlot(slot, cache);
    if (def === undefined) {
        throw new Error(
            `RenderingContext.resource: slot '${slot.name}' (kind '${slot.kind}') must carry a ` +
                'StructDecl type (see `struct(...)` in shaders) to construct a BufferResource. ' +
                'Raw WGSL string types are not supported.'
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

    const resource = createManagedResource<{
        kind: 'uniform' | 'storage';
        slot: UniformSlot | StorageSlot;
        handle: BufferHandle;
        view: StructuredView;
        arrayBuffer: ArrayBuffer;
        usage: BufferUsageFlags;
        set(values: Partial<T>): void;
        setField<K extends keyof T>(key: K, value: T[K]): void;
        commit(device: GPUDevice): void;
    }>(
        'BufferResource',
        () => slot.name,
        (ctl) => ({
            kind: slot.kind,
            slot,
            handle,
            view,
            arrayBuffer: view.arrayBuffer,
            usage,
            set(values: Partial<T>): void {
                ctl.guard('set');
                view.set(values as unknown);
            },
            setField<K extends keyof T>(key: K, value: T[K]): void {
                ctl.guard('setField');
                const views = view.views as Record<string, unknown>;
                if (views[key as string] === undefined) {
                    throw new Error(
                        `BufferResource '${slot.name}': setField('${String(key)}') — no such field in struct '${(slot.type as StructDeclaration).name}'.`
                    );
                }
                view.set({ [key as string]: value } as unknown);
            },
            commit(device: GPUDevice): void {
                ctl.guard('commit');
                device.queue.writeBuffer(handle.gpu, handle.offset, view.arrayBuffer);
                ctl.commit();
            },
        }),
        () => handle.release(),
        onInvalidate
    ) as BufferResource<T> & ResourceLifecycle;

    // Seed initial values without a `commit` — defer device upload until the caller chooses.
    if (init !== undefined) {
        view.set(init as unknown);
    }
    return resource;
}

/** Construct a `SamplerResource` from either a prebuilt `GPUSampler` or a descriptor. */
export function makeSamplerResource(
    slot: SamplerSlot,
    device: GPUDevice,
    init: GPUSampler | GPUSamplerDescriptor | undefined,
    onInvalidate?: ResourceInvalidateHook
): SamplerResource & ResourceLifecycle {
    const sampler =
        init === undefined ? device.createSampler() : isGPUSampler(init) ? init : device.createSampler(init);

    // GPUSampler has no `.destroy()` — the reference is simply dropped on teardown.
    return createManagedResource(
        'SamplerResource',
        () => slot.name,
        () => ({ kind: 'sampler' as const, slot, sampler }),
        () => {},
        onInvalidate
    ) as SamplerResource & ResourceLifecycle;
}

/** Construct a `TextureResource` from a prebuilt `GPUTexture` (+ optional explicit view). */
export function makeTextureResource(
    slot: TextureSlot,
    init: { texture: GPUTexture; view?: GPUTextureView },
    onInvalidate?: ResourceInvalidateHook
): TextureResource & ResourceLifecycle {
    const texture = init.texture;
    const view = init.view ?? texture.createView();

    return createManagedResource(
        'TextureResource',
        () => slot.name,
        () => ({ kind: 'texture' as const, slot, texture, view }),
        () => texture.destroy(),
        onInvalidate
    ) as TextureResource & ResourceLifecycle;
}

/** Construct a `StorageTextureResource` from a prebuilt `GPUTexture`. */
export function makeStorageTextureResource(
    slot: StorageTextureSlot,
    init: { texture: GPUTexture; view?: GPUTextureView },
    onInvalidate?: ResourceInvalidateHook
): StorageTextureResource & ResourceLifecycle {
    const texture = init.texture;
    const view = init.view ?? texture.createView();

    return createManagedResource(
        'StorageTextureResource',
        () => slot.name,
        () => ({ kind: 'storageTexture' as const, slot, texture, view }),
        () => texture.destroy(),
        onInvalidate
    ) as StorageTextureResource & ResourceLifecycle;
}

/** Construct an `ExternalTextureResource` from a prebuilt `GPUExternalTexture`. */
export function makeExternalTextureResource(
    slot: ExternalTextureSlot,
    external: GPUExternalTexture,
    onInvalidate?: ResourceInvalidateHook
): ExternalTextureResource & ResourceLifecycle {
    // GPUExternalTexture has no `.destroy()` — the reference is simply dropped on teardown.
    return createManagedResource(
        'ExternalTextureResource',
        () => slot.name,
        () => ({ kind: 'externalTexture' as const, slot, external }),
        () => {},
        onInvalidate
    ) as ExternalTextureResource & ResourceLifecycle;
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
    label?: string,
    onInvalidate?: ResourceInvalidateHook
): RawBufferResource & ResourceLifecycle {
    return createManagedResource(
        'RawBufferResource',
        () => label ?? '',
        () => ({ kind: 'rawBuffer' as const, handle, usage, ...(label !== undefined && { label }) }),
        () => handle.release(),
        onInvalidate
    ) as RawBufferResource & ResourceLifecycle;
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
