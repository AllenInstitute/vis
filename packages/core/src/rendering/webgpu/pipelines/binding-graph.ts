/**
 * `BindingGroup` + `bindings()` — derived-DAG authoring model.
 *
 * Each `ResourceSlot` belongs to exactly one `BindingGroup` (assigned at `group()` construction).
 * Groups may nest via an optional `parent` link, forming a forest; a group's `depth` (and thus
 * the WGSL `@group(N)` index) is `parent ? parent.depth + 1 : 0`. The shader's `declarations`
 * array is the single source of truth for which slots a shader consumes — `bindings(shader)`
 * derives the canonical `BindingGraph` by walking those declarations and looking up each slot's
 * group. No redundant "slot ↔ shader" authoring is required.
 *
 * Authoring example:
 * ```ts
 * const camera   = slot.uniform('camera', Camera);
 * const lighting = slot.uniform('lighting', Lighting);
 * const albedo   = slot.texture('albedo', 'texture_2d<f32>');
 * const samp     = slot.sampler('samp', 'sampler');
 *
 * const frame    = group({ label: 'frame', slots: [camera, lighting] });
 * const material = group({ label: 'material', parent: frame, slots: [albedo, samp] });
 *
 * const shA = shader([camera, albedo, samp]); // doesn't use `lighting`
 * const shB = shader([camera, lighting]);
 *
 * const graphA   = bindings(shA);          // per-shader graph
 * const combined = bindings([shA, shB]);   // multi-shader (shared slots auto-detected)
 * ```
 *
 * Validation:
 *  1. **Slot uniqueness across groups** — `group()` rejects a slot that already belongs to a
 *     prior group. Enforced eagerly via a module-private `WeakMap`.
 *  2. **Group depth limit** — defaults to 4 (the typical WebGPU `maxBindGroups`). Configurable
 *     via `group({ maxDepth })` on any group in the chain.
 *  3. **Slot coverage** — `bindings()` throws when a shader declares a slot that has not been
 *     assigned to any group.
 *  4. **At least one shader** — `bindings()` rejects an empty input.
 *
 * Per-shader resolution lives in `./traverse.ts`. `resolveShaderBindings(graph, shader)` walks
 * `shader.declarations`, filters to `ResourceSlot`s, and emits `{group: depth, binding: index}`
 * for each by looking up the slot's group via the registry exposed below.
 */

import { isResourceSlot, type ResourceSlot } from '../resources';
import type { WgslShader } from '../shaders';

// ---- Public types -----------------------------------------------------------------------------

/**
 * An ordered, optionally-nested grouping of `ResourceSlot`s. Determines the `@group(N)` index
 * via `depth` (root groups are at depth 0) and the per-binding index via `slots[i]`'s position.
 *
 * Groups are immutable once constructed. To author a new layout, build a new `BindingGroup`.
 */
export type BindingGroup = {
    readonly __nodeType: 'binding-group';
    readonly id: string;
    readonly label?: string;
    readonly slots: readonly ResourceSlot[];
    readonly parent?: BindingGroup;
    /** `parent ? parent.depth + 1 : 0`. Used as the WGSL `@group(N)` index. */
    readonly depth: number;
};

/** Specification accepted by `group()`. */
export type GroupSpec = {
    readonly label?: string;
    readonly slots: readonly ResourceSlot[];
    readonly parent?: BindingGroup;
    /** Override the default group-depth limit (4). */
    readonly maxDepth?: number;
};

/**
 * A validated derivation from one or more shaders. Carries the shaders that were resolved and
 * the de-duplicated set of groups they reach (parents included transitively). Consumed by the
 * traversal helpers in `./traverse.ts` and by Phase 3 pipeline build.
 */
export type BindingGraph = {
    readonly __graphType: 'binding-graph';
    readonly shaders: readonly WgslShader[];
    /** All groups reachable from any shader's declared slots, parents included. */
    readonly groups: readonly BindingGroup[];
};

// ---- Runtime type guards -----------------------------------------------------------------------

export function isBindingGroup(value: unknown): value is BindingGroup {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __nodeType?: unknown }).__nodeType === 'binding-group'
    );
}

export function isBindingGraph(value: unknown): value is BindingGraph {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __graphType?: unknown }).__graphType === 'binding-graph'
    );
}

