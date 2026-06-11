/**
 * Zod v4 schemas and inferred types for native WebGPU API descriptor objects
 * and enum/flags types. Schemas can be used for runtime validation; inferred
 * types are structurally compatible with the global WebGPU typings.
 */
import { z } from 'zod';

// ---- String Literal Enums ----

export const PrimitiveTopologySchema = z.enum([
    'point-list',
    'line-list',
    'line-strip',
    'triangle-list',
    'triangle-strip',
]);
export type PrimitiveTopology = z.infer<typeof PrimitiveTopologySchema>;

export const IndexFormatSchema = z.enum(['uint16', 'uint32']);
export type IndexFormat = z.infer<typeof IndexFormatSchema>;

export const FrontFaceSchema = z.enum(['ccw', 'cw']);
export type FrontFace = z.infer<typeof FrontFaceSchema>;

export const CullModeSchema = z.enum(['none', 'front', 'back']);
export type CullMode = z.infer<typeof CullModeSchema>;

export const CompareFunctionSchema = z.enum([
    'never',
    'less',
    'equal',
    'less-equal',
    'greater',
    'not-equal',
    'greater-equal',
    'always',
]);
export type CompareFunction = z.infer<typeof CompareFunctionSchema>;

export const StencilOperationSchema = z.enum([
    'keep',
    'zero',
    'replace',
    'invert',
    'increment-clamp',
    'decrement-clamp',
    'increment-wrap',
    'decrement-wrap',
]);
export type StencilOperation = z.infer<typeof StencilOperationSchema>;

export const BlendOperationSchema = z.enum([
    'add',
    'subtract',
    'reverse-subtract',
    'min',
    'max',
]);
export type BlendOperation = z.infer<typeof BlendOperationSchema>;

export const BlendFactorSchema = z.enum([
    'zero',
    'one',
    'src',
    'one-minus-src',
    'src-alpha',
    'one-minus-src-alpha',
    'dst',
    'one-minus-dst',
    'dst-alpha',
    'one-minus-dst-alpha',
    'src-alpha-saturated',
    'constant',
    'one-minus-constant',
    'src1',
    'one-minus-src1',
    'src1-alpha',
    'one-minus-src1-alpha',
]);
export type BlendFactor = z.infer<typeof BlendFactorSchema>;

export const BufferBindingTypeSchema = z.enum(['uniform', 'storage', 'read-only-storage']);
export type BufferBindingType = z.infer<typeof BufferBindingTypeSchema>;

export const SamplerBindingTypeSchema = z.enum(['filtering', 'non-filtering', 'comparison']);
export type SamplerBindingType = z.infer<typeof SamplerBindingTypeSchema>;

export const TextureSampleTypeSchema = z.enum([
    'float',
    'unfilterable-float',
    'depth',
    'sint',
    'uint',
]);
export type TextureSampleType = z.infer<typeof TextureSampleTypeSchema>;

export const TextureViewDimensionSchema = z.enum([
    '1d',
    '2d',
    '2d-array',
    'cube',
    'cube-array',
    '3d',
]);
export type TextureViewDimension = z.infer<typeof TextureViewDimensionSchema>;

export const StorageTextureAccessSchema = z.enum(['write-only', 'read-only', 'read-write']);
export type StorageTextureAccess = z.infer<typeof StorageTextureAccessSchema>;

export const VertexFormatSchema = z.enum([
    'uint8',
    'uint8x2',
    'uint8x4',
    'sint8',
    'sint8x2',
    'sint8x4',
    'unorm8',
    'unorm8x2',
    'unorm8x4',
    'snorm8',
    'snorm8x2',
    'snorm8x4',
    'uint16',
    'uint16x2',
    'uint16x4',
    'sint16',
    'sint16x2',
    'sint16x4',
    'unorm16',
    'unorm16x2',
    'unorm16x4',
    'snorm16',
    'snorm16x2',
    'snorm16x4',
    'float16',
    'float16x2',
    'float16x4',
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
    'unorm10-10-10-2',
    'unorm8x4-bgra',
]);
export type VertexFormat = z.infer<typeof VertexFormatSchema>;

export const VertexStepModeSchema = z.enum(['vertex', 'instance']);
export type VertexStepMode = z.infer<typeof VertexStepModeSchema>;

