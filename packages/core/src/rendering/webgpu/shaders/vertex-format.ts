import type { VertexFormat } from '../foundation';
import { vec, type WgslNumericScalarType, type WgslVecSize, wgslTypeName } from './wgsl-types';

/** The WGSL component scalar types a vertex format's shader-visible type can have. Alias of
 *  `WgslNumericScalarType` so the vertex layer and the WGSL type model share one definition. */
export type VertexComponentType = WgslNumericScalarType;

/** Which host-side `TypedArray` element type the typed upload path expects for a format's
 *  components. `float16` supplies raw half-float bits as `u16`. Normalized formats (`unorm*` /
 *  `snorm*`) accept pre-encoded integer arrays — floats are not auto-quantized. */
export type VertexArrayKind = 'u8' | 'i8' | 'u16' | 'i16' | 'u32' | 'i32' | 'f32';

/** Per-`GPUVertexFormat` metadata used to derive WGSL types, pack byte layouts, and validate. */
export interface VertexFormatInfo {
    /** Total bytes one attribute of this format occupies on the wire. */
    readonly byteSize: number;
    /** Shader-visible vector width (1–4). */
    readonly components: number;
    /** Derived WGSL member type, e.g. `vec3f`, `vec2u`, `vec4h`, `f32`. */
    readonly wgslType: string;
    /** Shader-visible component scalar type. */
    readonly componentType: VertexComponentType;
    /** Required byte alignment of an attribute's offset (`min(4, componentByteSize)`). */
    readonly alignment: number;
    /** `TypedArray` element kind the packer reads host data as. */
    readonly arrayKind: VertexArrayKind;
    /** How many `arrayKind` elements make up one vertex of this attribute (usually `components`;
     *  `1` for the packed `unorm10-10-10-2`, `4` for `unorm8x4-bgra`). */
    readonly elementsPerVertex: number;
}

/** Derive the shader-visible WGSL type string for a format's component type + vector width,
 *  reusing the WGSL type model (`wgslTypeName`) rather than a hand-maintained table. */
function wgslTypeFor(componentType: VertexComponentType, components: number): string {
    return components === 1
        ? componentType
        : wgslTypeName(vec(components as WgslVecSize, componentType));
}

function info(
    byteSize: number,
    components: number,
    componentType: VertexComponentType,
    arrayKind: VertexArrayKind,
    componentByteSize: number,
    elementsPerVertex: number = components
): VertexFormatInfo {
    return {
        byteSize,
        components,
        wgslType: wgslTypeFor(componentType, components),
        componentType,
        alignment: Math.min(4, componentByteSize),
        arrayKind,
        elementsPerVertex,
    };
}

/** Static metadata for every `GPUVertexFormat`. Source of truth for WGSL-type derivation, byte
 *  layout, offset alignment, and the typed upload packer. */
export const VERTEX_FORMAT_INFO: Record<VertexFormat, VertexFormatInfo> = {
    uint8: info(1, 1, 'u32', 'u8', 1),
    uint8x2: info(2, 2, 'u32', 'u8', 1),
    uint8x4: info(4, 4, 'u32', 'u8', 1),
    sint8: info(1, 1, 'i32', 'i8', 1),
    sint8x2: info(2, 2, 'i32', 'i8', 1),
    sint8x4: info(4, 4, 'i32', 'i8', 1),
    unorm8: info(1, 1, 'f32', 'u8', 1),
    unorm8x2: info(2, 2, 'f32', 'u8', 1),
    unorm8x4: info(4, 4, 'f32', 'u8', 1),
    snorm8: info(1, 1, 'f32', 'i8', 1),
    snorm8x2: info(2, 2, 'f32', 'i8', 1),
    snorm8x4: info(4, 4, 'f32', 'i8', 1),
    uint16: info(2, 1, 'u32', 'u16', 2),
    uint16x2: info(4, 2, 'u32', 'u16', 2),
    uint16x4: info(8, 4, 'u32', 'u16', 2),
    sint16: info(2, 1, 'i32', 'i16', 2),
    sint16x2: info(4, 2, 'i32', 'i16', 2),
    sint16x4: info(8, 4, 'i32', 'i16', 2),
    unorm16: info(2, 1, 'f32', 'u16', 2),
    unorm16x2: info(4, 2, 'f32', 'u16', 2),
    unorm16x4: info(8, 4, 'f32', 'u16', 2),
    snorm16: info(2, 1, 'f32', 'i16', 2),
    snorm16x2: info(4, 2, 'f32', 'i16', 2),
    snorm16x4: info(8, 4, 'f32', 'i16', 2),
    float16: info(2, 1, 'f16', 'u16', 2),
    float16x2: info(4, 2, 'f16', 'u16', 2),
    float16x4: info(8, 4, 'f16', 'u16', 2),
    float32: info(4, 1, 'f32', 'f32', 4),
    float32x2: info(8, 2, 'f32', 'f32', 4),
    float32x3: info(12, 3, 'f32', 'f32', 4),
    float32x4: info(16, 4, 'f32', 'f32', 4),
    uint32: info(4, 1, 'u32', 'u32', 4),
    uint32x2: info(8, 2, 'u32', 'u32', 4),
    uint32x3: info(12, 3, 'u32', 'u32', 4),
    uint32x4: info(16, 4, 'u32', 'u32', 4),
    sint32: info(4, 1, 'i32', 'i32', 4),
    sint32x2: info(8, 2, 'i32', 'i32', 4),
    sint32x3: info(12, 3, 'i32', 'i32', 4),
    sint32x4: info(16, 4, 'i32', 'i32', 4),
    'unorm10-10-10-2': info(4, 4, 'f32', 'u32', 4, 1),
    'unorm8x4-bgra': info(4, 4, 'f32', 'u8', 1, 4),
};

/** Look up format metadata, throwing a clear error for an unknown format string. */
export function vertexFormatInfo(format: VertexFormat): VertexFormatInfo {
    const i = VERTEX_FORMAT_INFO[format];
    if (i === undefined) {
        throw new Error(`vertexFormatInfo: unknown GPUVertexFormat '${format}'.`);
    }
    return i;
}

/** The full-precision "natural" formats a WGSL type maps to by default (before any explicit
 *  override). One per WGSL type; normalized/packed formats are never defaults. */
const NATURAL_FORMATS: readonly VertexFormat[] = [
    'float32',
    'float32x2',
    'float32x3',
    'float32x4',
    'uint32',
    'uint32x2',
    'uint32x3',
    'uint32x4',
    'sint32',
    'sint32x2',
    'sint32x3',
    'sint32x4',
    'float16',
    'float16x2',
    'float16x4',
];

const DEFAULT_FORMAT_BY_WGSL: ReadonlyMap<string, VertexFormat> = new Map(
    NATURAL_FORMATS.map((f) => [VERTEX_FORMAT_INFO[f].wgslType, f] as const)
);

/** The natural `GPUVertexFormat` for a WGSL member type (`vec3f → float32x3`), or `undefined` when
 *  none applies (e.g. `vec3h` — WebGPU has no `float16x3`; declare a format explicitly). */
export function defaultVertexFormat(wgslType: string): VertexFormat | undefined {
    return DEFAULT_FORMAT_BY_WGSL.get(wgslType);
}
