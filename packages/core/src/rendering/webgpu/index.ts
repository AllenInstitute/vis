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
export { RenderingContext, renderingContext } from './context';
export type { RenderingContextSpec, RenderingContextStats } from './context';

/** Phase 3: `BuiltPipeline` is the artefact returned by `RenderingContext.pipeline()`. */
export type { BuiltPipeline } from './pipelines/build';

/** Phase 4: bind a typed slot to a data-bearing `Resource` (buffer/texture/sampler). */
export const resource: unknown = undefined;

/** Phase 5: a `Drawable` is a pipeline + resource set + draw-call descriptor. */
export const drawable: unknown = undefined;

/** Phase 6: a `Scene` is the v1 replacement for the legacy `Graph` of drawables. */
export const scene: unknown = undefined;

// ---- Phase 6: Scene state-node factories -------------------------------------------------------

/** Phase 6: viewport state command. */
export const viewport: unknown = undefined;
/** Phase 6: scissor state command. */
export const scissor: unknown = undefined;
/** Phase 6: stencil-reference state command. */
export const stencilref: unknown = undefined;
/** Phase 6: blend-constant state command. */
export const blendconstant: unknown = undefined;
/** Phase 6: composite container that scopes encoder state to a sub-tree of drawables. */
export const container: unknown = undefined;
/** Phase 6: override-pipeline-constant command. */
export const override: unknown = undefined;
/** Phase 6: explicit draw-call command (used inside containers). */
export const draw: unknown = undefined;

// ---- Phase 7: encoder / submit live on `RenderingContext` (ctx.encoder() + ctx.submit(scene)).
