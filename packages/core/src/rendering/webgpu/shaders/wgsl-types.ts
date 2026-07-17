import { z } from 'zod';

// ---------------------------------------------------------------------------
// Component-type enums
// ---------------------------------------------------------------------------

/** All WGSL scalar types. */
export const WgslScalarTypeSchema = z.enum(['bool', 'i32', 'u32', 'f32', 'f16']);
export type WgslScalarType = z.infer<typeof WgslScalarTypeSchema>;

/** Numeric scalars valid as vector component types (excludes `bool`). */
export const WgslNumericScalarTypeSchema = z.enum(['i32', 'u32', 'f32', 'f16']);
export type WgslNumericScalarType = z.infer<typeof WgslNumericScalarTypeSchema>;

/** Float scalars valid as matrix component types. */
export const WgslFloatScalarTypeSchema = z.enum(['f32', 'f16']);
export type WgslFloatScalarType = z.infer<typeof WgslFloatScalarTypeSchema>;

/** Integer scalars valid inside `atomic<T>`. */
export const WgslAtomicInnerTypeSchema = z.enum(['i32', 'u32']);
export type WgslAtomicInnerType = z.infer<typeof WgslAtomicInnerTypeSchema>;

/** Component types valid for sampled textures. */
export const WgslSampledTypeSchema = z.enum(['f32', 'i32', 'u32']);
export type WgslSampledType = z.infer<typeof WgslSampledTypeSchema>;

// ---------------------------------------------------------------------------
// Scalar  →  bool | i32 | u32 | f32 | f16
// ---------------------------------------------------------------------------

export const WgslScalarSchema = z.object({
    kind: z.literal('scalar'),
    type: WgslScalarTypeSchema,
});
export type WgslScalar = z.infer<typeof WgslScalarSchema>;

// ---------------------------------------------------------------------------
// Vectors  →  vec2 / vec3 / vec4
// ---------------------------------------------------------------------------

export const WgslVecSizeSchema = z.union([z.literal(2), z.literal(3), z.literal(4)]);
export type WgslVecSize = z.infer<typeof WgslVecSizeSchema>;

export const WgslVecSchema = z.object({
    kind: z.literal('vec'),
    size: WgslVecSizeSchema,
    componentType: WgslNumericScalarTypeSchema,
});
export type WgslVec = z.infer<typeof WgslVecSchema>;

// ---------------------------------------------------------------------------
// Matrices  →  matCxR  (C columns × R rows)
// ---------------------------------------------------------------------------

export const WgslMatDimSchema = z.union([z.literal(2), z.literal(3), z.literal(4)]);
export type WgslMatDim = z.infer<typeof WgslMatDimSchema>;

export const WgslMatSchema = z.object({
    kind: z.literal('mat'),
    cols: WgslMatDimSchema,
    rows: WgslMatDimSchema,
    componentType: WgslFloatScalarTypeSchema,
});
export type WgslMat = z.infer<typeof WgslMatSchema>;

// ---------------------------------------------------------------------------
// Samplers
// ---------------------------------------------------------------------------

export const WgslSamplerSchema = z.object({ kind: z.literal('sampler') });
export type WgslSampler = z.infer<typeof WgslSamplerSchema>;

export const WgslSamplerComparisonSchema = z.object({ kind: z.literal('sampler_comparison') });
export type WgslSamplerComparison = z.infer<typeof WgslSamplerComparisonSchema>;

// ---------------------------------------------------------------------------
// Texture dimension enums
// ---------------------------------------------------------------------------

/** Valid dimensions for sampled (non-depth) textures. */
export const WgslTextureDimensionSchema = z.enum(['1d', '2d', '2d_array', '3d', 'cube', 'cube_array']);
export type WgslTextureDimension = z.infer<typeof WgslTextureDimensionSchema>;

/** Valid dimensions for depth textures (`1d` is not a valid depth texture dimension). */
export const WgslDepthTextureDimensionSchema = z.enum(['2d', '2d_array', 'cube', 'cube_array']);
export type WgslDepthTextureDimension = z.infer<typeof WgslDepthTextureDimensionSchema>;

/** Valid dimensions for storage textures (`cube` and `cube_array` are not supported). */
export const WgslStorageTextureDimensionSchema = z.enum(['1d', '2d', '2d_array', '3d']);
export type WgslStorageTextureDimension = z.infer<typeof WgslStorageTextureDimensionSchema>;

