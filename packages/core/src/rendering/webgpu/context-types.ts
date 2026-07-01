/**
 * Type-only companion to `context.ts`.
 *
 * Houses the public `RenderingContext` **interface** (plus its spec / stats / resource-init
 * shapes) so that leaf modules like `drawable.ts` and `encoder/encoder.ts` can depend on the
 * context's shape without importing the concrete `RenderingContextImpl` class — which would
 * form a runtime import cycle (`context.ts` already imports those modules for their builders).
 *
 * Every import here is `type`-only; this module contributes no runtime code and therefore
 * cannot participate in a runtime cycle.
 */

import type {
    BufferResource,
    ExternalTextureResource,
    Resource,
    SamplerResource,
    StorageTextureResource,
    TextureResource,
} from './data/resource';
import type { Drawable, DrawableSpec } from './drawable';
import type { GraphEncoder } from './encoder/encoder';
import type { BufferManager } from './memory/types';
import type { BindingGraph } from './pipelines/binding-graph';
import type { BuiltPipeline } from './pipelines/build';
import type { PipelineStateDescriptor } from './pipelines/pipeline-state';
import type {
    ExternalTextureSlot,
    ResourceSlot,
    SamplerSlot,
    StorageSlot,
    StorageTextureSlot,
    TextureSlot,
    UniformSlot,
} from './resources/resource';
import type { Scene } from './scene/types';
import type { WgslShader } from './shaders';

/**
 * Spec passed to `renderingContext()`.
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
    /** Number of `GPUBindGroup`s currently cached on this context (Phase 7). */
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
     * `bufferManager` for buffer-backed slot kinds. The returned resource starts with
     * `refcount === 1` — pair every call with exactly one `destroy()`.
     */
    resource<S extends ResourceSlot>(slot: S, init?: ResourceInit<S>): ResourceFor<S>;

    /**
     * Construct a `Drawable` — a pipeline + vertex / index / binding resources + draw call —
     * against this context. Pair every call with exactly one `drawable.destroy()`.
     */
    drawable(spec: DrawableSpec): Drawable;

    /** Construct (or return the cached) `GraphEncoder` bound to this context. */
    encoder(): GraphEncoder;

    /** Encode + submit `scene` to the device queue in one call. */
    submit(scene: Scene): GPUCommandBuffer;

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
