/**
 * Traversal helpers for the new DAG `BindingGraph` (see `./binding-graph.ts`).
 *
 * The traversal is **per-shader**: each shader leaf appearing in any `SlotNode.usedBy` gets its
 * own `(group, binding)` resolution. Two shaders may share a slot — they will both see that
 * slot at the same `(group, binding)` because the slot lives in exactly one group node.
 *
 * Resolution rules:
 * - **Group index** = the depth of the containing `GroupNode` along the path from the first root
 *   that reaches the shader. Root groups are at depth 0. Nested children at depth+1.
 * - **Binding index** = the position of the slot within its containing group's `slots` array
 *   (slots ordered left-to-right in the POJO descriptor).
 * - A shader that does not appear in any `SlotNode.usedBy` resolves to an empty `BindingMap`
 *   (the caller likely passed the wrong graph).
 *
 * This module is intentionally distinct from the legacy `traversal.ts` (which operates over the
 * chain-style `binding-graphs.ts` and will be removed in Phase 9). The two coexist during the
 * phase transition.
 */

import type { BindingMap } from '../resources';
import type { ResourceSlot } from '../resources';
import type { WgslShader } from '../shaders';
import type { BindingGraph, GroupNode, SlotNode } from './binding-graph';

/**
 * Resolve `{group, binding}` indices for every slot the supplied `shader` consumes in `graph`.
 *
 * @returns a `BindingMap` covering the shader's slots; suitable for `bindShader(shader, map)`.
 *
 * @throws if the same slot reaches the shader along two different group paths (this should be
 * impossible if `bindings()` accepted the graph, since slot-uniqueness is enforced at
 * construction; the check here is a defensive invariant).
 */
export function resolveShaderBindings(graph: BindingGraph, shader: WgslShader): BindingMap {
    const result = new Map<ResourceSlot, { group: number; binding: number }>();

    const visit = (g: GroupNode, depth: number): void => {
        g.slots.forEach((sn, bindingIndex) => {
            if (sn.usedBy.includes(shader)) {
                const prior = result.get(sn.slot);
                if (prior !== undefined && (prior.group !== depth || prior.binding !== bindingIndex)) {
                    throw new Error(
                        `resolveShaderBindings: slot '${sn.slot.name}' reachable along two paths for ` +
                            `shader id='${shader.id}' (prior {group: ${prior.group}, binding: ${prior.binding}}, ` +
                            `new {group: ${depth}, binding: ${bindingIndex}}). This indicates a corrupted ` +
                            'BindingGraph; rebuild it with bindings().'
                    );
                }
                result.set(sn.slot, { group: depth, binding: bindingIndex });
            }
        });
        g.groups.forEach(child => visit(child, depth + 1));
    };

    graph.roots.forEach(r => visit(r, 0));

    return result;
}

/**
 * Enumerate every `(group, binding, slot)` reachable for a shader. Sorted by group then binding.
 * Used by Phase 3 pipeline build (and potentially diagnostics) to walk a shader's binding layout
 * without going through `bindShader` first.
 */
export function shaderSlotEntries(
    graph: BindingGraph,
    shader: WgslShader
): ReadonlyArray<{ readonly group: number; readonly binding: number; readonly node: SlotNode }> {
    const entries: { group: number; binding: number; node: SlotNode }[] = [];

    const visit = (g: GroupNode, depth: number): void => {
        g.slots.forEach((sn, bindingIndex) => {
            if (sn.usedBy.includes(shader)) {
                entries.push({ group: depth, binding: bindingIndex, node: sn });
            }
        });
        g.groups.forEach(child => visit(child, depth + 1));
    };

    graph.roots.forEach(r => visit(r, 0));
    entries.sort((a, b) => (a.group - b.group) || (a.binding - b.binding));
    return entries;
}
