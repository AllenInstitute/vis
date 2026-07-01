/**
 * Internal pipeline build helper used by `RenderingContext.pipeline()`.
 *
 * Build sequence (consumes pre-computed `normalizedState`, `slotIndex`, `fingerprint` —
 * `RenderingContext` performs those steps and the cache check before calling in):
 *   1. `bindShader(shader, slotIndex)` + `asSource(...)` — produce final WGSL.
 *   2. `makeShaderDataDefinitions(wgsl)` — reflect struct layouts onto `BuiltPipeline.defs`.
 *      Stashed for Phase 4's `BufferResource` round-trip; not consumed by Phase 3 itself.
 *   3. Bucket `shaderSlotEntries(graph, shader)` by group depth → manually construct
 *      `GPUBindGroupLayoutEntry`s via existing `toBindGroupLayoutEntry`. Sparse depths (a shader
 *      uses depth 0 + 2 but not 1) get an empty layout so `bindGroupLayouts[i]` always equals
 *      depth `i`.
 *   4. `device.createBindGroupLayout` ×N → `createPipelineLayout` → `createShaderModule`.
 *   5. Compose `GPURenderPipelineDescriptor` from the normalized state and `createRenderPipeline`.
 *
 * Pure function — no module-level state. `BuiltPipeline` is the type exposed publicly; this
 * builder is internal (not re-exported from the webgpu barrel).
 */

import { makeShaderDataDefinitions, type ShaderDataDefinitions } from 'webgpu-utils';
import { type BindGroupLayoutEntry, ShaderStageFlag, type ShaderStageFlags } from '../native-types';
import {
    type BindingMap,
    bindShader,
    type BoundSlot,
    bind as bindSlot,
    type ResourceSlot,
    toBindGroupLayoutEntry,
} from '../resources';
import { asSource, type WgslShader } from '../shaders';
import type { BindingGraph } from './binding-graph';
import type { NormalizedPipelineState } from './pipeline-state';
import { shaderSlotEntries } from './traverse';

/**
 * The compiled artefact returned by `RenderingContext.pipeline()`.
 *
 * - `gpu` is the `GPURenderPipeline` ready for `setPipeline()`.
 * - `bindGroupLayouts[i]` corresponds to group index `i` (= depth). Sparse depths are empty BGLs.
 * - `slotIndex` is the `BindingMap` produced by `resolveShaderBindings` — Drawables consult it to
 *   look up `(group, binding)` for each `ResourceSlot` when assembling bind groups.
 * - `defs` is the `webgpu-utils` reflection cache. Phase 4 will feed this to `makeStructuredView`.
 * - `fingerprint` keys the per-`RenderingContext` cache. Because that cache guarantees a
 *   single `BuiltPipeline` instance per unique fingerprint, downstream code that needs to
 *   compare pipelines for equality does so by reference (`a === b`); the fingerprint is used
 *   only for stringy needs (bind-group cache keys, debug labels, error messages).
 */
export interface BuiltPipeline {
    readonly gpu: GPURenderPipeline;
    readonly layout: GPUPipelineLayout;
    readonly bindGroupLayouts: readonly GPUBindGroupLayout[];
    readonly slotIndex: BindingMap;
    readonly defs: ShaderDataDefinitions;
    readonly fingerprint: string;
    readonly state: NormalizedPipelineState;
    readonly shader: WgslShader;
}

/** Default visibility for a slot that doesn't declare its own. Tier-3 inference would tighten this. */
const DEFAULT_VISIBILITY: ShaderStageFlags = ShaderStageFlag.VERTEX | ShaderStageFlag.FRAGMENT;

/**
 * Build a `BuiltPipeline`. Internal — call sites go through `RenderingContext.pipeline()`,
 * which performs `normalizePipelineState` / `resolveShaderBindings` / `pipelineFingerprint`
 * and the cache check before invoking this builder.
 */
export function buildPipeline(
    device: GPUDevice,
    graph: BindingGraph,
    shader: WgslShader,
    normalizedState: NormalizedPipelineState,
    slotIndex: BindingMap,
    fingerprint: string
): BuiltPipeline {
    const label = normalizedState.label;
    const boundShader = bindShader(shader, slotIndex);
    const wgsl = asSource(boundShader);
    const defs = makeShaderDataDefinitions(wgsl);

    const bindGroupLayouts = buildBindGroupLayouts(graph, shader, slotIndex, device, label);
    const layout = device.createPipelineLayout({
        bindGroupLayouts: [...bindGroupLayouts],
        ...(label !== undefined && { label: `${label}.layout` }),
    });
    const module = device.createShaderModule({
        code: wgsl,
        ...(label !== undefined && { label: `${label}.module` }),
    });

    const descriptor = composeRenderPipelineDescriptor(layout, module, normalizedState);
    const gpu = device.createRenderPipeline(descriptor);

    return Object.freeze({
        gpu,
        layout,
        bindGroupLayouts,
        slotIndex,
        defs,
        fingerprint,
        state: normalizedState,
        shader,
    });
}

