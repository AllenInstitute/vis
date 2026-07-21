import { type BindingMap, isResourceSlot, type ResourceSlot } from '../../resources';
import type { WgslShader } from '../../shaders';
import type { BindingGraph, BindingGroup } from './binding-graph';

/** Resolve a single slot's `(group, binding)` from the graph or throw if it is not present. */
function resolveSlot(slot: ResourceSlot, graph: BindingGraph, shaderId: string): { group: number; binding: number } {
    const entry = graph._slotIndex.get(slot);
    if (entry === undefined) {
        throw new Error(
            `resolveShaderBindings: slot '${slot.name}' is not present in the supplied graph ` +
                `(shader id='${shaderId}'). Did you forget to include it under the root passed to ` +
                '`bindings(root, shaders)`?'
        );
    }
    return { group: entry.group, binding: entry.binding };
}

/**
 * Resolve `{group, binding}` indices for every `ResourceSlot` the supplied `shader` declares.
 *
 * @returns a `BindingMap` covering the shader's slots; suitable for `bindShader(shader, map)`.
 *
 * @throws if any declared slot is not present in `graph._slotIndex`. This is normally impossible
 * when `graph` was produced by `bindings(root, shader)` — the same validation runs there — but
 * the per-slot check is repeated here as a defence-in-depth invariant.
 */
export function resolveShaderBindings(graph: BindingGraph, shader: WgslShader): BindingMap {
    const result = new Map<ResourceSlot, { group: number; binding: number }>();
    for (const decl of shader.declarations) {
        if (!isResourceSlot(decl)) continue;
        result.set(decl, resolveSlot(decl, graph, shader.id));
    }
    return result;
}

/**
 * Enumerate every `(group, binding, slot, owner)` for a shader, sorted by `(group, binding)`.
 * Used by pipeline build (and diagnostics) to walk a shader's binding layout without going
 * through `bindShader` first.
 */
export function shaderSlotEntries(
    graph: BindingGraph,
    shader: WgslShader
): ReadonlyArray<{
    readonly group: number;
    readonly binding: number;
    readonly slot: ResourceSlot;
    readonly owner: BindingGroup;
}> {
    const entries: { group: number; binding: number; slot: ResourceSlot; owner: BindingGroup }[] = [];
    for (const decl of shader.declarations) {
        if (!isResourceSlot(decl)) continue;
        const entry = graph._slotIndex.get(decl);
        if (entry === undefined) {
            throw new Error(
                `shaderSlotEntries: slot '${decl.name}' is not present in the supplied graph ` +
                    `(shader id='${shader.id}').`
            );
        }
        entries.push({ group: entry.group, binding: entry.binding, slot: decl, owner: entry.owner });
    }
    entries.sort((a, b) => a.group - b.group || a.binding - b.binding);
    return entries;
}
