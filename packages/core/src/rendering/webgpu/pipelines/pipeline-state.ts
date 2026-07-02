/**
 * `PipelineStateDescriptor` — the typed POJO consumed by `pipeline(graph, shader, state, device)`.
 *
 * It mirrors `GPURenderPipelineDescriptor` minus the parts the pipeline builder derives itself:
 * `layout` is built from the binding graph, and `vertex.module` / `fragment.module` come from
 * compiling the shader. Everything else — primitive / depthStencil / multisample / vertex
 * buffer layouts / fragment targets / entry-point names / pipeline-constants — must round-trip
 * the caller's intent so the same shader paired with different states produces distinct
 * `BuiltPipeline`s.
 *
 * The companion `normalizePipelineState(state)` runs Zod validation, defaults the entry-point
 * names to `vs_main` / `fs_main`, and produces a canonical object (recursively key-sorted) ready
 * for the fingerprint hash in Slice 3c.
 */

import { z } from 'zod';
import {
    type ColorTargetState,
    ColorTargetStateSchema,
    type DepthStencilState,
    DepthStencilStateSchema,
    type MultisampleState,
    MultisampleStateSchema,
    type PrimitiveState,
    PrimitiveStateSchema,
    type VertexBufferLayout,
    VertexBufferLayoutSchema,
} from '../native-types';
import { deriveVertexBufferLayouts, type VertexLayoutDeclaration } from './vertex-layout';

/** Default WGSL entry point assumed when none is supplied on `state.vertex`. */
export const DEFAULT_VERTEX_ENTRY_POINT = 'vs_main';
/** Default WGSL entry point assumed when none is supplied on `state.fragment`. */
export const DEFAULT_FRAGMENT_ENTRY_POINT = 'fs_main';

/** Vertex-stage configuration. `module` is derived from the shader, so it does not appear here. */
export interface VertexStateDescriptor {
    readonly entryPoint?: string;
    readonly buffers?: readonly VertexBufferLayout[];
    /** Declarative vertex layout (see `vertexLayout(...)`). When present, `buffers` is derived
     *  from it during normalization; mutually exclusive with a hand-written `buffers`. */
    readonly layout?: VertexLayoutDeclaration;
    readonly constants?: Readonly<Record<string, number>>;
}

/** Fragment-stage configuration. Omit entirely for depth-only / shadow-pass pipelines. */
export interface FragmentStateDescriptor {
    readonly entryPoint?: string;
    readonly targets: readonly ColorTargetState[];
    readonly constants?: Readonly<Record<string, number>>;
}

/** The descriptor consumed by `pipeline()`. */
export interface PipelineStateDescriptor {
    readonly vertex?: VertexStateDescriptor;
    readonly primitive?: PrimitiveState;
    readonly depthStencil?: DepthStencilState;
    readonly multisample?: MultisampleState;
    readonly fragment?: FragmentStateDescriptor;
    readonly label?: string;
}

// ---- Zod schemas ----------------------------------------------------------------------------

const ConstantsSchema = z.record(z.string(), z.number());

const VertexStateDescriptorSchema = z.object({
    entryPoint: z.string().optional(),
    buffers: z.array(VertexBufferLayoutSchema).optional(),
    constants: ConstantsSchema.optional(),
});

const FragmentStateDescriptorSchema = z.object({
    entryPoint: z.string().optional(),
    targets: z.array(ColorTargetStateSchema),
    constants: ConstantsSchema.optional(),
});

export const PipelineStateDescriptorSchema = z.object({
    vertex: VertexStateDescriptorSchema.optional(),
    primitive: PrimitiveStateSchema.optional(),
    depthStencil: DepthStencilStateSchema.optional(),
    multisample: MultisampleStateSchema.optional(),
    fragment: FragmentStateDescriptorSchema.optional(),
    label: z.string().optional(),
});

// ---- Normalization --------------------------------------------------------------------------

/**
 * A `PipelineStateDescriptor` after Zod validation, entry-point defaulting, and canonical
 * key-ordering. Two semantically-equal `PipelineStateDescriptor`s normalize to deeply-equal
 * `NormalizedPipelineState`s, so the result is suitable for direct use as a fingerprint payload.
 */
