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
    type StorageTextureResource,
    type TextureResource,
    makeBufferResource,
    makeExternalTextureResource,
    makeSamplerResource,
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

/**
 * Spec passed to `renderingContext()` / `new RenderingContext()`.
 *
 * - `device`: the `GPUDevice` every built pipeline targets.
 * - `label`: optional debug label; surfaces in error messages (e.g. use-after-dispose).
 * - `bufferManager`: optional, user-constructed `BufferManager`. Phase 3 accepts but does not
 *   consume it. Phase 4 wires `ctx.resource(slot, init?)` over this reference.
 */
export interface RenderingContextSpec {
    readonly device: GPUDevice;
    readonly label?: string;
    readonly bufferManager?: BufferManager;
}

/**
 * Telemetry snapshot returned by `ctx.stats()`. Extended per phase: Phase 4 surfaces a
 * read-through `{bytes, leasedBytes}` view of the externally-supplied `BufferManager` (the
 * memory fields are absent when no `bufferManager` was provided). Phase 7 adds bind-group
 * cache fields. Shape is intentionally a single object so callers can spread or destructure
 * without churn.
 */
export interface RenderingContextStats {
    readonly pipelines: number;
    /** Bytes currently resident in the bound `BufferManager` (leased + free). Absent when no
     *  `bufferManager` is attached to this context. */
    readonly bytes?: number;
    /** Bytes corresponding to leased (in-use) buffers in the bound `BufferManager`. Absent
     *  when no `bufferManager` is attached. */
    readonly leasedBytes?: number;
}

/**
 * Per-kind initializer accepted by `ctx.resource(slot, init?)`. Conditional over the slot
 * variant so callers get a single overload that produces the right `Resource` subtype.
 */
export type ResourceInit<S extends ResourceSlot> = S extends UniformSlot
    ? Partial<Record<string, unknown>>
    : S extends StorageSlot
      ? Partial<Record<string, unknown>>
      : S extends TextureSlot
        ? { texture: GPUTexture; view?: GPUTextureView }
        : S extends StorageTextureSlot
          ? { texture: GPUTexture; view?: GPUTextureView }
          : S extends SamplerSlot
            ? GPUSampler | GPUSamplerDescriptor
            : S extends ExternalTextureSlot
              ? GPUExternalTexture
              : never;

/** Output `Resource` subtype for a given slot variant. */
export type ResourceFor<S extends ResourceSlot> = S extends UniformSlot
    ? BufferResource
    : S extends StorageSlot
      ? BufferResource
      : S extends TextureSlot
        ? TextureResource
        : S extends StorageTextureSlot
          ? StorageTextureResource
          : S extends SamplerSlot
            ? SamplerResource
            : S extends ExternalTextureSlot
              ? ExternalTextureResource
              : never;

/**
 * Device-scoped facade for pipeline build + (future) resource/drawable/encoder construction.
 *
 * Construct via the lowercase factory `renderingContext(spec)` to match the surrounding
 * authoring style; the class export exists for type annotations and `instanceof` checks.
 */
export class RenderingContext {
    readonly device: GPUDevice;
    readonly label?: string;
    readonly bufferManager?: BufferManager;

    private readonly _pipelineCache: Map<string, BuiltPipeline> = new Map();
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
                    init as Partial<Record<string, unknown>> | undefined
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
     * Drop every cached `BuiltPipeline` without disposing the context. Safe to call repeatedly;
     * subsequent `pipeline()` calls rebuild on demand.
     */
    disposePipelineCache(): void {
        this._pipelineCache.clear();
    }

    /**
     * Tear down everything this context owns. Idempotent. After `dispose()` further
     * `pipeline()` calls throw. **Does not** dispose the externally-supplied `bufferManager` —
     * that lifetime belongs to the caller.
     */
    dispose(): void {
        if (this._disposed) return;
        this.disposePipelineCache();
        this._disposed = true;
    }

    /** Snapshot of current cache occupancy. Cheap; suitable for HUDs / instrumentation. */
    stats(): RenderingContextStats {
        const base = { pipelines: this._pipelineCache.size };
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
 * `shader`, `struct`, etc.
 */
export function renderingContext(spec: RenderingContextSpec): RenderingContext {
    return new RenderingContext(spec);
}
