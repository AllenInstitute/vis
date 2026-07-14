import type { BufferManager } from '../memory';
import type {
    BufferResource,
    ExternalTextureResource,
    ExternalTextureSlot,
    Resource,
    ResourceSlot,
    SamplerResource,
    SamplerSlot,
    StorageSlot,
    StorageTextureResource,
    StorageTextureSlot,
    TextureResource,
    TextureSlot,
    UniformSlot,
} from '../resources';
import type { WgslShader } from '../shaders';
import type { Drawable, DrawableSpec } from './drawable';
import type { GraphEncoder } from './encoder/encoder';
import type { BindingGraph } from './pipelines/binding-graph';
import type { BuiltPipeline } from './pipelines/build';
import type { PipelineStateDescriptor } from './pipelines/pipeline-state';
import type { RenderTarget } from './render-target';
import type { Scene } from './scene/types';

/**
 * Spec passed to `renderingContext()`.
 *
 * - `device`: the `GPUDevice` every built pipeline targets.
 * - `label`: optional debug label; surfaces in error messages (e.g. use-after-dispose).
 * - `bufferManager`: optional, user-constructed `BufferManager`. Backs `ctx.resource(slot, init?)`
 *   and buffer-backed drawable geometry.
 */
export interface RenderingContextSpec {
    readonly device: GPUDevice;
    readonly label?: string;
    readonly bufferManager?: BufferManager;
}

/**
 * Telemetry snapshot returned by `ctx.stats()`. When a `BufferManager` is attached, surfaces a
 * read-through `{bytes, leasedBytes}` view of it (both absent otherwise), plus the bind-group
 * cache size. Shape is intentionally a single object so callers can spread or destructure
 * without churn.
 */
export interface RenderingContextStats {
    readonly pipelines: number;
    /** Number of `GPUBindGroup`s currently cached on this context. */
    readonly bindGroups: number;
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
 * Device-scoped facade for pipeline build + resource / drawable / encoder construction.
 *
 * This is the **public interface**; the concrete implementation is `RenderingContextImpl` in
 * `context.ts`, constructed via the lowercase factory `renderingContext(spec)`. Leaf modules
 * depend on this interface rather than the class to keep the module graph acyclic.
 */
export interface RenderingContext {
    readonly device: GPUDevice;
    readonly label?: string;
    readonly bufferManager?: BufferManager;

    /** Number of `BuiltPipeline`s currently cached on this instance. */
    readonly pipelineCount: number;
    /** `true` once `dispose()` has been called. Further `pipeline()` calls will throw. */
    readonly disposed: boolean;

    /**
     * Build (or return a cached) `BuiltPipeline` for `(graph, shader, state)` against this
     * context's device. Identical inputs return the same instance; differing state (after
     * canonical normalization) produces a distinct entry.
     */
    pipeline(
        graph: BindingGraph,
        shader: WgslShader,
        state: PipelineStateDescriptor
    ): BuiltPipeline;

    /**
     * Construct a data-bearing `Resource` for `slot`. Dispatches on `slot.kind`; requires a
     * `bufferManager` for buffer-backed slot kinds. The resource is owned by this context and
     * released automatically on `ctx.dispose()`.
     */
    resource<S extends ResourceSlot>(slot: S, init?: ResourceInit<S>): ResourceFor<S>;

    /**
     * Construct a `Drawable` — a pipeline + vertex / index / binding resources + draw call —
     * against this context. The drawable is owned by this context (released on `ctx.dispose()`)
     * and by any `Scene` it is added to (released when removed).
     */
    drawable(spec: DrawableSpec): Drawable;

    /** Construct (or return the cached) `GraphEncoder` bound to this context. */
    encoder(): GraphEncoder;

    /** Encode + submit `scene` to `target` on the device queue in one call. */
    submit(scene: Scene, target: RenderTarget): GPUCommandBuffer;

    /** Drop every cached `BuiltPipeline` without disposing the context. */
    disposePipelineCache(): void;

    /** Drop every cached `GPUBindGroup` without disposing the context. */
    disposeBindGroupCache(): void;

    /**
     * Selectively drop the cached `GPUBindGroup`s referencing any of `resources`, leaving other
     * entries intact. Resources built via `ctx.resource()` trigger this automatically on
     * `commit()` / `destroy()`. Returns the number of bind groups removed.
     */
    sweepBindGroups(resources: readonly Resource[]): number;

    /**
     * Tear down everything this context owns. Idempotent. Does **not** dispose the
     * externally-supplied `bufferManager` — that lifetime belongs to the caller.
     */
    dispose(): void;

    /** Snapshot of current cache occupancy. Cheap; suitable for HUDs / instrumentation. */
    stats(): RenderingContextStats;
}
