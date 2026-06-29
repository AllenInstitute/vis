/**
 * `pipeline(graph, shader, state, device): BuiltPipeline` — build a `GPURenderPipeline` from a
 * derived `BindingGraph`, a `WgslShader`, and a `PipelineStateDescriptor`.
 *
 * Build sequence:
 *   1. `resolveShaderBindings(graph, shader)` — derive `(group, binding)` per slot.
 *   2. `bindShader(shader, slotIndex)` + `asSource(...)` — produce final WGSL.
 *   3. `makeShaderDataDefinitions(wgsl)` — reflect struct layouts onto `BuiltPipeline.defs`.
 *      Stashed for Phase 4's `BufferResource` round-trip; not consumed by Phase 3 itself.
 *   4. Bucket `shaderSlotEntries(graph, shader)` by group depth → manually construct
 *      `GPUBindGroupLayoutEntry`s via existing `toBindGroupLayoutEntry`. Sparse depths (a shader
 *      uses depth 0 + 2 but not 1) get an empty layout so `bindGroupLayouts[i]` always equals
 *      depth `i`.
 *   5. `device.createBindGroupLayout` ×N → `createPipelineLayout` → `createShaderModule`.
 *   6. Compose `GPURenderPipelineDescriptor` from the normalized state and `createRenderPipeline`.
 *
 * The fingerprint field is populated by Slice 3c (cache); Slice 3b leaves a placeholder.
 */

import { v4 as uuidv4 } from 'uuid';
import { makeShaderDataDefinitions, type ShaderDataDefinitions } from 'webgpu-utils';
import { ShaderStageFlag, type ShaderStageFlags } from '../native-types';
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
import { pipelineFingerprint } from './fingerprint';
import {
    type NormalizedPipelineState,
    normalizePipelineState,
    type PipelineStateDescriptor,
} from './pipeline-state';
import { getCached, setCached } from './pipeline-cache';
import { resolveShaderBindings, shaderSlotEntries } from './traverse';

/**
 * The compiled artefact returned by `pipeline()`.
 *
 * - `gpu` is the `GPURenderPipeline` ready for `setPipeline()`.
 * - `bindGroupLayouts[i]` corresponds to group index `i` (= depth). Sparse depths are empty BGLs.
 * - `slotIndex` is the `BindingMap` produced by `resolveShaderBindings` — Drawables consult it to
 *   look up `(group, binding)` for each `ResourceSlot` when assembling bind groups.
 * - `defs` is the `webgpu-utils` reflection cache. Phase 4 will feed this to `makeStructuredView`.
 * - `fingerprint` is populated by Slice 3c; Slice 3b leaves it as the sentinel `'pending'`.
 */
export interface BuiltPipeline {
    readonly id: string;
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
 * Build a `BuiltPipeline` from a `BindingGraph` + `WgslShader` + `PipelineStateDescriptor`.
 *
 * Slice 3b: no cache; every call performs all device work. Slice 3c adds a per-device fingerprint
 * cache that wraps this function.
 */
export function pipeline(
    graph: BindingGraph,
    shader: WgslShader,
    state: PipelineStateDescriptor,
    device: GPUDevice
): BuiltPipeline {
    const normalizedState = normalizePipelineState(state);
    const slotIndex = resolveShaderBindings(graph, shader);
    const fingerprint = pipelineFingerprint(shader, slotIndex, normalizedState);

    const cached = getCached(device, fingerprint);
    if (cached !== undefined) return cached;

    const boundShader = bindShader(shader, slotIndex);
    const wgsl = asSource(boundShader);
    const defs = makeShaderDataDefinitions(wgsl);

    const bindGroupLayouts = buildBindGroupLayouts(graph, shader, slotIndex, device, state.label);
    const layout = device.createPipelineLayout({
        bindGroupLayouts: [...bindGroupLayouts],
        ...(state.label !== undefined && { label: `${state.label}.layout` }),
    });
    const module = device.createShaderModule({
        code: wgsl,
        ...(state.label !== undefined && { label: `${state.label}.module` }),
    });

    const descriptor = composeRenderPipelineDescriptor(layout, module, normalizedState);
    const gpu = device.createRenderPipeline(descriptor);

    const built: BuiltPipeline = Object.freeze({
        id: uuidv4(),
        gpu,
        layout,
        bindGroupLayouts,
        slotIndex,
        defs,
        fingerprint,
        state: normalizedState,
        shader,
    });
    setCached(device, fingerprint, built);
    return built;
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
        const bglEntries: GPUBindGroupLayoutEntry[] = slots.map((s) => {
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
                entries: bglEntries,
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
                buffers: state.vertex.buffers as GPUVertexBufferLayout[],
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
                targets: state.fragment.targets as GPUColorTargetState[],
                ...(state.fragment.constants !== undefined && {
                    constants: state.fragment.constants,
                }),
            },
        }),
        ...(state.label !== undefined && { label: state.label }),
    };
    return desc;
}
