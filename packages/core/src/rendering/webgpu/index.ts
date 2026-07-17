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
