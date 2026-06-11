export type { BindingMap } from './bind';
export { bindShader } from './bind';

export type { BoundResource } from './bound';
export { bind, toBindGroupLayoutEntry } from './bound';
export type {
    ExternalTextureResource,
    ExternalTextureResourceOptions,
    Resource,
    ResourceKind,
    SamplerResource,
    SamplerResourceOptions,
    StorageResource,
    StorageResourceOptions,
    StorageTextureResource,
    StorageTextureResourceOptions,
    TextureResource,
    TextureResourceOptions,
    UniformResource,
    UniformResourceOptions,
} from './resource';
export {
    externalTextureResource,
    isResource,
    RESOURCE_BRAND,
    samplerResource,
    storageResource,
    storageTextureResource,
    textureResource,
    uniformResource,
} from './resource';
