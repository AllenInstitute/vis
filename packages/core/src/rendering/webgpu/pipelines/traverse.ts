/**
 * Traversal helpers for the derived `BindingGraph` model (see `./binding-graph.ts`).
 *
 * The traversal is **per-shader**: each shader's `(group, binding)` resolution comes from
 * walking its own `declarations` array, filtering to `ResourceSlot`s, and looking up each
 * slot's `BindingGroup` via the registry maintained by `binding-graph.ts`.
 *
 * Resolution rules:
 * - **Group index** = `BindingGroup.depth` (the slot's containing group; root = 0).
 * - **Binding index** = the slot's position within its containing group's `slots` array.
 * - Two shaders that share a slot resolve it to the same `(group, binding)` automatically,
 *   because the slot lives in exactly one group.
 *
 * This module is intentionally distinct from the legacy `traversal.ts` (which operates over the
 * chain-style `binding-graphs.ts` and will be removed in Phase 9). The two coexist during the
 * phase transition.
 */

import { isResourceSlot, type BindingMap, type ResourceSlot } from '../resources';
import type { WgslShader } from '../shaders';
import { type BindingGraph, type BindingGroup, groupForSlot } from './binding-graph';

/** Resolve a single slot's `(group, binding)` or throw if it has not been assigned to a group. */
function resolveSlot(slot: ResourceSlot, shaderId: string): { group: number; binding: number } {
    const g = groupForSlot(slot);
    if (g === undefined) {
        throw new Error(
            `resolveShaderBindings: slot '${slot.name}' is not assigned to any group ` +
                `(shader id='${shaderId}'). Did you forget to wrap it in \`group({ slots: [...] })\`?`
        );
    }
    const binding = g.slots.indexOf(slot);
    if (binding < 0) {
        // Defensive: the registry says this slot is in `g` but indexOf disagrees. Impossible
        // unless someone mutated `g.slots` post-construction.
        throw new Error(
            `resolveShaderBindings: internal inconsistency — slot '${slot.name}' registered to ` +
                `group '${g.label ?? '<unlabeled>'}' (id='${g.id}') but absent from its slots array.`
        );
    }
    return { group: g.depth, binding };
}

/**
 * Resolve `{group, binding}` indices for every `ResourceSlot` the supplied `shader` declares.
 *
 * @returns a `BindingMap` covering the shader's slots; suitable for `bindShader(shader, map)`.
 *
 * @throws if any declared slot has not been assigned to a `BindingGroup`. This is normally
 * impossible when `graph` was produced by `bindings(shader)` — the same validation runs there —
 * but the per-slot check is repeated here as a defence-in-depth invariant.
 */
export function resolveShaderBindings(graph: BindingGraph, shader: WgslShader): BindingMap {
    // `graph` is currently used only as a witness that validation has occurred; future work may
    // narrow resolution to slots whose group is in `graph.groups`.
    void graph;
    const result = new Map<ResourceSlot, { group: number; binding: number }>();
    for (const decl of shader.declarations) {
        if (!isResourceSlot(decl)) continue;
        result.set(decl, resolveSlot(decl, shader.id));
    }
    return result;
}

/**
 * Enumerate every `(group, binding, slot, owner)` for a shader, sorted by `(group, binding)`.
 * Used by Phase 3 pipeline build (and potentially diagnostics) to walk a shader's binding
 * layout without going through `bindShader` first.
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
    void graph;
    const entries: { group: number; binding: number; slot: ResourceSlot; owner: BindingGroup }[] = [];
    for (const decl of shader.declarations) {
        if (!isResourceSlot(decl)) continue;
        const owner = groupForSlot(decl);
        if (owner === undefined) {
            throw new Error(
                `shaderSlotEntries: slot '${decl.name}' is not assigned to any group ` +
                    `(shader id='${shader.id}').`
            );
        }
        const binding = owner.slots.indexOf(decl);
        entries.push({ group: owner.depth, binding, slot: decl, owner });
    }
    entries.sort((a, b) => a.group - b.group || a.binding - b.binding);
    return entries;
}