/**
 * Build one `GPUBindGroupLayout` per group depth used (inclusive of intermediate skipped depths,
 * which receive an empty layout). Returns an array indexed by depth.
 */
function buildBindGroupLayouts(
    graph: BindingGraph,
    shader: WgslShader,
    slotIndex: BindingMap,
    device: GPUDevice,
    labelBase?: string
): readonly GPUBindGroupLayout[] {
    // Bucket entries by depth. `shaderSlotEntries` already returns them sorted by (group, binding).
    const entries = shaderSlotEntries(graph, shader);
    const maxDepth = entries.reduce((m, e) => Math.max(m, e.group), -1);
    if (maxDepth < 0) {
        // Shader declares no resource slots — empty pipeline layout.
        return [];
    }

    const perDepth: Array<{ slot: ResourceSlot; binding: number }[]> = Array.from(
        { length: maxDepth + 1 },
        () => []
    );
    for (const e of entries) {
        perDepth[e.group]?.push({ slot: e.slot, binding: e.binding });
    }

    const layouts: GPUBindGroupLayout[] = [];
    for (let depth = 0; depth <= maxDepth; depth++) {
        const slots = perDepth[depth] ?? [];
        const bglEntries: BindGroupLayoutEntry[] = slots.map((s) => {
            // Bind each slot at its assigned (group, binding) so `toBindGroupLayoutEntry` can read
            // metadata off the `BoundSlot`. Identity of the original slot is preserved via the
            // wrapper's spread; only `__gen()` differs.
            const idx = slotIndex.get(s.slot);
            if (idx === undefined) {
                // Defensive: `shaderSlotEntries` and `resolveShaderBindings` walk the same
                // declarations, so this should be unreachable. Keep the check as a tripwire.
                throw new Error(
                    `pipeline: slot '${s.slot.name}' was reported by shaderSlotEntries but is ` +
                        `absent from resolveShaderBindings output (internal inconsistency).`
                );
            }
            const bound: BoundSlot = bindSlot(s.slot, idx.group, idx.binding);
            const visibility = s.slot.visibility ?? DEFAULT_VISIBILITY;
            return toBindGroupLayoutEntry(bound, visibility);
        });
        layouts.push(
            device.createBindGroupLayout({
                entries: bglEntries as unknown as GPUBindGroupLayoutEntry[],
                ...(labelBase !== undefined && { label: `${labelBase}.bgl[${depth}]` }),
            })
        );
    }
    return layouts;
}

/**
 * Compose a `GPURenderPipelineDescriptor` from a layout, a shader module, and a normalized state.
 * Fragment is omitted entirely when `state.fragment` is undefined (depth-only / shadow pipelines).
 */
function composeRenderPipelineDescriptor(
    layout: GPUPipelineLayout,
    module: GPUShaderModule,
    state: NormalizedPipelineState
): GPURenderPipelineDescriptor {
    const desc: GPURenderPipelineDescriptor = {
        layout,
        vertex: {
            module,
            entryPoint: state.vertex.entryPoint,
            ...(state.vertex.buffers !== undefined && {
                buffers: state.vertex.buffers as unknown as GPUVertexBufferLayout[],
            }),
            ...(state.vertex.constants !== undefined && { constants: state.vertex.constants }),
        },
        ...(state.primitive !== undefined && { primitive: state.primitive }),
        ...(state.depthStencil !== undefined && { depthStencil: state.depthStencil }),
        ...(state.multisample !== undefined && { multisample: state.multisample }),
        ...(state.fragment !== undefined && {
            fragment: {
                module,
                entryPoint: state.fragment.entryPoint,
                targets: state.fragment.targets as unknown as GPUColorTargetState[],
                ...(state.fragment.constants !== undefined && {
                    constants: state.fragment.constants,
                }),
            },
        }),
        ...(state.label !== undefined && { label: state.label }),
    };
    return desc;
}