// ---- Slot ↔ group registry (module-private) ---------------------------------------------------

const slotToGroup = new WeakMap<ResourceSlot, BindingGroup>();

/**
 * Look up the `BindingGroup` a slot belongs to, or `undefined` if it has not been assigned via
 * `group()`. Exported for `./traverse.ts`; not part of the public-API barrel.
 */
export function groupForSlot(slot: ResourceSlot): BindingGroup | undefined {
    return slotToGroup.get(slot);
}

// ---- Construction ------------------------------------------------------------------------------

const DEFAULT_GROUP_DEPTH_LIMIT = 4;

let nextNodeId = 0;
function freshId(prefix: string): string {
    nextNodeId += 1;
    return `${prefix}#${nextNodeId}`;
}

/**
 * Construct a `BindingGroup`. Validates that every slot is a `ResourceSlot`, that no slot is
 * already assigned to another group, and that the resulting depth fits within the limit.
 *
 * @throws if any validation rule fails (see the file-level doc-comment for the full list).
 */
export function group(spec: GroupSpec): BindingGroup {
    const depth = spec.parent ? spec.parent.depth + 1 : 0;
    const maxDepth = spec.maxDepth ?? DEFAULT_GROUP_DEPTH_LIMIT;

    if (depth >= maxDepth) {
        throw new Error(
            `group: depth ${depth} reaches or exceeds the limit of ${maxDepth} ` +
                `(label='${spec.label ?? '<unlabeled>'}'). Increase 'maxDepth' or restructure ` +
                'the parent chain.'
        );
    }

    for (let i = 0; i < spec.slots.length; i++) {
        const s = spec.slots[i] as ResourceSlot;
        if (!isResourceSlot(s)) {
            throw new Error(
                `group: entry at index ${i} of group '${spec.label ?? '<unlabeled>'}' is not a ` +
                    'ResourceSlot (use slot.uniform/.texture/.sampler/.storage/etc.).'
            );
        }
        const prior = slotToGroup.get(s);
        if (prior !== undefined) {
            throw new Error(
                `group: slot '${s.name}' is already assigned to group '${prior.label ?? '<unlabeled>'}' ` +
                    `(id='${prior.id}'). A ResourceSlot may belong to exactly one BindingGroup.`
            );
        }
    }

    const node: BindingGroup = {
        __nodeType: 'binding-group',
        id: freshId('group'),
        ...(spec.label !== undefined && { label: spec.label }),
        slots: [...spec.slots],
        ...(spec.parent !== undefined && { parent: spec.parent }),
        depth,
    };

    // Register the slot → group mapping only after the group object exists, so error paths
    // above do not pollute the registry.
    for (const s of node.slots) {
        slotToGroup.set(s, node);
    }

    return node;
}

/**
 * Derive a `BindingGraph` from one shader or a list of shaders. Walks each shader's
 * declarations, filters to `ResourceSlot`s, validates that every slot is assigned to a group,
 * and returns the de-duplicated set of reached groups (transitively including parents).
 *
 * @throws if any declared slot is not assigned to a group, or if the input is empty.
 */
export function bindings(input: WgslShader | readonly WgslShader[]): BindingGraph {
    const shaders = Array.isArray(input) ? [...input] : [input as WgslShader];

    if (shaders.length === 0) {
        throw new Error('bindings: at least one shader is required');
    }

    const reached = new Set<BindingGroup>();
    for (const sh of shaders) {
        for (const decl of sh.declarations) {
            if (!isResourceSlot(decl)) continue;
            const g = slotToGroup.get(decl);
            if (g === undefined) {
                throw new Error(
                    `bindings: shader (id='${sh.id}') declares slot '${decl.name}' but it is not ` +
                        'assigned to any group (assign it via `group({ slots: [...] })`).'
                );
            }
            // Walk the parent chain so the resulting graph is closed under containment.
            let cur: BindingGroup | undefined = g;
            while (cur !== undefined) {
                reached.add(cur);
                cur = cur.parent;
            }
        }
    }

    return {
        __graphType: 'binding-graph',
        shaders,
        // Stable order: shallowest groups first, ties broken by construction id.
        groups: [...reached].sort((a, b) => a.depth - b.depth || a.id.localeCompare(b.id)),
    };
}
