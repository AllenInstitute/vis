export type { BindingMap } from './bind';
export { bindShader } from './bind';

export type { BoundSlot } from './bound';
export { bind, toBindGroupLayoutEntry } from './bound';
export type {
    ExternalTextureSlot,
    ExternalTextureSlotOptions,
    ResourceSlot,
    ResourceSlotKind,
    SamplerSlot,
    SamplerSlotOptions,
    StorageSlot,
    StorageSlotOptions,
    StorageTextureSlot,
    StorageTextureSlotOptions,
    TextureSlot,
    TextureSlotOptions,
    UniformSlot,
    UniformSlotOptions,
} from './resource';
export {
    externalTextureSlot,
    isResourceSlot,
    RESOURCE_SLOT_BRAND,
    samplerSlot,
    storageSlot,
    storageTextureSlot,
    textureSlot,
    uniformSlot,
} from './resource';
