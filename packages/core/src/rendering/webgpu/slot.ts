/**
 * `slot` — public-API factory namespace for declaring resource bindings on a shader.
 *
 * Wraps the lower-level `*Slot` constructors from `./resources/resource` with
 * type-parameterized signatures so that an explicit or inferred TypeScript shape
 * (`T`) flows through the slot, the bound graph, and ultimately the data-bearing
 * `BufferResource<T>` / `TextureResource` returned from `resource(...)` in later
 * phases. The phantom carries no runtime cost and never appears in the generated
 * WGSL.
 *
 * Each typed slot is a structural superset of its underlying `*Slot` type, so it
 * remains assignable to existing untyped consumers (binding-graph traversal,
 * `bindShader`, etc.) without any cast. Tier-1 type safety means that the buffer
 * `set()` method downstream receives `Partial<T>` rather than `Record<string, unknown>`;
 * Tier-2 (member-level inference) and Tier-3 (per-call validation) are deferred to
 * later phases but the `<T>` parameter is already in place to receive them.
 *
 * Cached `webgpu-utils.makeShaderDataDefinitions(...)` reflection — used to derive
 * runtime byte offsets for typed `set()` — is intentionally deferred to Phase 4
 * (BufferManager). For Phase 1 the typed slot is a pure type-system construct.
 */

import {
    externalTextureSlot,
    samplerSlot,
    storageSlot,
    storageTextureSlot,
    textureSlot,
    uniformSlot,
    type ExternalTextureSlot,
    type ExternalTextureSlotOptions,
    type SamplerSlot,
    type SamplerSlotOptions,
    type StorageSlot,
    type StorageSlotOptions,
    type StorageTextureSlot,
    type StorageTextureSlotOptions,
    type TextureSlot,
    type TextureSlotOptions,
    type UniformSlot,
    type UniformSlotOptions,
} from './resources/resource';
import type {
    StructDecl,
    TypeIdentifier,
    WgslSampler,
    WgslSamplerComparison,
    WgslTextureDataType,
} from './shaders';

/** A `UniformSlot` annotated with a phantom TS shape `T`. */
export type TypedUniformSlot<T = unknown> = UniformSlot & { readonly __tsShape?: T };

/** A `StorageSlot` annotated with a phantom TS shape `T`. */
export type TypedStorageSlot<T = unknown> = StorageSlot & { readonly __tsShape?: T };

/** A `TextureSlot` (no TS shape — textures are addressed by `GPUTextureView`, not host data). */
export type TypedTextureSlot = TextureSlot;

/** A `StorageTextureSlot` (no TS shape — see `TypedTextureSlot`). */
export type TypedStorageTextureSlot = StorageTextureSlot;

/** A `SamplerSlot` (no TS shape — samplers are opaque GPU objects). */
export type TypedSamplerSlot = SamplerSlot;

/** An `ExternalTextureSlot` (no TS shape — backed by a `GPUExternalTexture`). */
export type TypedExternalTextureSlot = ExternalTextureSlot;

/**
 * `slot` is the public-API namespace for declaring shader bindings. Each method
 * returns a typed slot suitable for inclusion in a `WgslShader`'s declarations
 * array and for later association with concrete GPU data via `resource(...)`.
 */
export const slot = {
    /**
     * Declare a uniform-buffer binding. When called with a `StructDecl<T>`, the
     * resulting slot carries `T` through to the data-bearing resource so that
     * `set(values)` accepts `Partial<T>`.
     */
    uniform<T = unknown>(
        name: string,
        type: StructDecl<T> | TypeIdentifier,
        options?: UniformSlotOptions
    ): TypedUniformSlot<T> {
        return uniformSlot(name, type as TypeIdentifier, options) as TypedUniformSlot<T>;
    },

    /**
     * Declare a storage-buffer binding. When called with a `StructDecl<T>`, the
     * resulting slot carries `T` for typed `set(values)` downstream.
     */
    storage<T = unknown>(
        name: string,
        type: StructDecl<T> | TypeIdentifier,
        options?: StorageSlotOptions
    ): TypedStorageSlot<T> {
        return storageSlot(name, type as TypeIdentifier, options) as TypedStorageSlot<T>;
    },

    /** Declare a sampled-texture binding (the value supplied at draw time is a `GPUTextureView`). */
    texture(
        name: string,
        type: WgslTextureDataType | `texture_${string}`,
        options?: TextureSlotOptions
    ): TypedTextureSlot {
        return textureSlot(name, type, options);
    },

    /** Declare a storage-texture binding. `format` is required by the WebGPU API. */
    storageTexture(
        name: string,
        type: WgslTextureDataType | `texture_${string}`,
        format: GPUTextureFormat,
        options?: StorageTextureSlotOptions
    ): TypedStorageTextureSlot {
        return storageTextureSlot(name, type, format, options);
    },

    /** Declare a sampler binding. */
    sampler(
        name: string,
        type: WgslSampler | WgslSamplerComparison | 'sampler' | 'sampler_comparison',
        options?: SamplerSlotOptions
    ): TypedSamplerSlot {
        return samplerSlot(name, type, options);
    },

    /** Declare an external-texture binding (e.g. `<video>` or `ImageBitmap`). */
    external(name: string, options?: ExternalTextureSlotOptions): TypedExternalTextureSlot {
        return externalTextureSlot(name, options);
    },
} as const;
