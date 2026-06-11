/**
 * Defines the `Resource` type — a metadata-only descriptor of a shader binding (uniform buffer,
 * texture, sampler, storage buffer, storage texture, external texture) that carries everything
 * needed to:
 *   1. Generate the corresponding WGSL declaration once a `{group, binding}` has been assigned.
 *   2. Construct a `GPUBindGroupLayoutEntry` for the resource.
 *
 * `Resource` implements the `DeclarationGenerator` interface from `shaders/`, so it can be dropped
 * directly into a `WgslShader`'s `declarations` array. Its `__gen()` throws until the resource has
 * been "bound" (see `bound.ts` and `bind.ts`). The shaders module never imports from this module —
 * the dependency is strictly one-way (`resources/` → `shaders/`).
 */

import type {
    SamplerBindingType,
    ShaderStageFlags,
    StorageTextureAccess,
    TextureFormat,
    TextureSampleType,
    TextureViewDimension,
} from '../native-types';
import type {
    TypeIdentifier,
    VariableOrValueAttribute,
    WgslSampler,
    WgslSamplerComparison,
    WgslTextureDataType,
} from '../shaders';

/** Brand symbol used by `isResource` to discriminate `Resource` objects at runtime. */
export const RESOURCE_BRAND = Symbol.for('vis-core.webgpu.Resource');

export type ResourceKind =
    | 'uniform'
    | 'storage'
    | 'texture'
    | 'storageTexture'
    | 'sampler'
    | 'externalTexture';

/** Fields common to every `Resource` variant. */
interface ResourceCommon {
    readonly __brand: typeof RESOURCE_BRAND;
    readonly kind: ResourceKind;
    readonly name: string;
    /**
     * Optional explicit visibility. Binding-graph traversal may union additional stages from any
     * pipelines that reference this resource; when both are present, the union is used.
     */
    readonly visibility?: ShaderStageFlags;
    /** Optional attributes applied to the variable declaration (e.g., `@align(N)`, `@size(N)`). */
    readonly attributes?: VariableOrValueAttribute[];
    /**
     * Throws unless this resource has been bound to a `{group, binding}` (see `bind()` /
     * `bindShader()`). After binding, the bound wrapper's `__gen()` returns the WGSL declaration.
     */
    __gen(): string;
}

export interface UniformResource extends ResourceCommon {
    readonly kind: 'uniform';
    readonly type: TypeIdentifier;
    /** GPUBindGroupLayoutEntry.buffer.hasDynamicOffset */
    readonly hasDynamicOffset?: boolean;
    /** GPUBindGroupLayoutEntry.buffer.minBindingSize */
    readonly minBindingSize?: number;
}

export interface StorageResource extends ResourceCommon {
    readonly kind: 'storage';
    readonly type: TypeIdentifier;
    /** WGSL storage access mode. Mirrors the optional `accessMode` of `$s.storage(...)`. */
    readonly accessMode?: 'read' | 'write' | 'read_write';
    /** GPUBindGroupLayoutEntry.buffer.hasDynamicOffset */
    readonly hasDynamicOffset?: boolean;
    /** GPUBindGroupLayoutEntry.buffer.minBindingSize */
    readonly minBindingSize?: number;
}

export interface TextureResource extends ResourceCommon {
    readonly kind: 'texture';
    readonly type: WgslTextureDataType | `texture_${string}`;
    /** GPUBindGroupLayoutEntry.texture.sampleType (default 'float') */
    readonly sampleType?: TextureSampleType;
    /** GPUBindGroupLayoutEntry.texture.viewDimension (default '2d') */
    readonly viewDimension?: TextureViewDimension;
    /** GPUBindGroupLayoutEntry.texture.multisampled (default false) */
    readonly multisampled?: boolean;
}