// ---------------------------------------------------------------------------
// Sampled textures  →  texture_1d<T> … texture_cube_array<T>
// ---------------------------------------------------------------------------

export const WgslTextureSchema = z.object({
    kind: z.literal('texture'),
    dimension: WgslTextureDimensionSchema,
    componentType: WgslSampledTypeSchema,
});
export type WgslTexture = z.infer<typeof WgslTextureSchema>;

// ---------------------------------------------------------------------------
// Depth textures  →  texture_depth_2d … texture_depth_cube_array
// ---------------------------------------------------------------------------

export const WgslDepthTextureSchema = z.object({
    kind: z.literal('texture_depth'),
    dimension: WgslDepthTextureDimensionSchema,
});
export type WgslDepthTexture = z.infer<typeof WgslDepthTextureSchema>;

// ---------------------------------------------------------------------------
// Multisampled textures
// ---------------------------------------------------------------------------

export const WgslMultisampledTextureSchema = z.object({
    kind: z.literal('texture_multisampled_2d'),
    componentType: WgslSampledTypeSchema,
});
export type WgslMultisampledTexture = z.infer<typeof WgslMultisampledTextureSchema>;

export const WgslDepthMultisampledTextureSchema = z.object({
    kind: z.literal('texture_depth_multisampled_2d'),
});
export type WgslDepthMultisampledTexture = z.infer<typeof WgslDepthMultisampledTextureSchema>;

// ---------------------------------------------------------------------------
// Storage textures  →  texture_storage_*<format, access>
// ---------------------------------------------------------------------------

/** Access modes for WGSL storage textures. Note: underscores, not hyphens. */
export const WgslStorageAccessModeSchema = z.enum(['read', 'write', 'read_write']);
export type WgslStorageAccessMode = z.infer<typeof WgslStorageAccessModeSchema>;

/**
 * Texel formats valid for WGSL storage textures (spec §14.9.1).
 * Formats after the first group require optional WebGPU features.
 */
export const WgslTexelFormatSchema = z.enum([
    // Core texel formats
    'bgra8unorm',
    'r32float',
    'r32sint',
    'r32uint',
    'rg32float',
    'rg32sint',
    'rg32uint',
    'rgba8unorm',
    'rgba8snorm',
    'rgba8uint',
    'rgba8sint',
    'rgba16float',
    'rgba16uint',
    'rgba16sint',
    'rgba32float',
    'rgba32uint',
    'rgba32sint',
    // Optional feature: rg11b10ufloat-renderable
    'rg11b10ufloat',
    // Optional feature: rw-storage-texture-8-bit-formats
    'r8unorm',
    'r8snorm',
    'r8uint',
    'r8sint',
    'rg8unorm',
    'rg8snorm',
    'rg8uint',
    'rg8sint',
    'rgba8unorm-srgb',
    // Optional feature: shader-f16
    'r16float',
    'r16unorm',
    'r16snorm',
    'r16uint',
    'r16sint',
    'rg16float',
    'rg16unorm',
    'rg16snorm',
    'rg16uint',
    'rg16sint',
    'rgba16unorm',
    'rgba16snorm',
]);
export type WgslTexelFormat = z.infer<typeof WgslTexelFormatSchema>;

export const WgslStorageTextureSchema = z.object({
    kind: z.literal('texture_storage'),
    dimension: WgslStorageTextureDimensionSchema,
    format: WgslTexelFormatSchema,
    access: WgslStorageAccessModeSchema,
});
export type WgslStorageTexture = z.infer<typeof WgslStorageTextureSchema>;

// ---------------------------------------------------------------------------
// External texture  →  texture_external
// ---------------------------------------------------------------------------

export const WgslExternalTextureSchema = z.object({ kind: z.literal('texture_external') });
export type WgslExternalTexture = z.infer<typeof WgslExternalTextureSchema>;

/** Union of all WGSL texture-type variants. Used as the type constraint for texture variable declarations. */
export type WgslTextureDataType =
    | WgslTexture
    | WgslDepthTexture
    | WgslMultisampledTexture
    | WgslDepthMultisampledTexture
    | WgslStorageTexture
    | WgslExternalTexture;

