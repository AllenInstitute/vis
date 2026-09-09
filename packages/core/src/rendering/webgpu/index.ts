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

export { attrs, decls, types } from './shaders';

export type {
    VertexArrayKind,
    VertexComponentType,
    VertexFormatInfo,
    VertexInputAttribute,
    VertexInputBuiltin,
    VertexInputBuiltinName,
    VertexInputInterface,
} from './shaders';

export {
    defaultVertexFormat,
    isVertexInput,
    VERTEX_FORMAT_INFO,
    VERTEX_INPUT_BUILTINS,
    vertexFormatInfo,
    vertexInput,
} from './shaders';

// ---- Memory -----------------------------------------------------------------------------------

/** The GPU buffer-pooling interface. Implementations hand out `BufferHandle`s backed by pooled,
 *  suballocated slabs so that many small resources share a few large `GPUBuffer`s. */
export type { BufferManager } from './memory';
/** A concrete `BufferManager` backed by size-bucketed slab pools. */
export { BatchPoolBufferManager } from './memory';

// ---- Resource slots ---------------------------------------------------------------------------

/** Slot constructors, annotated with a phantom TS shape so host-side writes are type-checked
 *  against the WGSL struct they target. */
export type {
    TypedExternalTextureSlot,
    TypedSamplerSlot,
    TypedStorageSlot,
    TypedStorageTextureSlot,
    TypedTextureSlot,
    TypedUniformSlot,
} from './resources';
export { slot } from './resources';

// ---- Resources --------------------------------------------------------------------------------

/** Data-bearing `Resource` family — the concrete bindable values a slot can be filled with. */
export type {
    BufferResource,
    ExternalTextureResource,
    RawBufferResource,
    Resource,
    SamplerResource,
    StorageTextureResource,
    TextureResource,
} from './resources';
export { isResource, RESOURCE_BRAND } from './resources';

// ---- Declarative vertex inputs ----------------------------------------------------------------

/** Buffer grouping + `stepMode` + per-attribute format → `GPUVertexBufferLayout[]`, consumed by
 *  `pipeline({ vertex: { layout } })` and the typed drawable upload path. */
export type {
    VertexAttributeDecl,
    VertexAttributeRef,
    VertexBufferDecl,
    VertexBufferSpec,
    VertexLayoutDeclaration,
} from './renderer';
export { buffer, isVertexLayout, VERTEX_LAYOUT_BRAND, vertexLayout } from './renderer';

// ---- Binding graphs + pipeline state ----------------------------------------------------------

/** A `BindingGraph` assigns resource slots to `@group`/`@binding` positions; the pipeline-state
 *  descriptors normalize the remaining `GPURenderPipeline` knobs ahead of compilation. */
export type {
    BindingGraph,
    BindingGroup,
    FragmentStateDescriptor,
    GroupSpec,
    NormalizedPipelineState,
    PipelineStateDescriptor,
    VertexStateDescriptor,
} from './renderer';
export { bindings, group, isBindingGraph, isBindingGroup, resolveShaderBindings, shaderSlotEntries } from './renderer';

// ---- Render target ----------------------------------------------------------------------------

/** The per-submit render-pass destination. */
export type { RenderTarget } from './renderer';

// ---- Rendering context, drawables, scenes -----------------------------------------------------

/** `BuiltPipeline` is the artefact returned by `RenderingContext.pipeline()`. A `Drawable` is a
 *  pipeline + resource set + draw-call descriptor, built via `ctx.drawable({...})`. A `Scene` is
 *  the retained-mode tree of drawables submitted for rendering. Encoding and submission live on
 *  `RenderingContext` (`ctx.encoder()` / `ctx.submit(scene, target)`). */
export type {
    ArrayDrawCall,
    BindingOverrideNode,
    BlendConstantNode,
    BuiltPipeline,
    CompositeSceneNode,
    ContainerNode,
    Drawable,
    DrawableNode,
    DrawableReuseSpec,
    DrawableSpec,
    DrawCall,
    EncoderStats,
    GraphEncoder,
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
    RenderingContextStats,
    ResourceFor,
    ResourceInit,
    Scene,
    SceneDescriptor,
    SceneEvent,
    SceneEventListener,
    SceneNode,
    ScissorNode,
    ScissorSpec,
    StencilRefNode,
    StructureChangedEvent,
    TypedVertexData,
    VertexBufferBinding,
    VertexData,
    ViewportNode,
    ViewportSpec,
} from './renderer';
/** Device-scoped facade — owns the pipeline cache, buffer manager, and encoder hooks. */
export {
    blendconstant,
    container,
    DRAWABLE_BRAND,
    draw,
    GRAPH_ENCODER_BRAND,
    isDrawable,
    isGraphEncoder,
    isScene,
    isSceneNode,
    override,
    renderingContext,
    SCENE_BRAND,
    SCENE_NODE_BRAND,
    scene,
    scissor,
    stencilref,
    viewport,
} from './renderer';