export const TextureFormatSchema = z.enum([
    // 8-bit formats
    'r8unorm',
    'r8snorm',
    'r8uint',
    'r8sint',
    // 16-bit formats
    'r16uint',
    'r16sint',
    'r16float',
    'rg8unorm',
    'rg8snorm',
    'rg8uint',
    'rg8sint',
    // 32-bit formats
    'r32uint',
    'r32sint',
    'r32float',
    'rg16uint',
    'rg16sint',
    'rg16float',
    'rgba8unorm',
    'rgba8unorm-srgb',
    'rgba8snorm',
    'rgba8uint',
    'rgba8sint',
    'bgra8unorm',
    'bgra8unorm-srgb',
    // Packed 32-bit formats
    'rgb9e5ufloat',
    'rgb10a2uint',
    'rgb10a2unorm',
    'rg11b10ufloat',
    // 64-bit formats
    'rg32uint',
    'rg32sint',
    'rg32float',
    'rgba16uint',
    'rgba16sint',
    'rgba16float',
    // 128-bit formats
    'rgba32uint',
    'rgba32sint',
    'rgba32float',
    // Depth/stencil formats
    'stencil8',
    'depth16unorm',
    'depth24plus',
    'depth24plus-stencil8',
    'depth32float',
    'depth32float-stencil8',
    // BC compressed formats (optional feature: texture-compression-bc)
    'bc1-rgba-unorm',
    'bc1-rgba-unorm-srgb',
    'bc2-rgba-unorm',
    'bc2-rgba-unorm-srgb',
    'bc3-rgba-unorm',
    'bc3-rgba-unorm-srgb',
    'bc4-r-unorm',
    'bc4-r-snorm',
    'bc5-rg-unorm',
    'bc5-rg-snorm',
    'bc6h-rgb-ufloat',
    'bc6h-rgb-float',
    'bc7-rgba-unorm',
    'bc7-rgba-unorm-srgb',
    // ETC2 compressed formats (optional feature: texture-compression-etc2)
    'etc2-rgb8unorm',
    'etc2-rgb8unorm-srgb',
    'etc2-rgb8a1unorm',
    'etc2-rgb8a1unorm-srgb',
    'etc2-rgba8unorm',
    'etc2-rgba8unorm-srgb',
    'eac-r11unorm',
    'eac-r11snorm',
    'eac-rg11unorm',
    'eac-rg11snorm',
    // ASTC compressed formats (optional feature: texture-compression-astc)
    'astc-4x4-unorm',
    'astc-4x4-unorm-srgb',
    'astc-5x4-unorm',
    'astc-5x4-unorm-srgb',
    'astc-5x5-unorm',
    'astc-5x5-unorm-srgb',
    'astc-6x5-unorm',
    'astc-6x5-unorm-srgb',
    'astc-6x6-unorm',
    'astc-6x6-unorm-srgb',
    'astc-8x5-unorm',
    'astc-8x5-unorm-srgb',
    'astc-8x6-unorm',
    'astc-8x6-unorm-srgb',
    'astc-8x8-unorm',
    'astc-8x8-unorm-srgb',
    'astc-10x5-unorm',
    'astc-10x5-unorm-srgb',
    'astc-10x6-unorm',
    'astc-10x6-unorm-srgb',
    'astc-10x8-unorm',
    'astc-10x8-unorm-srgb',
    'astc-10x10-unorm',
    'astc-10x10-unorm-srgb',
    'astc-12x10-unorm',
    'astc-12x10-unorm-srgb',
    'astc-12x12-unorm',
    'astc-12x12-unorm-srgb',
]);
export type TextureFormat = z.infer<typeof TextureFormatSchema>;

// ---- Flags (bitmask numbers) ----

/** ShaderStage flags: VERTEX = 0x1, FRAGMENT = 0x2, COMPUTE = 0x4 */
export const ShaderStageFlagsSchema = z.number().int().nonnegative();
export type ShaderStageFlags = z.infer<typeof ShaderStageFlagsSchema>;
export enum ShaderStageFlag {
    VERTEX = 0x1,
    FRAGMENT = 0x2,
    COMPUTE = 0x4,
};

/** ColorWrite flags: RED = 0x1, GREEN = 0x2, BLUE = 0x4, ALPHA = 0x8, ALL = 0xF */
export const ColorWriteFlagsSchema = z.number().int().nonnegative();
export type ColorWriteFlags = z.infer<typeof ColorWriteFlagsSchema>;
export enum ColorWriteFlag {
    RED = 0x1,
    GREEN = 0x2,
    BLUE = 0x4,
    ALPHA = 0x8,
    ALL = 0xF,
};

// ---- Bind Group Layout Entry types ----

export const BufferBindingLayoutSchema = z.object({
    type: BufferBindingTypeSchema.optional(),
    hasDynamicOffset: z.boolean().optional(),
    minBindingSize: z.number().optional(),
});
export type BufferBindingLayout = z.infer<typeof BufferBindingLayoutSchema>;

