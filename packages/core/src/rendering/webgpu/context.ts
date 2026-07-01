/**
 * `RenderingContext` — device-scoped owner of pipeline build state.
 *
 * Replaces the previous module-level `WeakMap<GPUDevice, Map<fingerprint, BuiltPipeline>>` cache
 * with a per-instance cache so applications and tests can hold isolated caches against the same
 * `GPUDevice`, dispose them deterministically, and instrument them via `stats()`.
 *
 * Future phases extend this class — Phase 4 adds `ctx.resource(slot, init?)` over the
 * externally-supplied `bufferManager`; Phase 5 adds `ctx.drawable({...})`; Phase 7 adds
 * `ctx.encoder()` + `ctx.submit(scene)` and the bind-group cache.
 *
 * **Ownership contract**: a `BufferManager` is **always externally constructed**. The context
 * holds a reference but never creates, manages, or disposes it. `ctx.dispose()` clears the
 * pipeline cache only — the caller's `BufferManager` lifetime is untouched.
 */

import type { BufferManager } from './memory/types';
import {
    type BufferResource,
    type ExternalTextureResource,
    type Resource,
    type SamplerResource,
    type SlotReflectionCache,
    type StorageTextureResource,
    type TextureResource,
    makeBufferResource,
    makeExternalTextureResource,
    makeSamplerResource,
    makeSlotReflectionCache,
    makeStorageTextureResource,
    makeTextureResource,
} from './data/resource';
import { type BuiltPipeline, buildPipeline } from './pipelines/build';
import type { BindingGraph } from './pipelines/binding-graph';
import { pipelineFingerprint } from './pipelines/fingerprint';
import {
    normalizePipelineState,
    type PipelineStateDescriptor,
} from './pipelines/pipeline-state';
import { resolveShaderBindings } from './pipelines/traverse';
import { buildDrawable, type Drawable, type DrawableSpec } from './drawable';
import type { BindGroupCacheStore } from './encoder/bind-group-builder';
import { makeGraphEncoder, type GraphEncoder } from './encoder/encoder';
import type { Scene } from './scene/types';
import type {
    ExternalTextureSlot,
    ResourceSlot,
    SamplerSlot,
    StorageSlot,
    StorageTextureSlot,
    TextureSlot,
    UniformSlot,
} from './resources/resource';
import type { WgslShader } from './shaders';
import type {
    RenderingContext,
    RenderingContextSpec,
    RenderingContextStats,
    ResourceFor,
    ResourceInit,
} from './context-types';

/**
 * Device-scoped facade for pipeline build + resource / drawable / encoder construction.
 * Implements the public {@link RenderingContext} interface (declared in `context-types.ts`).
 *
 * Construct via the lowercase factory `renderingContext(spec)` to match the surrounding
 * authoring style; this class is an implementation detail and is not part of the public
 * barrel — callers annotate with the `RenderingContext` interface instead.
 */
export class RenderingContextImpl implements RenderingContext {
    readonly device: GPUDevice;
    readonly label?: string;
    readonly bufferManager?: BufferManager;

    private readonly _pipelineCache: Map<string, BuiltPipeline> = new Map();
    /** Per-context `GPUBindGroup` cache consulted by the encoder. Phase 7. */
    private readonly _bindGroupCache: BindGroupCacheStore = { cache: new Map() };
    /** Per-context memo of slot reflection, consumed by `makeBufferResource`. Replaces the
     *  former module-global `slotDefCache` WeakMap. */
    private readonly _slotReflectionCache: SlotReflectionCache = makeSlotReflectionCache();
    /** Cached `GraphEncoder` (Phase 7). One per context — re-created if disposed. */
    private _encoder: GraphEncoder | undefined;
    private _disposed = false;

    constructor(spec: RenderingContextSpec) {
        this.device = spec.device;
        if (spec.label !== undefined) this.label = spec.label;
        if (spec.bufferManager !== undefined) this.bufferManager = spec.bufferManager;
    }

    /** Number of `BuiltPipeline`s currently cached on this instance. */
    get pipelineCount(): number {
        return this._pipelineCache.size;
    }

    /** `true` once `dispose()` has been called. Further `pipeline()` calls will throw. */
    get disposed(): boolean {
        return this._disposed;
    }

