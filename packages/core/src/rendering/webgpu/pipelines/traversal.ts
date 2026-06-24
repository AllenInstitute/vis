/**
 * Walks a `BindingGraph` and assigns concrete `{group, binding}` indices to every `Resource` it
 * contains. Exposes a two-phase API for use with per-drawable resource providers:
 *
 *  - `traverseBindingGraphLayout(graph)` — run once per graph. Computes the binding map, per-group
 *    BGL entries, and per-group `slots[]` arrays describing how each binding's concrete
 *    `ResourceData` is obtained (`{ kind: 'fixed', data }` or `{ kind: 'provider', provide }`).
 *  - `assembleBindGroupResources(layout, ctx)` — run once per drawable. Returns the
 *    `ResourceData[][]` ready to feed `GPUBindGroupEntry` creation. Provider slots are invoked
 *    with the supplied `ctx`; fixed slots pass their literal value through.
 *
 * `traverseBindingGraph` remains as a guarded single-call shim for legacy fixed-data graphs.
 * Passing a graph containing any `ResourceProvider` slot causes it to throw.
 *
 * Group/binding assignment is deterministic and based purely on position in the graph:
 *   - Group index = position of the group in the flattened walk of `graph.groups` (each top-level
 *     group plus its `subgroup` chain expands to one index per node).
 *   - Binding index = position within the group's `resources[]` array.
 *
 * **Layout vs. content invalidation discipline.** A `ResourceProvider` returning a different
 * `GPUBuffer` (or other `ResourceData`) of the *same shape* (same `usage` flags, within the same
 * declared size class) only invalidates the assembled bind group — the layout is unchanged.
 * Returning a `ResourceData` with different `usage` flags or a buffer outside the declared size
 * class is a *layout-shape* change: callers must reconstruct the graph and re-run
 * `traverseBindingGraphLayout`. The two-phase split exists to make this distinction cheap.
 */

import { type BindGroupLayoutEntry, ShaderStageFlag, type ShaderStageFlags } from '../native-types';
import { type BindingMap, bind, type Resource, toBindGroupLayoutEntry } from '../resources';
import type { BindingGraph, BindingGraphGroupNode, BindingGraphPipelineNode } from './binding-graphs';
import { type DrawContext, isResourceProvider, type ResourceProvider } from './draw-context';
import type { ResourceData } from './resources';

const ALL_STAGES: ShaderStageFlags = ShaderStageFlag.VERTEX | ShaderStageFlag.FRAGMENT | ShaderStageFlag.COMPUTE;

/**
 * Per-slot description emitted by `traverseBindingGraphLayout`. A `'fixed'` slot carries its
 * `ResourceData` directly; a `'provider'` slot carries a `ResourceProvider` to be invoked per
 * draw inside `assembleBindGroupResources`.
 */
export type SlotProvider =
    | { readonly kind: 'fixed'; readonly data: ResourceData }
    | { readonly kind: 'provider'; readonly provide: ResourceProvider };

/**
 * Output of `traverseBindingGraphLayout`. `bindings` and `layouts` are stable across drawables;
 * `slots` is consumed per draw by `assembleBindGroupResources`.
 */
export type LayoutResult = {
    bindings: BindingMap;
    /** `layouts[group]` is the BGL entry list for `@group(group)`. */
    layouts: BindGroupLayoutEntry[][];
    /** `slots[group][binding]` describes how to obtain the concrete `ResourceData` for that slot. */
    slots: SlotProvider[][];
};

/**
 * Output of the legacy single-call `traverseBindingGraph`. Identical in shape to before the
 * two-phase split; emitted only when every slot is fixed.
 */
export type TraversalResult = {
    bindings: BindingMap;
    /** `layouts[group]` is the BGL entry list for `@group(group)`. */
    layouts: BindGroupLayoutEntry[][];
    /** `bindGroupResources[group][binding]` is the GPU object for that slot. */
    bindGroupResources: ResourceData[][];
};

/**
 * Phase 1 of the two-phase API. Walks `graph` and produces the static layout artifacts: a
 * `BindingMap`, per-group `GPUBindGroupLayoutEntry` arrays, and per-group `SlotProvider` arrays.
 *
 * Throws if the same `Resource` object is referenced at more than one position in the graph
 * (a single resource cannot occupy two distinct `{group, binding}` slots).
 */
export function traverseBindingGraphLayout(graph: BindingGraph): LayoutResult {
    const flattened = flattenGroups(graph.groups);

    const bindings = new Map<Resource, { group: number; binding: number }>();
    const layouts: BindGroupLayoutEntry[][] = [];
    const slots: SlotProvider[][] = [];

    flattened.forEach((groupNode, groupIndex) => {
        const groupEntries: BindGroupLayoutEntry[] = [];
        const groupSlots: SlotProvider[] = [];

        groupNode.resources.forEach((resNode, bindingIndex) => {
            const descriptor = resNode.descriptor;

            if (bindings.has(descriptor)) {
                const prior = bindings.get(descriptor) as { group: number; binding: number };
                throw new Error(
                    `traverseBindingGraphLayout: resource '${descriptor.name}' appears at multiple ` +
                        `positions in the graph (group ${prior.group} binding ${prior.binding}, and ` +
                        `group ${groupIndex} binding ${bindingIndex}). A Resource may only be bound once.`
                );
            }

            bindings.set(descriptor, { group: groupIndex, binding: bindingIndex });

            const visibility = resolveVisibility(descriptor, resNode.pipelines);
            const bound = bind(descriptor, groupIndex, bindingIndex);
            groupEntries.push(toBindGroupLayoutEntry(bound, visibility));

            const slot: SlotProvider = isResourceProvider(resNode.gpu)
                ? { kind: 'provider', provide: resNode.gpu }
                : { kind: 'fixed', data: resNode.gpu };
            groupSlots.push(slot);
        });

        layouts.push(groupEntries);
        slots.push(groupSlots);
    });

    return { bindings, layouts, slots };
}

/**
 * Phase 2 of the two-phase API. Resolves each `SlotProvider` against `ctx` and returns a per-group
 * `ResourceData[][]` ready to populate `GPUBindGroupEntry` arrays. Cheap enough to call per
 * drawable per frame; provider invocations are the only non-trivial work.
 */
export function assembleBindGroupResources(layout: LayoutResult, ctx: DrawContext): ResourceData[][] {
    return layout.slots.map((groupSlots) =>
        groupSlots.map((slot) => (slot.kind === 'fixed' ? slot.data : slot.provide(ctx)))
    );
}

/**
 * Legacy single-call API. Computes layout and resolves all slots eagerly; equivalent to
 * `traverseBindingGraphLayout` followed by an `assembleBindGroupResources` that requires every
 * slot to be fixed. **Throws** if any slot is a `ResourceProvider` — provider-based graphs must
 * use the two-phase API directly.
 */
export function traverseBindingGraph(graph: BindingGraph): TraversalResult {
    const layout = traverseBindingGraphLayout(graph);
    const bindGroupResources: ResourceData[][] = layout.slots.map((groupSlots, groupIndex) =>
        groupSlots.map((slot, bindingIndex) => {
            if (slot.kind === 'provider') {
                throw new Error(
                    `traverseBindingGraph: slot at group ${groupIndex} binding ${bindingIndex} ` +
                        'is a ResourceProvider; provider-based graphs must use ' +
                        'traverseBindingGraphLayout + assembleBindGroupResources.'
                );
            }
            return slot.data;
        })
    );
    return { bindings: layout.bindings, layouts: layout.layouts, bindGroupResources };
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