// ---------------------------------------------------------------------------
// Atomic  →  atomic<i32> | atomic<u32>
// ---------------------------------------------------------------------------

export const WgslAtomicSchema = z.object({
    kind: z.literal('atomic'),
    componentType: WgslAtomicInnerTypeSchema,
});
export type WgslAtomic = z.infer<typeof WgslAtomicSchema>;

// ---------------------------------------------------------------------------
// Arrays  —  recursive: element type is any WgslDataType
// ---------------------------------------------------------------------------

/** Fixed-size array: `array<T, N>`. */
export type WgslFixedArray = {
    kind: 'array';
    elementType: WgslDataType;
    size: number;
};

/** Runtime-sized array: `array<T>`. Only valid in storage buffers. */
export type WgslRuntimeArray = {
    kind: 'runtime_array';
    elementType: WgslDataType;
};

// ---------------------------------------------------------------------------
// Master union
// ---------------------------------------------------------------------------

export type WgslDataType =
    | WgslScalar
    | WgslVec
    | WgslMat
    | WgslSampler
    | WgslSamplerComparison
    | WgslTexture
    | WgslDepthTexture
    | WgslMultisampledTexture
    | WgslDepthMultisampledTexture
    | WgslStorageTexture
    | WgslExternalTexture
    | WgslAtomic
    | WgslFixedArray
    | WgslRuntimeArray;

// Array schemas are declared after `WgslDataType` so that the `z.lazy`
// callback can close over `WgslDataTypeSchema`.
export const WgslFixedArraySchema = z.object({
    kind: z.literal('array'),
    elementType: z.lazy((): z.ZodType<WgslDataType> => WgslDataTypeSchema),
    size: z.number().int().positive(),
});

export const WgslRuntimeArraySchema = z.object({
    kind: z.literal('runtime_array'),
    elementType: z.lazy((): z.ZodType<WgslDataType> => WgslDataTypeSchema),
});

// `z.union` is used rather than `z.discriminatedUnion` so that the recursive
// array schemas (which carry a `z.lazy` elementType) are accepted without
// TypeScript complaining about the relaxed ZodType<T> constraint.
export const WgslDataTypeSchema: z.ZodType<WgslDataType> = z.union([
    WgslScalarSchema,
    WgslVecSchema,
    WgslMatSchema,
    WgslSamplerSchema,
    WgslSamplerComparisonSchema,
    WgslTextureSchema,
    WgslDepthTextureSchema,
    WgslMultisampledTextureSchema,
    WgslDepthMultisampledTextureSchema,
    WgslStorageTextureSchema,
    WgslExternalTextureSchema,
    WgslAtomicSchema,
    WgslFixedArraySchema,
    WgslRuntimeArraySchema,
]);

// ---------------------------------------------------------------------------
// WGSL source string conversion
// ---------------------------------------------------------------------------

const VEC_SUFFIX: Record<WgslNumericScalarType, string> = {
    i32: 'i',
    u32: 'u',
    f32: 'f',
    f16: 'h',
};

const MAT_SUFFIX: Record<WgslFloatScalarType, string> = {
    f32: 'f',
    f16: 'h',
};

/**
 * Returns the WGSL source string for the given data type.
 *
 * @example
 * wgslTypeName(vec3f)                              // → "vec3f"
 * wgslTypeName(mat4x4f)                            // → "mat4x4f"
 * wgslTypeName(texture('2d', 'f32'))               // → "texture_2d<f32>"
 * wgslTypeName(storageTexture('2d','rgba8unorm','write')) // → "texture_storage_2d<rgba8unorm, write>"
 * wgslTypeName(fixedArray(f32, 4))                 // → "array<f32, 4>"
 */