export interface NormalizedPipelineState {
    readonly vertex: {
        readonly entryPoint: string;
        readonly buffers?: readonly VertexBufferLayout[];
        readonly constants?: Readonly<Record<string, number>>;
    };
    readonly primitive?: PrimitiveState;
    readonly depthStencil?: DepthStencilState;
    readonly multisample?: MultisampleState;
    readonly fragment?: {
        readonly entryPoint: string;
        readonly targets: readonly ColorTargetState[];
        readonly constants?: Readonly<Record<string, number>>;
    };
    readonly label?: string;
}

/**
 * Validate and canonicalize a `PipelineStateDescriptor`.
 *
 * - Throws a descriptive `ZodError` if `state` is structurally malformed.
 * - Defaults `vertex.entryPoint` to `vs_main` and (when `fragment` is present)
 *   `fragment.entryPoint` to `fs_main`.
 * - Returns an object whose own keys (and the keys of every nested object) are sorted
 *   alphabetically so that `JSON.stringify(result)` is stable regardless of input key order.
 * - Idempotent: `normalizePipelineState(normalizePipelineState(s))` returns a deeply-equal value.
 */
export function normalizePipelineState(state: PipelineStateDescriptor): NormalizedPipelineState {
    const parsed = PipelineStateDescriptorSchema.parse(resolveVertexLayout(state));
    const out: Record<string, unknown> = {};
    out.vertex = sortKeys({
        entryPoint: parsed.vertex?.entryPoint ?? DEFAULT_VERTEX_ENTRY_POINT,
        ...(parsed.vertex?.buffers !== undefined && { buffers: parsed.vertex.buffers }),
        ...(parsed.vertex?.constants !== undefined && { constants: parsed.vertex.constants }),
    });
    if (parsed.primitive !== undefined) out.primitive = sortKeys(parsed.primitive);
    if (parsed.depthStencil !== undefined) out.depthStencil = sortKeys(parsed.depthStencil);
    if (parsed.multisample !== undefined) out.multisample = sortKeys(parsed.multisample);
    if (parsed.fragment !== undefined) {
        out.fragment = sortKeys({
            entryPoint: parsed.fragment.entryPoint ?? DEFAULT_FRAGMENT_ENTRY_POINT,
            targets: parsed.fragment.targets.map((t) => sortKeys(t)),
            ...(parsed.fragment.constants !== undefined && { constants: parsed.fragment.constants }),
        });
    }
    if (parsed.label !== undefined) out.label = parsed.label;
    return sortKeys(out) as unknown as NormalizedPipelineState;
}

/**
 * Recursively reorder an object's own enumerable keys alphabetically. Arrays are preserved in
 * order (their semantics depend on index). Primitives pass through. Used to make the normalized
 * state deeply key-stable so JSON serialization is canonical.
 */
function sortKeys<T>(value: T): T {
    if (Array.isArray(value)) {
        return value.map((v) => sortKeys(v)) as unknown as T;
    }
    if (value !== null && typeof value === 'object') {
        const src = value as Record<string, unknown>;
        const out: Record<string, unknown> = {};
        for (const k of Object.keys(src).sort()) {
            out[k] = sortKeys(src[k]);
        }
        return out as unknown as T;
    }
    return value;
}

/**
 * Derive `vertex.buffers` from a declarative `vertex.layout` when present, returning a plain
 * descriptor for Zod validation (which strips the non-schema `layout` field). Throws if both
 * `layout` and `buffers` are supplied. No-op when `layout` is absent.
 */
function resolveVertexLayout(state: PipelineStateDescriptor): PipelineStateDescriptor {
    const vertex = state.vertex;
    if (vertex?.layout === undefined) return state;
    if (vertex.buffers !== undefined) {
        throw new Error(
            'normalizePipelineState: vertex.layout and vertex.buffers are mutually exclusive — ' +
                'declare a vertexLayout(...) OR hand-write buffers, not both.'
        );
    }
    const { layout, ...vertexRest } = vertex;
    return { ...state, vertex: { ...vertexRest, buffers: deriveVertexBufferLayouts(layout) } };
}