export const SamplerBindingLayoutSchema = z.object({
    type: SamplerBindingTypeSchema.optional(),
});
export type SamplerBindingLayout = z.infer<typeof SamplerBindingLayoutSchema>;

export const TextureBindingLayoutSchema = z.object({
    sampleType: TextureSampleTypeSchema.optional(),
    viewDimension: TextureViewDimensionSchema.optional(),
    multisampled: z.boolean().optional(),
});
export type TextureBindingLayout = z.infer<typeof TextureBindingLayoutSchema>;

export const StorageTextureBindingLayoutSchema = z.object({
    access: StorageTextureAccessSchema.optional(),
    format: TextureFormatSchema,
    viewDimension: TextureViewDimensionSchema.optional(),
});
export type StorageTextureBindingLayout = z.infer<typeof StorageTextureBindingLayoutSchema>;

export const ExternalTextureBindingLayoutSchema = z.object({});
export type ExternalTextureBindingLayout = z.infer<typeof ExternalTextureBindingLayoutSchema>;

export const BindGroupLayoutEntrySchema = z.object({
    binding: z.number().int().nonnegative(),
    visibility: ShaderStageFlagsSchema,
    buffer: BufferBindingLayoutSchema.optional(),
    sampler: SamplerBindingLayoutSchema.optional(),
    texture: TextureBindingLayoutSchema.optional(),
    storageTexture: StorageTextureBindingLayoutSchema.optional(),
    externalTexture: ExternalTextureBindingLayoutSchema.optional(),
});
export type BindGroupLayoutEntry = z.infer<typeof BindGroupLayoutEntrySchema>;

// ---- Pipeline State types ----

export const StencilFaceStateSchema = z.object({
    compare: CompareFunctionSchema.optional(),
    failOp: StencilOperationSchema.optional(),
    depthFailOp: StencilOperationSchema.optional(),
    passOp: StencilOperationSchema.optional(),
});
export type StencilFaceState = z.infer<typeof StencilFaceStateSchema>;

export const DepthStencilStateSchema = z.object({
    format: TextureFormatSchema,
    depthWriteEnabled: z.boolean().optional(),
    depthCompare: CompareFunctionSchema.optional(),
    stencilFront: StencilFaceStateSchema.optional(),
    stencilBack: StencilFaceStateSchema.optional(),
    stencilReadMask: z.number().int().nonnegative().optional(),
    stencilWriteMask: z.number().int().nonnegative().optional(),
    depthBias: z.number().int().optional(),
    depthBiasSlopeScale: z.number().optional(),
    depthBiasClamp: z.number().optional(),
});
export type DepthStencilState = z.infer<typeof DepthStencilStateSchema>;

export const MultisampleStateSchema = z.object({
    count: z.number().int().positive().optional(),
    mask: z.number().int().nonnegative().optional(),
    alphaToCoverageEnabled: z.boolean().optional(),
});
export type MultisampleState = z.infer<typeof MultisampleStateSchema>;

export const PrimitiveStateSchema = z.object({
    topology: PrimitiveTopologySchema.optional(),
    stripIndexFormat: IndexFormatSchema.optional(),
    frontFace: FrontFaceSchema.optional(),
    cullMode: CullModeSchema.optional(),
    unclippedDepth: z.boolean().optional(),
});
export type PrimitiveState = z.infer<typeof PrimitiveStateSchema>;

export const BlendComponentSchema = z.object({
    operation: BlendOperationSchema.optional(),
    srcFactor: BlendFactorSchema.optional(),
    dstFactor: BlendFactorSchema.optional(),
});
export type BlendComponent = z.infer<typeof BlendComponentSchema>;

export const BlendStateSchema = z.object({
    color: BlendComponentSchema,
    alpha: BlendComponentSchema,
});
export type BlendState = z.infer<typeof BlendStateSchema>;

export const ColorTargetStateSchema = z.object({
    format: TextureFormatSchema,
    blend: BlendStateSchema.optional(),
    writeMask: ColorWriteFlagsSchema.optional(),
});
export type ColorTargetState = z.infer<typeof ColorTargetStateSchema>;

// ---- Vertex Layout types ----

export const VertexAttributeSchema = z.object({
    format: VertexFormatSchema,
    offset: z.number().int().nonnegative(),
    shaderLocation: z.number().int().nonnegative(),
});
export type VertexAttribute = z.infer<typeof VertexAttributeSchema>;

export const VertexBufferLayoutSchema = z.object({
    arrayStride: z.number().int().nonnegative(),
    stepMode: VertexStepModeSchema.optional(),
    attributes: z.array(VertexAttributeSchema),
});
export type VertexBufferLayout = z.infer<typeof VertexBufferLayoutSchema>;