    /**
     * Build (or return a cached) `BuiltPipeline` for `(graph, shader, state)` against this
     * context's device. Identical inputs return the same instance; differing state (after
     * canonical normalization) produces a distinct entry.
     */
    pipeline(
        graph: BindingGraph,
        shader: WgslShader,
        state: PipelineStateDescriptor
    ): BuiltPipeline {
        this.assertNotDisposed();
        const normalizedState = normalizePipelineState(state);
        const slotIndex = resolveShaderBindings(graph, shader);
        const fingerprint = pipelineFingerprint(shader, slotIndex, normalizedState);
        const cached = this._pipelineCache.get(fingerprint);
        if (cached !== undefined) return cached;
        const built = buildPipeline(
            this.device,
            graph,
            shader,
            normalizedState,
            slotIndex,
            fingerprint
        );
        this._pipelineCache.set(fingerprint, built);
        return built;
    }

    /**
     * Construct a data-bearing `Resource` for `slot`. Dispatches on `slot.kind`:
     *
     * - `uniform` / `storage` → `BufferResource<T>`. `init` may be a `Partial<T>` of initial
     *   values (seeded into the CPU-side view; the first `commit()` uploads them). Requires
     *   `bufferManager` to have been supplied at construction; throws otherwise.
     * - `texture` / `storageTexture` → wraps a caller-supplied `GPUTexture` (+ optional view).
     * - `sampler` → wraps a caller-supplied `GPUSampler` or constructs one from a descriptor.
     * - `externalTexture` → wraps a caller-supplied `GPUExternalTexture`.
     *
     * The returned resource starts with `refcount === 1`; pair every `ctx.resource()` with
     * exactly one `destroy()` (or use `share()` to extend its lifetime across owners).
     */
    resource<S extends ResourceSlot>(slot: S, init?: ResourceInit<S>): ResourceFor<S> {
        this.assertNotDisposed();
        switch (slot.kind) {
            case 'uniform':
            case 'storage': {
                const bm = this.bufferManager;
                if (bm === undefined) {
                    const tag = this.label !== undefined ? ` '${this.label}'` : '';
                    throw new Error(
                        `RenderingContext${tag}: resource(slot '${slot.name}') requires a bufferManager; ` +
                            'pass one to renderingContext({ device, bufferManager }).'
                    );
                }
                const resource = makeBufferResource(
                    slot as UniformSlot | StorageSlot,
                    bm,
                    init as Partial<Record<string, unknown>> | undefined,
                    this._slotReflectionCache
                );
                return resource as unknown as ResourceFor<S>;
            }
            case 'sampler': {
                const resource = makeSamplerResource(
                    slot as SamplerSlot,
                    this.device,
                    init as GPUSampler | GPUSamplerDescriptor | undefined
                );
                return resource as unknown as ResourceFor<S>;
            }
            case 'texture': {
                if (init === undefined) {
                    throw new Error(
                        `RenderingContext.resource: slot '${slot.name}' (kind 'texture') requires an ` +
                            'init `{ texture, view? }`; texture creation from image sources is deferred to a follow-up.'
                    );
                }
                const resource = makeTextureResource(
                    slot as TextureSlot,
                    init as { texture: GPUTexture; view?: GPUTextureView }
                );
                return resource as unknown as ResourceFor<S>;
            }
            case 'storageTexture': {
                if (init === undefined) {
                    throw new Error(
                        `RenderingContext.resource: slot '${slot.name}' (kind 'storageTexture') requires an ` +
                            'init `{ texture, view? }`.'
                    );
                }
                const resource = makeStorageTextureResource(
                    slot as StorageTextureSlot,
                    init as { texture: GPUTexture; view?: GPUTextureView }
                );
                return resource as unknown as ResourceFor<S>;
            }
            case 'externalTexture': {
                if (init === undefined) {
                    throw new Error(
                        `RenderingContext.resource: slot '${slot.name}' (kind 'externalTexture') requires an ` +
                            'init `GPUExternalTexture`.'
                    );
                }
                const resource = makeExternalTextureResource(
                    slot as ExternalTextureSlot,
                    init as GPUExternalTexture
                );
                return resource as unknown as ResourceFor<S>;
            }
        }
    }

