// ---- Shaders ----------------------------------------------------------------------------------

export type { StructDecl, StructDeclaration, StructMemberDeclaration, WgslShader } from './shaders';
export {
    asSource,
    builtin,
    fragmentEntry,
    isWgslShader,
    location,
    member,
    param,
    returns,
    shader,
    struct,
    vertexEntry,
} from './shaders';

// ---- Declarative vertex inputs ----------------------------------------------------------------

export type {
    VertexAttributeDecl,
    VertexAttributeRef,
    VertexBufferDecl,
    VertexBufferSpec,
    VertexLayoutDeclaration,
} from './pipelines/vertex-layout';
/** Buffer grouping + `stepMode` + per-attribute format → `GPUVertexBufferLayout[]`
 *  (see `pipeline({ vertex: { layout } })`) and the typed drawable upload path. */
export { buffer, isVertexLayout, VERTEX_LAYOUT_BRAND, vertexLayout } from './pipelines/vertex-layout';
export type { VertexArrayKind, VertexComponentType, VertexFormatInfo } from './shaders/vertex-format';
/** `GPUVertexFormat` metadata + the natural WGSL-type → format default. */
export { defaultVertexFormat, VERTEX_FORMAT_INFO, vertexFormatInfo } from './shaders/vertex-format';
export type {
    VertexInputAttribute,
    VertexInputBuiltin,
    VertexInputBuiltinName,
    VertexInputInterface,
} from './shaders/vertex-interface';
/** The vertex shader *input interface*: ordinary `struct`s + loose `param`s (incl. builtins),
 *  validated up front. Feeds `vertexEntry(...)` and is grouped into buffers by `vertexLayout(...)`. */
export { isVertexInput, VERTEX_INPUT_BUILTINS, vertexInput } from './shaders/vertex-interface';
export type {
    TypedExternalTextureSlot,
    TypedSamplerSlot,
    TypedStorageSlot,
    TypedStorageTextureSlot,
    TypedTextureSlot,
    TypedUniformSlot,
} from './slot';
export { slot } from './slot';

// ---- Binding graphs + pipeline state ----------------------------------------------------------

export type { BindingGraph, BindingGroup, GroupSpec } from './pipelines/binding-graph';
export { bindings, group, isBindingGraph, isBindingGroup } from './pipelines/binding-graph';
export type {
    FragmentStateDescriptor,
    NormalizedPipelineState,
    PipelineStateDescriptor,
    VertexStateDescriptor,
} from './pipelines/pipeline-state';
export { resolveShaderBindings, shaderSlotEntries } from './pipelines/traverse';

// ---- Rendering context, resources, drawables, scenes ------------------------------------------

/** Device-scoped facade — owns the pipeline cache, buffer manager, and encoder hooks. */
export { renderingContext } from './context';
export type {
    RenderingContext,
    RenderingContextSpec,
    RenderingContextStats,
    ResourceFor,
    ResourceInit,
} from './context-types';
export type {
    BufferResource,
    ExternalTextureResource,
    RawBufferResource,
    Resource,
    SamplerResource,
    StorageTextureResource,
    TextureResource,
} from './data/resource';
/** Data-bearing `Resource` family. `ctx.resource(slot, init?)` is the public constructor; the
 *  raw factories are kept private to `RenderingContext` so all construction funnels through one
 *  place (consistent error wording, telemetry). */
export { isResource, RESOURCE_BRAND } from './data/resource';
export type {
    ArrayDrawCall,
    Drawable,
    DrawableReuseSpec,
    DrawableSpec,
    DrawCall,
    IndexBufferBinding,
    IndexData,
    IndexedDrawCall,
    PreBuiltIndexData,
    PreBuiltVertexData,
    RawArrayIndexData,
    RawArraysVertexData,
    TypedVertexData,
    VertexBufferBinding,
    VertexData,
} from './drawable';
/** A `Drawable` is a pipeline + resource set + draw-call descriptor. Construct via
 *  `ctx.drawable({...})`. */
export { DRAWABLE_BRAND, isDrawable } from './drawable';
export type { EncoderStats, GraphEncoder } from './encoder/encoder';
// Encoder / submit live on `RenderingContext` (ctx.encoder() + ctx.submit(scene)).
export { GRAPH_ENCODER_BRAND, isGraphEncoder } from './encoder/encoder';
export type { BufferManager } from './memory';
/** A concrete `BufferManager` for `renderingContext({ bufferManager })`. */
export { BatchPoolBufferAdapter } from './memory';
/** `BuiltPipeline` is the artefact returned by `RenderingContext.pipeline()`. */
export type { BuiltPipeline } from './pipelines/build';
export type { ScissorSpec, ViewportSpec } from './scene/scene';
/** A `Scene` is the retained-mode tree of drawables submitted for rendering. */
export {
    blendconstant,
    container,
    draw,
    override,
    scene,
    scissor,
    stencilref,
    viewport,
} from './scene/scene';
export type {
    BindingOverrideNode,
    BlendConstantNode,
    CompositeSceneNode,
    ContainerNode,
    DrawableNode,
    NodeId,
    RenderTarget,
    Scene,
    SceneDescriptor,
    SceneEvent,
    SceneEventListener,
    SceneNode,
    ScissorNode,
    StencilRefNode,
    StructureChangedEvent,
    ViewportNode,
} from './scene/types';
export {
    isScene,
    isSceneNode,
    SCENE_BRAND,
    SCENE_NODE_BRAND,
} from './scene/types';