export function wgslTypeName(type: WgslDataType): string {
    switch (type.kind) {
        case 'scalar':
            return type.type;
        case 'vec':
            return `vec${type.size}${VEC_SUFFIX[type.componentType]}`;
        case 'mat':
            return `mat${type.cols}x${type.rows}${MAT_SUFFIX[type.componentType]}`;
        case 'sampler':
            return 'sampler';
        case 'sampler_comparison':
            return 'sampler_comparison';
        case 'texture':
            return `texture_${type.dimension}<${type.componentType}>`;
        case 'texture_depth':
            return `texture_depth_${type.dimension}`;
        case 'texture_multisampled_2d':
            return `texture_multisampled_2d<${type.componentType}>`;
        case 'texture_depth_multisampled_2d':
            return 'texture_depth_multisampled_2d';
        case 'texture_storage':
            return `texture_storage_${type.dimension}<${type.format}, ${type.access}>`;
        case 'texture_external':
            return 'texture_external';
        case 'atomic':
            return `atomic<${type.componentType}>`;
        case 'array':
            return `array<${wgslTypeName(type.elementType)}, ${type.size}>`;
        case 'runtime_array':
            return `array<${wgslTypeName(type.elementType)}>`;
    }
}

// ---------------------------------------------------------------------------
// Constructor functions
// ---------------------------------------------------------------------------

export const scalar = (type: WgslScalarType): WgslScalar => ({ kind: 'scalar', type });

export const vec = (size: WgslVecSize, componentType: WgslNumericScalarType): WgslVec => ({
    kind: 'vec',
    size,
    componentType,
});

export const mat = (cols: WgslMatDim, rows: WgslMatDim, componentType: WgslFloatScalarType): WgslMat => ({
    kind: 'mat',
    cols,
    rows,
    componentType,
});

export const texture = (dimension: WgslTextureDimension, componentType: WgslSampledType): WgslTexture => ({
    kind: 'texture',
    dimension,
    componentType,
});

export const depthTexture = (dimension: WgslDepthTextureDimension): WgslDepthTexture => ({
    kind: 'texture_depth',
    dimension,
});

export const multisampledTexture = (componentType: WgslSampledType): WgslMultisampledTexture => ({
    kind: 'texture_multisampled_2d',
    componentType,
});

export const storageTexture = (
    dimension: WgslStorageTextureDimension,
    format: WgslTexelFormat,
    access: WgslStorageAccessMode
): WgslStorageTexture => ({ kind: 'texture_storage', dimension, format, access });

export const atomic = (componentType: WgslAtomicInnerType): WgslAtomic => ({
    kind: 'atomic',
    componentType,
});

export const fixedArray = (elementType: WgslDataType, size: number): WgslFixedArray => ({
    kind: 'array',
    elementType,
    size,
});

export const runtimeArray = (elementType: WgslDataType): WgslRuntimeArray => ({
    kind: 'runtime_array',
    elementType,
});

// ---------------------------------------------------------------------------
// Pre-instantiated shorthands — names match WGSL built-in type aliases
// ---------------------------------------------------------------------------

// Scalars
export const bool: WgslScalar = { kind: 'scalar', type: 'bool' };
export const i32: WgslScalar = { kind: 'scalar', type: 'i32' };
export const u32: WgslScalar = { kind: 'scalar', type: 'u32' };
export const f32: WgslScalar = { kind: 'scalar', type: 'f32' };
export const f16: WgslScalar = { kind: 'scalar', type: 'f16' };

// vec2 variants
export const vec2i: WgslVec = { kind: 'vec', size: 2, componentType: 'i32' };
export const vec2u: WgslVec = { kind: 'vec', size: 2, componentType: 'u32' };
export const vec2f: WgslVec = { kind: 'vec', size: 2, componentType: 'f32' };
export const vec2h: WgslVec = { kind: 'vec', size: 2, componentType: 'f16' };

// vec3 variants
export const vec3i: WgslVec = { kind: 'vec', size: 3, componentType: 'i32' };
export const vec3u: WgslVec = { kind: 'vec', size: 3, componentType: 'u32' };
export const vec3f: WgslVec = { kind: 'vec', size: 3, componentType: 'f32' };
export const vec3h: WgslVec = { kind: 'vec', size: 3, componentType: 'f16' };

// vec4 variants
export const vec4i: WgslVec = { kind: 'vec', size: 4, componentType: 'i32' };
export const vec4u: WgslVec = { kind: 'vec', size: 4, componentType: 'u32' };
export const vec4f: WgslVec = { kind: 'vec', size: 4, componentType: 'f32' };
export const vec4h: WgslVec = { kind: 'vec', size: 4, componentType: 'f16' };

