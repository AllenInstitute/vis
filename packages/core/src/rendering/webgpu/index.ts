/**
 * Public barrel for `@alleninstitute/vis-core/rendering/webgpu`.
 *
 * This module re-exports the v1 authoring surface — the declarative API used by
 * example/application code to describe shaders, bindings, pipelines, drawables,
 * and scenes — and intentionally does NOT re-export internal helpers (binding-graph
 * traversal, bind-group cache keys, slab BufferHandle plumbing, etc.). Consumers
 * should depend on the symbols below; everything else is implementation detail.
 *
 * The surface is being built out phase-by-phase per `plan-2026-06-25.md`. Symbols
 * that are not yet implemented are exported here as `unknown` stubs so downstream
 * code can begin to import them without breaking the build; each stub will be
 * replaced with the real implementation in the phase that defines it.
 */

// ---- Implemented in Phase 1 -------------------------------------------------------------------

export { slot } from './slot';
export type {
    TypedExternalTextureSlot,
    TypedSamplerSlot,
    TypedStorageSlot,
    TypedStorageTextureSlot,
    TypedTextureSlot,
    TypedUniformSlot,
} from './slot';

export { asSource, isWgslShader, member, shader, struct } from './shaders';
export type { StructDecl, StructDeclaration, StructMemberDeclaration, WgslShader } from './shaders';

// ---- Phase 2: derived BindingGraph ------------------------------------------------------------

export { bindings, group, isBindingGraph, isBindingGroup } from './pipelines/binding-graph';
export type { BindingGraph, BindingGroup, GroupSpec } from './pipelines/binding-graph';
export { resolveShaderBindings, shaderSlotEntries } from './pipelines/traverse';
export type {
    FragmentStateDescriptor,
    NormalizedPipelineState,
    PipelineStateDescriptor,
    VertexStateDescriptor,
} from './pipelines/pipeline-state';

// ---- Phase 3: Pipeline / Drawable / Scene authoring -------------------------------------------

/** Phase 3: device-scoped facade — owns the pipeline cache (and, per phase, BufferManager / encoder hooks). */
export { renderingContext } from './context';
export type {
    RenderingContext,
    RenderingContextSpec,
    RenderingContextStats,
    ResourceFor,
    ResourceInit,
} from './context-types';

/** Phase 3: `BuiltPipeline` is the artefact returned by `RenderingContext.pipeline()`. */
export type { BuiltPipeline } from './pipelines/build';

/** Phase 4: data-bearing `Resource` family. `ctx.resource(slot, init?)` is the public
 *  constructor; the raw factories are kept private to `RenderingContext` so all construction
 *  funnels through one place (consistent error wording, future telemetry, etc.). */
export { isResource, RESOURCE_BRAND } from './data/resource';
export type {
    BufferResource,
    ExternalTextureResource,
    RawBufferResource,
    Resource,
    SamplerResource,
    StorageTextureResource,
    TextureResource,
} from './data/resource';

/** Phase 5: a `Drawable` is a pipeline + resource set + draw-call descriptor. Construct via
 *  `ctx.drawable({...})`. */
export { DRAWABLE_BRAND, isDrawable } from './drawable';
export type {
    ArrayDrawCall,
    Drawable,
    DrawableReuseSpec,
    DrawableSpec,
    DrawCall,
    IndexBufferBinding,
    IndexInput,
    IndexedDrawCall,
    PreBuiltIndexInput,
    PreBuiltVertexInput,
    RawArrayIndexInput,
    RawArraysVertexInput,
    VertexBufferBinding,
    VertexInput,
} from './drawable';

/** Phase 6: a `Scene` is the v1 replacement for the legacy `Graph` of drawables. */
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
export type { ScissorSpec, ViewportSpec } from './scene/scene';
export {
    isScene,
    isSceneNode,
    SCENE_BRAND,
    SCENE_NODE_BRAND,
} from './scene/types';
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

// ---- Phase 7: encoder / submit live on `RenderingContext` (ctx.encoder() + ctx.submit(scene)).
export { GRAPH_ENCODER_BRAND, isGraphEncoder } from './encoder/encoder';
export type { EncoderStats, GraphEncoder } from './encoder/encoder';
