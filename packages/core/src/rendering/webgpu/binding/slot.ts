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
import { isBranded } from '../brand';

/** Brand symbol used by `isResourceSlot` to discriminate `ResourceSlot` objects at runtime. */
export const RESOURCE_SLOT_BRAND = Symbol.for('vis-core.webgpu.ResourceSlot');

export type ResourceSlotKind =
    | 'uniform'
    | 'storage'
    | 'texture'
    | 'storageTexture'
    | 'sampler'
    | 'externalTexture';

/** Fields common to every `ResourceSlot` variant. */
interface ResourceSlotCommon {
    readonly __brand: typeof RESOURCE_SLOT_BRAND;
    readonly kind: ResourceSlotKind;
    readonly name: string;
    /**
     * Optional explicit visibility. Binding-graph traversal may union additional stages from any
     * pipelines that reference this slot; when both are present, the union is used.
     */
    readonly visibility?: ShaderStageFlags;
    /** Optional attributes applied to the variable declaration (e.g., `@align(N)`, `@size(N)`). */
    readonly attributes?: VariableOrValueAttribute[];
    /**
     * Throws unless this slot has been bound to a `{group, binding}` (see `bind()` /
     * `bindShader()`). After binding, the bound wrapper's `__gen()` returns the WGSL declaration.
     */
    __gen(): string;
}

export interface UniformSlot extends ResourceSlotCommon {
    readonly kind: 'uniform';
    readonly type: TypeIdentifier;
    /** GPUBindGroupLayoutEntry.buffer.hasDynamicOffset */
    readonly hasDynamicOffset?: boolean;
    /** GPUBindGroupLayoutEntry.buffer.minBindingSize */
    readonly minBindingSize?: number;
}

export interface StorageSlot extends ResourceSlotCommon {
    readonly kind: 'storage';
    readonly type: TypeIdentifier;
    /** WGSL storage access mode. Mirrors the optional `accessMode` of `$s.storage(...)`. */
    readonly accessMode?: 'read' | 'write' | 'read_write';
    /** GPUBindGroupLayoutEntry.buffer.hasDynamicOffset */
    readonly hasDynamicOffset?: boolean;
    /** GPUBindGroupLayoutEntry.buffer.minBindingSize */
    readonly minBindingSize?: number;
}

export interface TextureSlot extends ResourceSlotCommon {
    readonly kind: 'texture';
    readonly type: WgslTextureDataType | `texture_${string}`;
    /** GPUBindGroupLayoutEntry.texture.sampleType (default 'float') */
    readonly sampleType?: TextureSampleType;
    /** GPUBindGroupLayoutEntry.texture.viewDimension (default '2d') */
    readonly viewDimension?: TextureViewDimension;
    /** GPUBindGroupLayoutEntry.texture.multisampled (default false) */
    readonly multisampled?: boolean;
}

export interface StorageTextureSlot extends ResourceSlotCommon {
    readonly kind: 'storageTexture';
    readonly type: WgslTextureDataType | `texture_${string}`;
    /** Required: storage textures must specify a texel format. */
    readonly format: TextureFormat;
    /** GPUBindGroupLayoutEntry.storageTexture.access (default 'write-only') */
    readonly access?: StorageTextureAccess;
    /** GPUBindGroupLayoutEntry.storageTexture.viewDimension (default '2d') */
    readonly viewDimension?: TextureViewDimension;
}

export interface SamplerSlot extends ResourceSlotCommon {
    readonly kind: 'sampler';
    readonly type: WgslSampler | WgslSamplerComparison | 'sampler' | 'sampler_comparison';
    /** GPUBindGroupLayoutEntry.sampler.type (default 'filtering') */
    readonly bindingType?: SamplerBindingType;
}

export interface ExternalTextureSlot extends ResourceSlotCommon {
    readonly kind: 'externalTexture';
}

export type ResourceSlot =
    | UniformSlot
    | StorageSlot
    | TextureSlot
    | StorageTextureSlot
    | SamplerSlot
    | ExternalTextureSlot;

/** Runtime discriminator for `ResourceSlot` (used by `bindShader` and binding-graph traversal). */
export function isResourceSlot(value: unknown): value is ResourceSlot {
    return isBranded(value, RESOURCE_SLOT_BRAND);
}

function unboundGen(name: string): () => string {
    return () => {
        throw new Error(
            `ResourceSlot '${name}' must be bound to a {group, binding} before source generation; ` +
                'see bindShader() in @alleninstitute/vis-core/rendering/webgpu/resources'
        );
    };
}

// ---- Constructors -----------------------------------------------------------------------------

export type UniformSlotOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
};

export function uniformSlot(
    name: string,
    type: TypeIdentifier,
    options: UniformSlotOptions = {}
): UniformSlot {
    return {
        __brand: RESOURCE_SLOT_BRAND,
        kind: 'uniform',
        name,
        type,
        ...options,
        __gen: unboundGen(name),
    };
}

export type StorageSlotOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    accessMode?: 'read' | 'write' | 'read_write';
    hasDynamicOffset?: boolean;
    minBindingSize?: number;
};

export function storageSlot(
    name: string,
    type: TypeIdentifier,
    options: StorageSlotOptions = {}
): StorageSlot {
    return {
        __brand: RESOURCE_SLOT_BRAND,
        kind: 'storage',
        name,
        type,
        ...options,
        __gen: unboundGen(name),
    };
}

export type TextureSlotOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    sampleType?: TextureSampleType;
    viewDimension?: TextureViewDimension;
    multisampled?: boolean;
};

export function textureSlot(
    name: string,
    type: WgslTextureDataType | `texture_${string}`,
    options: TextureSlotOptions = {}
): TextureSlot {
    return {
        __brand: RESOURCE_SLOT_BRAND,
        kind: 'texture',
        name,
        type,
        ...options,
        __gen: unboundGen(name),
    };
}

export type StorageTextureSlotOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    access?: StorageTextureAccess;
    viewDimension?: TextureViewDimension;
};

export function storageTextureSlot(
    name: string,
    type: WgslTextureDataType | `texture_${string}`,
    format: TextureFormat,
    options: StorageTextureSlotOptions = {}
): StorageTextureSlot {
    return {
        __brand: RESOURCE_SLOT_BRAND,
        kind: 'storageTexture',
        name,
        type,
        format,
        ...options,
        __gen: unboundGen(name),
    };
}

export type SamplerSlotOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
    bindingType?: SamplerBindingType;
};

export function samplerSlot(
    name: string,
    type: WgslSampler | WgslSamplerComparison | 'sampler' | 'sampler_comparison',
    options: SamplerSlotOptions = {}
): SamplerSlot {
    return {
        __brand: RESOURCE_SLOT_BRAND,
        kind: 'sampler',
        name,
        type,
        ...options,
        __gen: unboundGen(name),
    };
}

export type ExternalTextureSlotOptions = {
    visibility?: ShaderStageFlags;
    attributes?: VariableOrValueAttribute[];
};

export function externalTextureSlot(
    name: string,
    options: ExternalTextureSlotOptions = {}
): ExternalTextureSlot {
    return {
        __brand: RESOURCE_SLOT_BRAND,
        kind: 'externalTexture',
        name,
        ...options,
        __gen: unboundGen(name),
    };
}
