import { v4 as uuidv4 } from 'uuid';
import { isResourceSlot, type ResourceSlot } from '../binding';
import type { WgslShader } from '../shaders';

// ---- Public types -----------------------------------------------------------------------------

/**
 * An immutable tree node carrying ordered slot bindings and ordered subgroup children. Depth
 * and parent links are graph-local and do NOT live on this object — see `BindingGraph._groupDepth`.
 *
 * To author a new layout, build a new `BindingGroup`. Two `bindings()` calls over disjoint trees
 * may resolve the same slot identity to different `(group, binding)` indices.
 */
export type BindingGroup = {
    readonly __nodeType: 'binding-group';
    readonly id: string;
    readonly label?: string;
    /** Slot children in source order; each one's index in this array is its binding index. */
    readonly slots: readonly ResourceSlot[];
    /** Subgroup children in source order. Each becomes a nested group at depth+1 in a graph. */
    readonly subgroups: readonly BindingGroup[];
    /** Per-node maximum depth permitted at this position in a tree (default 4). */
    readonly maxDepth: number;
};

/** Optional metadata accepted as the first positional argument of `group()`. */
export type GroupSpec = {
    readonly label?: string;
    /** Override the default group-depth limit (4). */
    readonly maxDepth?: number;
};

/**
 * A validated derivation from a `BindingGroup` tree plus one or more shaders. Carries the root,
 * the shaders that were resolved, and graph-local slot↔binding + group↔depth indices.
 */
