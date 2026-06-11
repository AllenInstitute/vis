/**
 * Walks a `BindingGraph` and assigns concrete `{group, binding}` indices to every `Resource` it
 * contains, producing the artifacts needed to drive a WebGPU pipeline:
 *
 *  - `bindings`: a `BindingMap` consumable by `bindShader()` to resolve a `WgslShader`'s `Resource`
 *    declarations into renderable WGSL.
 *  - `layouts`: per-group bind-group-layout-entry arrays (one per group index).
 *  - `bindGroupResources`: per-group `ResourceData` arrays, parallel to `layouts`, so the caller
 *    can build `GPUBindGroupEntry` objects at draw time (typically by calling `createView()` on
 *    textures, which requires a live `GPUDevice`).
 *
 * Group/binding assignment is deterministic and based purely on position in the graph:
 *   - Group index = position of the group in the flattened walk of `graph.groups` (each top-level
 *     group plus its `subgroup` chain expands to one index per node).
 *   - Binding index = position within the group's `resources[]` array.
 */

import {
    type BindGroupLayoutEntry,
    ShaderStageFlag,
    type ShaderStageFlags,
} from '../native-types';
import { type BindingMap, bind, type Resource, toBindGroupLayoutEntry } from '../resources';
import type { BindingGraph, BindingGraphGroupNode, BindingGraphPipelineNode } from './binding-graphs';
import type { ResourceData } from './resources';

const ALL_STAGES: ShaderStageFlags = ShaderStageFlag.VERTEX | ShaderStageFlag.FRAGMENT | ShaderStageFlag.COMPUTE;

export type TraversalResult = {
    bindings: BindingMap;
    /** `layouts[group]` is the BGL entry list for `@group(group)`. */
    layouts: BindGroupLayoutEntry[][];
    /** `bindGroupResources[group][binding]` is the GPU object for that slot. */
    bindGroupResources: ResourceData[][];
};

/**
 * Walks `graph` and produces a `BindingMap` + per-group BGL entries + per-group resource arrays.
 *
 * Throws if the same `Resource` object is referenced at more than one position in the graph
 * (a single resource cannot occupy two distinct `{group, binding}` slots).
 */
export function traverseBindingGraph(graph: BindingGraph): TraversalResult {
    const flattened = flattenGroups(graph.groups);

    const bindings = new Map<Resource, { group: number; binding: number }>();
    const layouts: BindGroupLayoutEntry[][] = [];
    const bindGroupResources: ResourceData[][] = [];

    flattened.forEach((groupNode, groupIndex) => {
        const groupEntries: BindGroupLayoutEntry[] = [];
        const groupResources: ResourceData[] = [];

        groupNode.resources.forEach((resNode, bindingIndex) => {
            const descriptor = resNode.descriptor;

            if (bindings.has(descriptor)) {
                const prior = bindings.get(descriptor) as { group: number; binding: number };
                throw new Error(
                    `traverseBindingGraph: resource '${descriptor.name}' appears at multiple ` +
                        `positions in the graph (group ${prior.group} binding ${prior.binding}, and ` +
                        `group ${groupIndex} binding ${bindingIndex}). A Resource may only be bound once.`
                );
            }

            bindings.set(descriptor, { group: groupIndex, binding: bindingIndex });

            const visibility = resolveVisibility(descriptor, resNode.pipelines);
            const bound = bind(descriptor, groupIndex, bindingIndex);
            groupEntries.push(toBindGroupLayoutEntry(bound, visibility));
            groupResources.push(resNode.gpu);
        });

        layouts.push(groupEntries);
        bindGroupResources.push(groupResources);
    });

    return { bindings, layouts, bindGroupResources };
}

/**
 * Expands `graph.groups` into a flat array, walking each top-level group's `subgroup` chain. The
 * resulting index is the `@group(N)` index assigned to each group node.
 */
function flattenGroups(roots: BindingGraphGroupNode[]): BindingGraphGroupNode[] {
    const out: BindingGraphGroupNode[] = [];
    for (const root of roots) {
        let cur: BindingGraphGroupNode | undefined = root;
        while (cur) {
            out.push(cur);
            cur = cur.subgroup;
        }
    }
    return out;
}

/**
 * Resolves the `visibility` (`ShaderStageFlags`) for a resource:
 *   - If `descriptor.visibility` is set, it wins.
 *   - Else, union the `stages` of every pipeline that references the resource.
 *   - Else, fall back to VERTEX|FRAGMENT|COMPUTE (permissive default).
 */
function resolveVisibility(descriptor: Resource, pipelines: BindingGraphPipelineNode[]): ShaderStageFlags {
    if (descriptor.visibility !== undefined) return descriptor.visibility;
    let union: ShaderStageFlags = 0;
    let anySpecified = false;
    for (const p of pipelines) {
        if (p.stages !== undefined) {
            union |= p.stages;
            anySpecified = true;
        }
    }
    return anySpecified ? union : ALL_STAGES;
}