    /**
     * Construct a `Drawable` — a pipeline + vertex / index / binding resources + draw call —
     * against this context. Phase 5 of the rendering refactor.
     *
     * Vertex / index input may be:
     *   - Pre-built: a `Map<bufferSlot, BufferResource | RawBufferResource>` (vertex) /
     *     `{ resource, format }` (index). The drawable `share()`s each supplied resource so
     *     the caller retains its own refcount.
     *   - Raw arrays: a `{ kind: 'arrays', arrays, options?, bufferSlots? }` descriptor.
     *     `webgpu-utils.createBufferLayoutsFromArrays` is used **only** to derive byte
     *     layouts; GPU buffer allocation funnels through `this.bufferManager.acquire`, and
     *     uploads go through `this.device.queue.writeBuffer(handle.gpu, handle.offset, …)` so
     *     slab-style managers remain transparent. Requires `bufferManager` to have been
     *     supplied at construction; throws otherwise.
     *
     * `bindings` must cover every slot in `pipeline.slotIndex`; resource kinds are validated.
     *
     * Pair every `ctx.drawable(spec)` with exactly one `drawable.destroy()` — the destroy
     * decrefs every owned resource, freshly-allocated buffers fall to refcount 0 and release
     * their `BufferHandle`s, pre-built ones fall back to the caller's refcount.
     */
    drawable(spec: DrawableSpec): Drawable {
        this.assertNotDisposed();
        return buildDrawable(this, spec);
    }

    /**
     * Construct (or return the cached) `GraphEncoder` bound to this context. The encoder is
     * stateless across `submit` calls beyond what `RenderingContext` caches — the bind-group
     * cache lives on this context, so an encoder freed and re-created here doesn't lose its
     * cache.
     */
    encoder(): GraphEncoder {
        this.assertNotDisposed();
        if (this._encoder === undefined) {
            this._encoder = makeGraphEncoder(this, this._bindGroupCache);
        }
        return this._encoder;
    }

    /**
     * Encode + submit `scene` to the device queue in one call. Convenience wrapper over
     * `ctx.encoder().submit(scene)` — the encoder instance is constructed lazily and cached.
     */
    submit(scene: Scene): GPUCommandBuffer {
        return this.encoder().submit(scene);
    }

    /**
     * Drop every cached `BuiltPipeline` without disposing the context. Safe to call repeatedly;
     * subsequent `pipeline()` calls rebuild on demand.
     */
    disposePipelineCache(): void {
        this._pipelineCache.clear();
    }

    /**
     * Drop every cached `GPUBindGroup` without disposing the context. Phase 8 lifecycle hook:
     * call after a large scene mutation (e.g. `Scene.remove` of a big subtree) to release the
     * bind groups that are no longer referenced. Cheap; rebuilt lazily on next submit.
     */
    disposeBindGroupCache(): void {
        this._bindGroupCache.cache.clear();
    }

    /**
     * Tear down everything this context owns. Idempotent. After `dispose()` further
     * `pipeline()` calls throw. **Does not** dispose the externally-supplied `bufferManager` —
     * that lifetime belongs to the caller.
     */
    dispose(): void {
        if (this._disposed) return;
        this.disposePipelineCache();
        this.disposeBindGroupCache();
        this._encoder?.clearSubtreeCache();
        this._encoder = undefined;
        this._disposed = true;
    }

    /** Snapshot of current cache occupancy. Cheap; suitable for HUDs / instrumentation. */
    stats(): RenderingContextStats {
        const base = {
            pipelines: this._pipelineCache.size,
            bindGroups: this._bindGroupCache.cache.size,
        };
        if (this.bufferManager === undefined) return base;
        const bm = this.bufferManager.stats();
        return { ...base, bytes: bm.residentBytes, leasedBytes: bm.leasedBytes };
    }

    private assertNotDisposed(): void {
        if (!this._disposed) return;
        const tag = this.label !== undefined ? ` '${this.label}'` : '';
        throw new Error(`RenderingContext${tag}: use-after-dispose.`);
    }
}

/**
 * Lowercase factory for `RenderingContext`. Matches the convention used by `group`, `bindings`,
 * `shader`, `struct`, etc. Returns the public `RenderingContext` interface; the concrete
 * `RenderingContextImpl` class is an implementation detail.
 */
export function renderingContext(spec: RenderingContextSpec): RenderingContext {
    return new RenderingContextImpl(spec);
}