export type BindingGraph = {
    readonly __graphType: 'binding-graph';
    /** The root group supplied to `bindings()`. Lives at depth 0 in this graph. */
    readonly root: BindingGroup;
    readonly shaders: readonly WgslShader[];
    /** All groups reachable from `root`, sorted shallowest-first with ties broken by id. */
    readonly groups: readonly BindingGroup[];
    /** Graph-local resolution of every slot reachable from `root`. */
    readonly _slotIndex: ReadonlyMap<
        ResourceSlot,
        { readonly group: number; readonly binding: number; readonly owner: BindingGroup }
    >;
    /** Graph-local depth lookup for every group in `groups`. */
    readonly _groupDepth: ReadonlyMap<BindingGroup, number>;
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

// ---- Construction ------------------------------------------------------------------------------

const DEFAULT_GROUP_DEPTH_LIMIT = 4;

/**
 * Returns true when `value` is a plain `GroupSpec` (an object that is neither a `ResourceSlot`
 * nor a `BindingGroup`). Used by `group()` to detect the optional first-arg-as-spec overload.
 */
function isGroupSpec(value: unknown): value is GroupSpec {
    return (
        typeof value === 'object' &&
        value !== null &&
        !isResourceSlot(value) &&
        !isBindingGroup(value)
    );
}

/**
 * Construct a `BindingGroup`. Accepts an optional spec object followed by any number of
 * `ResourceSlot` and/or `BindingGroup` children. Children are bucketed by kind preserving
 * their relative source order; slot children's positions become this group's binding indices.
 *
 * Overloads:
 * ```ts
 * group(slotA, slotB)                      // no spec
 * group({ label: 'frame' }, slotA, slotB)  // with spec
 * group({ label: 'frame' }, slotA, subgroup, slotB) // mixed children
 * ```
 *
 * Validation performed here is shallow: each variadic arg must be a `ResourceSlot` or
 * `BindingGroup`. Within-tree slot uniqueness and per-node `maxDepth` are validated later by
 * `bindings()` because they are tree-shape invariants, not local construction invariants.
 */
export function group(...args: Array<GroupSpec | ResourceSlot | BindingGroup>): BindingGroup {
    let spec: GroupSpec | undefined;
    let children: Array<ResourceSlot | BindingGroup>;
    if (args.length > 0 && isGroupSpec(args[0])) {
        spec = args[0];
        children = args.slice(1) as Array<ResourceSlot | BindingGroup>;
    } else {
        children = args as Array<ResourceSlot | BindingGroup>;
    }

    const slots: ResourceSlot[] = [];
    const subgroups: BindingGroup[] = [];
    for (let i = 0; i < children.length; i++) {
        const c = children[i];
        if (isResourceSlot(c)) {
            slots.push(c);
        } else if (isBindingGroup(c)) {
            subgroups.push(c);
        } else {
            throw new Error(
                `group: child at position ${i} of group '${spec?.label ?? '<unlabeled>'}' is ` +
                    'neither a ResourceSlot nor a BindingGroup.'
            );
        }
    }

    const node: BindingGroup = {
        __nodeType: 'binding-group',
        id: uuidv4(),
        ...(spec?.label !== undefined && { label: spec.label }),
        slots,
        subgroups,
        maxDepth: spec?.maxDepth ?? DEFAULT_GROUP_DEPTH_LIMIT,
    };

    return Object.freeze(node);
}

/**
 * Derive a `BindingGraph` from a root `BindingGroup` and one or more shaders. Walks the tree
 * top-down assigning each node a depth, builds the slot↔binding index, enforces per-node
 * `maxDepth` + within-tree slot uniqueness, and validates that every shader's declared slots
 * appear in the tree.
 *
 * Resolution rules:
 *  - **Slot ownership is graph-local:** a `ResourceSlot` may appear in multiple unrelated trees;
 *    its `(group, binding)` is determined per-graph here, not stored on the slot.
 *  - **Within a tree a slot may appear at most once** (enforced here, not by `group()`).
 *  - **Binding indices** are assigned only among a group's *slot* children, in source order;
 *    subgroup children can be interleaved without affecting them.
 *  - **Group depth** is graph-local (root = 0, subgroup = parent + 1), stored on the graph
 *    (`_groupDepth`), not on the `BindingGroup`. **`maxDepth`** (per-node, default 4) is enforced
 *    at each subgroup as depth is computed. Per-shader resolution lives in `./traverse.ts`.
 *
 * @throws if the supplied input violates any of the validation rules listed above.
 */
export function bindings(root: BindingGroup, ...shaders: readonly WgslShader[]): BindingGraph {
    if (!isBindingGroup(root)) {
        throw new Error('bindings: first argument must be a BindingGroup (constructed via `group()`).');
    }
    if (shaders.length === 0) {
        throw new Error('bindings: at least one shader is required');
    }

    const slotIndex = new Map<
        ResourceSlot,
        { group: number; binding: number; owner: BindingGroup }
    >();
    const groupDepth = new Map<BindingGroup, number>();
    const allGroups: BindingGroup[] = [];

    // Iterative DFS so the stack is explicit and the error messages can mention the offending
    // node without recursion-driven obfuscation.
    type Frame = { node: BindingGroup; depth: number };
    const stack: Frame[] = [{ node: root, depth: 0 }];
    while (stack.length > 0) {
        const { node, depth } = stack.pop() as Frame;

        if (depth >= node.maxDepth) {
            throw new Error(
                `bindings: group '${node.label ?? '<unlabeled>'}' (id='${node.id}') reached depth ` +
                    `${depth} which meets or exceeds its maxDepth of ${node.maxDepth}.`
            );
        }

        if (groupDepth.has(node)) {
            // A group reached twice via different paths means the same group instance was used
            // as a subgroup of more than one parent (or transitively a descendant of itself).
            // Rare in practice but cheap to catch.
            throw new Error(
                `bindings: group '${node.label ?? '<unlabeled>'}' (id='${node.id}') appears more ` +
                    'than once in the tree (a BindingGroup may be referenced as a subgroup at ' +
                    'most once per graph).'
            );
        }
        groupDepth.set(node, depth);
        allGroups.push(node);

        for (let i = 0; i < node.slots.length; i++) {
            const slot = node.slots[i] as ResourceSlot;
            if (slotIndex.has(slot)) {
                const prior = slotIndex.get(slot) as { owner: BindingGroup };
                throw new Error(
                    `bindings: slot '${slot.name}' appears more than once in the tree ` +
                        `(first owner: group '${prior.owner.label ?? '<unlabeled>'}'; ` +
                        `duplicate owner: group '${node.label ?? '<unlabeled>'}'). A slot may ` +
                        'appear at most once per graph.'
                );
            }
            slotIndex.set(slot, { group: depth, binding: i, owner: node });
        }

        // Push subgroups in reverse so DFS visits them left-to-right (stable, intuitive order).
        for (let i = node.subgroups.length - 1; i >= 0; i--) {
            stack.push({ node: node.subgroups[i] as BindingGroup, depth: depth + 1 });
        }
    }

    // Validate every shader's declared slots are present in this graph.
    for (const sh of shaders) {
        for (const decl of sh.declarations) {
            if (!isResourceSlot(decl)) continue;
            if (!slotIndex.has(decl)) {
                throw new Error(
                    `bindings: shader (id='${sh.id}') declares slot '${decl.name}' but it is not ` +
                        "present in the supplied group tree (rooted at '" +
                        (root.label ?? '<unlabeled>') +
                        "').",
                );
            }
        }
    }

    // Stable group order: shallowest first. `allGroups` is populated in deterministic DFS
    // discovery order and `Array.prototype.sort` is stable, so same-depth ties keep that DFS
    // order without needing a synthetic construction id.
    allGroups.sort((a, b) => {
        const da = groupDepth.get(a) as number;
        const db = groupDepth.get(b) as number;
        return da - db;
    });

    const graph: BindingGraph = {
        __graphType: 'binding-graph',
        root,
        shaders,
        groups: allGroups,
        _slotIndex: slotIndex,
        _groupDepth: groupDepth,
    };
    return Object.freeze(graph);
}
