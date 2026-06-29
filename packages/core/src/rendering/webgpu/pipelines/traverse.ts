/**
 * Traversal helpers for the variadic-children `BindingGraph` model (see `./binding-graph.ts`).
 *
 * The traversal is **per-shader**: each shader's `(group, binding)` resolution comes from
 * walking its own `declarations` array, filtering to `ResourceSlot`s, and looking up each slot
 * in the graph-local `_slotIndex`. Slot ownership is graph-local — the same `ResourceSlot` can
 * resolve to different indices in two different graphs.
 *
 * Resolution rules:
 * - **Group index** = the slot's graph-local depth (root = 0).
 * - **Binding index** = the slot's position within its owning group's `slots` array.
 * - Two shaders that share a slot in the *same graph* resolve it to identical `(group, binding)`,
 *   because `bindings()` enforces within-tree slot uniqueness.
 *
 * This module is intentionally distinct from the legacy `traversal.ts` (which operates over the
 * chain-style `binding-graphs.ts` and will be removed in Phase 9). The two coexist during the
 * phase transition.
 */

import { isResourceSlot, type BindingMap, type ResourceSlot } from '../resources';
import type { WgslShader } from '../shaders';
import type { BindingGraph, BindingGroup } from './binding-graph';

/** Resolve a single slot's `(group, binding)` from the graph or throw if it is not present. */
function resolveSlot(
    slot: ResourceSlot,
    graph: BindingGraph,
    shaderId: string
): { group: number; binding: number } {
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
