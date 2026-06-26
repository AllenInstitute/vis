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

// ---- Phase 2: DAG bindings + traversal --------------------------------------------------------

export { bindings, binding, group as bindingGroup, isBindingGraph } from './pipelines/binding-graph';
export type {
    BindingGraph,
    BindingsDescriptor,
    GroupDescriptor,
    GroupNode,
    SlotDescriptor,
    SlotNode,
} from './pipelines/binding-graph';
export { resolveShaderBindings, shaderSlotEntries } from './pipelines/traverse';

// ---- Phase 3: Pipeline / Drawable / Scene authoring -------------------------------------------

/** Phase 3: declarative pipeline factory (replaces the legacy `pipelines/binding-graphs` pipeline()). */
export const pipeline: unknown = undefined;

/** Phase 3: bind a typed slot to a data-bearing `Resource` (buffer/texture/sampler). */
export const resource: unknown = undefined;

/** Phase 3: a `Drawable` is a pipeline + resource set + draw-call descriptor. */
export const drawable: unknown = undefined;

/** Phase 3: a `Scene` is the v1 replacement for the legacy `Graph` of drawables. */
export const scene: unknown = undefined;

// ---- Phase 6: Encoder state ops ----------------------------------------------------------------

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
/** Phase 6: low-level encoder primitive (advanced authoring escape hatch). */
export const encoder: unknown = undefined;
/** Phase 6: `submit(scene, ...)` — the top-level frame command. */
export const submit: unknown = undefined;