// mat (f32)
export const mat2x2f: WgslMat = { kind: 'mat', cols: 2, rows: 2, componentType: 'f32' };
export const mat2x3f: WgslMat = { kind: 'mat', cols: 2, rows: 3, componentType: 'f32' };
export const mat2x4f: WgslMat = { kind: 'mat', cols: 2, rows: 4, componentType: 'f32' };
export const mat3x2f: WgslMat = { kind: 'mat', cols: 3, rows: 2, componentType: 'f32' };
export const mat3x3f: WgslMat = { kind: 'mat', cols: 3, rows: 3, componentType: 'f32' };
export const mat3x4f: WgslMat = { kind: 'mat', cols: 3, rows: 4, componentType: 'f32' };
export const mat4x2f: WgslMat = { kind: 'mat', cols: 4, rows: 2, componentType: 'f32' };
export const mat4x3f: WgslMat = { kind: 'mat', cols: 4, rows: 3, componentType: 'f32' };
export const mat4x4f: WgslMat = { kind: 'mat', cols: 4, rows: 4, componentType: 'f32' };

// mat (f16)
export const mat2x2h: WgslMat = { kind: 'mat', cols: 2, rows: 2, componentType: 'f16' };
export const mat2x3h: WgslMat = { kind: 'mat', cols: 2, rows: 3, componentType: 'f16' };
export const mat2x4h: WgslMat = { kind: 'mat', cols: 2, rows: 4, componentType: 'f16' };
export const mat3x2h: WgslMat = { kind: 'mat', cols: 3, rows: 2, componentType: 'f16' };
export const mat3x3h: WgslMat = { kind: 'mat', cols: 3, rows: 3, componentType: 'f16' };
export const mat3x4h: WgslMat = { kind: 'mat', cols: 3, rows: 4, componentType: 'f16' };
export const mat4x2h: WgslMat = { kind: 'mat', cols: 4, rows: 2, componentType: 'f16' };
export const mat4x3h: WgslMat = { kind: 'mat', cols: 4, rows: 3, componentType: 'f16' };
export const mat4x4h: WgslMat = { kind: 'mat', cols: 4, rows: 4, componentType: 'f16' };

// Samplers
export const sampler: WgslSampler = { kind: 'sampler' };
// eslint-disable-next-line camelcase
export const sampler_comparison: WgslSamplerComparison = { kind: 'sampler_comparison' };

// Zero-parameter texture singletons
export const texture_external: WgslExternalTexture = { kind: 'texture_external' };
// eslint-disable-next-line camelcase
export const texture_depth_multisampled_2d: WgslDepthMultisampledTexture = {
    kind: 'texture_depth_multisampled_2d',
};

// ---------------------------------------------------------------------------
// Encapsulated bucket — type constructors + pre-instantiated singletons
// ---------------------------------------------------------------------------

/**
 * Grouped WGSL *type* constructors and singletons — the typed counterpart to `decls` (declarations)
 * and `attrs` (attributes). Any member can be passed wherever a `TypeIdentifier` is accepted (e.g.
 * `decls.member('color', types.vec4f)`), rendering identically to the equivalent WGSL type string but
 * with autocomplete, validation, and composability (`types.fixedArray(types.vec2f, 3)`).
 */
export const types = {
    // constructors
    scalar,
    vec,
    mat,
    texture,
    depthTexture,
    multisampledTexture,
    storageTexture,
    atomic,
    fixedArray,
    runtimeArray,
    // scalar singletons
    bool,
    i32,
    u32,
    f32,
    f16,
    // vec2 / vec3 / vec4
    vec2i,
    vec2u,
    vec2f,
    vec2h,
    vec3i,
    vec3u,
    vec3f,
    vec3h,
    vec4i,
    vec4u,
    vec4f,
    vec4h,
    // mat (f32)
    mat2x2f,
    mat2x3f,
    mat2x4f,
    mat3x2f,
    mat3x3f,
    mat3x4f,
    mat4x2f,
    mat4x3f,
    mat4x4f,
    // mat (f16)
    mat2x2h,
    mat2x3h,
    mat2x4h,
    mat3x2h,
    mat3x3h,
    mat3x4h,
    mat4x2h,
    mat4x3h,
    mat4x4h,
    // samplers
    sampler,
    sampler_comparison,
    // texture singletons
    texture_external,
    texture_depth_multisampled_2d,
};
