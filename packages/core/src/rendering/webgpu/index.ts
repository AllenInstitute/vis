/**
 * Public API for the WebGPU renderer subsystem.
 *
 * This top-level barrel is the ONLY file at the root of `rendering/webgpu`. It composes the
 * five module barrels — `foundation`, `shaders`, `memory`, `resources`, `renderer` — into the
 * curated public surface. Each module is independently importable from its own subpath; this
 * meta-barrel is the convenience aggregate that external consumers use.
 */

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
} from './renderer';
/** Buffer grouping + `stepMode` + per-attribute format → `GPUVertexBufferLayout[]`
 *  (see `pipeline({ vertex: { layout } })`) and the typed drawable upload path. */
export { buffer, isVertexLayout, VERTEX_LAYOUT_BRAND, vertexLayout } from './renderer';
export type {
    TypedExternalTextureSlot,
    TypedSamplerSlot,
    TypedStorageSlot,
    TypedStorageTextureSlot,
    TypedTextureSlot,
    TypedUniformSlot,
} from './resources';
export { slot } from './resources';
export type { VertexArrayKind, VertexComponentType, VertexFormatInfo, 
    VertexInputAttribute,
    VertexInputBuiltin,
    VertexInputBuiltinName,
    VertexInputInterface,} from './shaders';
/** `GPUVertexFormat` metadata + the natural WGSL-type → format default. */
/** The vertex shader *input interface*: ordinary `struct`s + loose `param`s (incl. builtins),
 *  validated up front. Feeds `vertexEntry(...)` and is grouped into buffers by `vertexLayout(...)`. */
export { defaultVertexFormat, isVertexInput, VERTEX_FORMAT_INFO, VERTEX_INPUT_BUILTINS, vertexFormatInfo, vertexInput } from './shaders';

// ---- Binding graphs + pipeline state ----------------------------------------------------------

export type { BindingGraph, BindingGroup, 
    FragmentStateDescriptor,GroupSpec, 
    NormalizedPipelineState,
    PipelineStateDescriptor,
    VertexStateDescriptor,} from './renderer';
export { bindings, group, isBindingGraph, isBindingGroup, resolveShaderBindings, shaderSlotEntries } from './renderer';

// ---- Rendering context, resources, drawables, scenes ------------------------------------------

export type { BufferManager } from './memory';
/** A concrete `BufferManager` for `renderingContext({ bufferManager })`. */
export { BatchPoolBufferAdapter } from './memory';
/** `BuiltPipeline` is the artefact returned by `RenderingContext.pipeline()`. */
/** A `RenderTarget` is the per-submit render-pass destination passed to `ctx.submit(scene, target)`. */
export type {
    ArrayDrawCall,
    BindingOverrideNode,
    BlendConstantNode,BuiltPipeline, 
    CompositeSceneNode,
    ContainerNode,
    Drawable,
    DrawableNode,
    DrawableReuseSpec,
    DrawableSpec,
    DrawCall,EncoderStats, GraphEncoder, 
    IndexBufferBinding,
    IndexData,
    IndexedDrawCall,
    NodeId,
    PreBuiltIndexData,
    PreBuiltVertexData,
    RawArrayIndexData,
    RawArraysVertexData,
    RenderingContext,
    RenderingContextSpec,
    RenderingContextStats,RenderTarget, 
    ResourceFor,
    ResourceInit,
    Scene,
    SceneDescriptor,
    SceneEvent,
    SceneEventListener,
    SceneNode,
    ScissorNode,ScissorSpec, 
    StencilRefNode,
    StructureChangedEvent,
    TypedVertexData,
    VertexBufferBinding,
    VertexData,
    ViewportNode,ViewportSpec, 
} from './renderer';
/** Device-scoped facade — owns the pipeline cache, buffer manager, and encoder hooks. */
/** A `Drawable` is a pipeline + resource set + draw-call descriptor. Construct via
 *  `ctx.drawable({...})`. */
// Encoder / submit live on `RenderingContext` (ctx.encoder() + ctx.submit(scene)).
/** A `Scene` is the retained-mode tree of drawables submitted for rendering. */
export { 
    blendconstant,
    container,DRAWABLE_BRAND, 
    draw,GRAPH_ENCODER_BRAND, isDrawable, isGraphEncoder, isScene, isSceneNode, 
    override,renderingContext, SCENE_BRAND, SCENE_NODE_BRAND, 
    scene,
    scissor,
    stencilref,
    viewport} from './renderer';
export type {
    BufferResource,
    ExternalTextureResource,
    RawBufferResource,
    Resource,
    SamplerResource,
    StorageTextureResource,
    TextureResource,
} from './resources';
/** Data-bearing `Resource` family. `ctx.resource(slot, init?)` is the public constructor; the
 *  raw factories are kept private to `RenderingContext` so all construction funnels through one
 *  place (consistent error wording, telemetry). */
export { isResource, RESOURCE_BRAND } from './resources';