export interface StorageTextureResource extends ResourceCommon {
    readonly kind: 'storageTexture';
    readonly type: WgslTextureDataType | `texture_${string}`;
    /** Required: storage textures must specify a texel format. */
    readonly format: TextureFormat;
    /** GPUBindGroupLayoutEntry.storageTexture.access (default 'write-only') */
    readonly access?: StorageTextureAccess;
    /** GPUBindGroupLayoutEntry.storageTexture.viewDimension (default '2d') */
    readonly viewDimension?: TextureViewDimension;
}

export interface SamplerResource extends ResourceCommon {
    readonly kind: 'sampler';
    readonly type: WgslSampler | WgslSamplerComparison | 'sampler' | 'sampler_comparison';
    /** GPUBindGroupLayoutEntry.sampler.type (default 'filtering') */
    readonly bindingType?: SamplerBindingType;
}

export interface ExternalTextureResource extends ResourceCommon {
    readonly kind: 'externalTexture';
}

export type Resource =
    | UniformResource
    | StorageResource
    | TextureResource
    | StorageTextureResource
    | SamplerResource
    | ExternalTextureResource;

/** Runtime discriminator for `Resource` (used by `bindShader` and binding-graph traversal). */
export function isResource(value: unknown): value is Resource {
    return (
        typeof value === 'object' &&
        value !== null &&
        '__brand' in value &&
        (value as { __brand: unknown }).__brand === RESOURCE_BRAND
    );
}

function unboundGen(name: string): () => string {
    return () => {
        throw new Error(
            `Resource '${name}' must be bound to a {group, binding} before source generation; ` +
                'see bindShader() in @alleninstitute/vis-core/rendering/webgpu/resources'
        );
    };
}

// ---- Constructors -----------------------------------------------------------------------------

export type UniformResourceOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
};

export function uniformResource(
    name: string,
    type: TypeIdentifier,
    options: UniformResourceOptions = {}
): UniformResource {
    return {
        __brand: RESOURCE_BRAND,
        kind: 'uniform',
        name,
        type,
        ...options,
        __gen: unboundGen(name),
    };
}

export type StorageResourceOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    accessMode?: 'read' | 'write' | 'read_write';
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
};

export function storageResource(
    name: string,
    type: TypeIdentifier,
    options: StorageResourceOptions = {}
): StorageResource {
    return {
        __brand: RESOURCE_BRAND,
        kind: 'storage',
        name,
        type,
        ...options,
        __gen: unboundGen(name),
    };
}

export type TextureResourceOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    sampleType?: TextureSampleType;
    viewDimension?: TextureViewDimension;
    multisampled?: boolean;
};

export function textureResource(
    name: string,
    type: WgslTextureDataType | `texture_${string}`,
    options: TextureResourceOptions = {}
): TextureResource {
    return {
        __brand: RESOURCE_BRAND,
        kind: 'texture',
        name,
        type,
        ...options,
        __gen: unboundGen(name),
    };
}

export type StorageTextureResourceOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    access?: StorageTextureAccess;
    viewDimension?: TextureViewDimension;
};

export function storageTextureResource(
    name: string,
    type: WgslTextureDataType | `texture_${string}`,
    format: TextureFormat,
    options: StorageTextureResourceOptions = {}
): StorageTextureResource {
    return {
        __brand: RESOURCE_BRAND,
        kind: 'storageTexture',
        name,
        type,
        format,
        ...options,
        __gen: unboundGen(name),
    };
}

export type SamplerResourceOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    bindingType?: SamplerBindingType;
};

export function samplerResource(
    name: string,
    type: WgslSampler | WgslSamplerComparison | 'sampler' | 'sampler_comparison',
    options: SamplerResourceOptions = {}
): SamplerResource {
    return {
        __brand: RESOURCE_BRAND,
        kind: 'sampler',
        name,
        type,
        ...options,
        __gen: unboundGen(name),
    };
}

export type ExternalTextureResourceOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
};

export function externalTextureResource(
    name: string,
    options: ExternalTextureResourceOptions = {}
): ExternalTextureResource {
    return {
        __brand: RESOURCE_BRAND,
        kind: 'externalTexture',
        name,
        ...options,
        __gen: unboundGen(name),
    };
}
