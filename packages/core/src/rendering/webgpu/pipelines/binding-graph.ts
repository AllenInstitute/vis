/**
 * `BindingGraph` (DAG) + `bindings()` factory — Phase 2 replacement for the legacy chain-style
 * `binding-graphs.ts`.
 *
 * The graph is a **DAG over Groups and Slots**, with `WgslShader` instances as leaves:
 *
 * ```
 *   GroupNode ──contains──▶ GroupNode ─────────────▶ SlotNode
 *                       └──▶ SlotNode ──usedBy──▶ WgslShader
 * ```
 *
 * - `GroupNode` defines a `@group(N)` index by its depth from a root group. Nested children
 *   become deeper group indices. Multiple GroupNodes may live at the same depth (siblings) but
 *   any single `ResourceSlot` belongs to exactly one path → exactly one `(group, binding)` pair.
 * - `SlotNode` carries a `ResourceSlot` and a `usedBy: WgslShader[]` fan-out. Several shaders
 *   may consume the same slot (DAG fan-out); they all see it at the same `(group, binding)`.
 * - The graph deliberately has no `PipelineNode`. Pipeline state (blend/depth/primitive/etc.) is
 *   supplied at build time by `pipeline(graph, shader, state, device)` (Phase 3). The leaves of
 *   the binding DAG are bare `WgslShader` instances, identified by their internal `id`.
 *
 * Validation performed by `bindings()`:
 *  1. **Slot uniqueness in the DAG** — each `ResourceSlot` may appear in at most one `SlotNode`.
 *  2. **Slot coverage per shader** — for every shader appearing in any `usedBy`, every
 *     `ResourceSlot` declared in `shader.declarations` is supplied by exactly one `SlotNode`
 *     that lists this shader in its `usedBy`.
 *  3. **No orphan declarations** — a shader cannot reference a slot that the graph does not
 *     provide for it (under coverage above).
 *  4. **Group depth limit** — defaults to 4 (matches the WebGPU spec's typical `maxBindGroups`).
 *
 * Per-shader `(group, binding)` resolution is performed by `resolveShaderBindings(graph, shader)`
 * in `./traverse.ts`. Group index = depth of containing group from any root that reaches the
 * shader. Binding index = position of the slot within that group's `slots` array.
 */

import { isResourceSlot, type ResourceSlot } from '../resources';
import type { WgslShader } from '../shaders';

// ---- DAG types --------------------------------------------------------------------------------

/** A `ResourceSlot` placed in a group and shared by one or more shader leaves. */
export type SlotNode = {
    readonly __nodeType: 'slot';
    readonly id: string;
    readonly slot: ResourceSlot;
    /** Shader leaves that consume this slot. Duplicates ignored; identity-compared. */
    readonly usedBy: readonly WgslShader[];
};

/** A group containing slots and/or nested groups. Determines the `@group(N)` index by depth. */
export type GroupNode = {
    readonly __nodeType: 'group';
    readonly id: string;
    readonly label?: string;
    /** Slots placed directly in this group. Order defines binding indices. */
    readonly slots: readonly SlotNode[];
    /** Nested child groups (each becomes the next deeper group index). */
    readonly groups: readonly GroupNode[];
};

/** Root of a validated binding graph: a non-empty list of root groups. */
export type BindingGraph = {
    readonly __graphType: 'binding-graph';
    readonly roots: readonly GroupNode[];
};

// ---- POJO descriptors (input shape) -----------------------------------------------------------

/** Input shape for a slot in the POJO descriptor passed to `bindings()`. */
export type SlotDescriptor = {
    readonly slot: ResourceSlot;
    readonly usedBy: readonly WgslShader[];
};

/** Input shape for a group in the POJO descriptor passed to `bindings()`. */
export type GroupDescriptor = {
    readonly label?: string;
    readonly slots?: readonly SlotDescriptor[];
    readonly groups?: readonly GroupDescriptor[];
};

/** Top-level descriptor accepted by `bindings()`. Mirrors `BindingGraph` but with POJO inputs. */
export type BindingsDescriptor = {
    readonly groups: readonly GroupDescriptor[];
    /** Optional override of the default depth limit (4, matching the typical `maxBindGroups`). */
    readonly groupDepthLimit?: number;
};

// ---- Factories --------------------------------------------------------------------------------

/** Convenience factory for a `SlotDescriptor` (object form). */
export function binding(slot: ResourceSlot, usedBy: readonly WgslShader[]): SlotDescriptor {
    return { slot, usedBy };
}

/** Convenience factory for a `GroupDescriptor` (object form). */
export function group(
    options: { label?: string; slots?: readonly SlotDescriptor[]; groups?: readonly GroupDescriptor[] } = {}
): GroupDescriptor {
    return options;
}

// ---- Runtime type guards -----------------------------------------------------------------------

export function isSlotNode(value: unknown): value is SlotNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __nodeType?: unknown }).__nodeType === 'slot'
    );
}

export function isGroupNode(value: unknown): value is GroupNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __nodeType?: unknown }).__nodeType === 'group'
    );
}

export function isBindingGraph(value: unknown): value is BindingGraph {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __graphType?: unknown }).__graphType === 'binding-graph'
    );
}

// ---- Validation + construction -----------------------------------------------------------------

const DEFAULT_GROUP_DEPTH_LIMIT = 4;

let nextNodeId = 0;
function freshId(prefix: string): string {
    nextNodeId += 1;
    return `${prefix}#${nextNodeId}`;
}

/**
 * Construct and validate a `BindingGraph` from a POJO descriptor.
 *
 * @throws if any of the validation rules in this module's file-level doc-comment are violated.
 */
export function bindings(descriptor: BindingsDescriptor): BindingGraph {
    const depthLimit = descriptor.groupDepthLimit ?? DEFAULT_GROUP_DEPTH_LIMIT;

    if (!descriptor.groups || descriptor.groups.length === 0) {
        throw new Error('bindings: descriptor must contain at least one root group');
    }

    // Step 1: walk POJO → typed DAG nodes. Track every slot occurrence for uniqueness check.
    const slotOccurrences = new Map<ResourceSlot, { group: GroupNode; binding: number }>();

    const buildGroup = (desc: GroupDescriptor, depth: number): GroupNode => {
        if (depth > depthLimit) {
            throw new Error(
                `bindings: group depth ${depth} exceeds the limit of ${depthLimit} ` +
                    `(label='${desc.label ?? '<unlabeled>'}')`
            );
        }
        const slots: SlotNode[] = (desc.slots ?? []).map((s, bindingIndex) => {
            // Validate the slot is actually a ResourceSlot.
            if (!isResourceSlot(s.slot)) {
                throw new Error(
                    `bindings: entry at group '${desc.label ?? '<unlabeled>'}' binding ${bindingIndex} ` +
                        `is not a ResourceSlot (did you forget to use slot.uniform/.texture/.sampler/etc.?)`
                );
            }
            // Deduplicate `usedBy` by identity while preserving first-seen order.
            const seen = new Set<WgslShader>();
            const usedBy: WgslShader[] = [];
            for (const sh of s.usedBy) {
                if (!seen.has(sh)) {
                    seen.add(sh);
                    usedBy.push(sh);
                }
            }
            const node: SlotNode = {
                __nodeType: 'slot',
                id: freshId('slot'),
                slot: s.slot,
                usedBy,
            };
            return node;
        });

        const node: GroupNode = {
            __nodeType: 'group',
            id: freshId('group'),
            ...(desc.label !== undefined && { label: desc.label }),
            slots,
            groups: (desc.groups ?? []).map((g) => buildGroup(g, depth + 1)),
        };

        // Record slot occurrences for uniqueness validation, *after* the node exists.
        slots.forEach((sn, bindingIndex) => {
            const prior = slotOccurrences.get(sn.slot);
            if (prior !== undefined) {
                throw new Error(
                    `bindings: slot '${sn.slot.name}' appears in multiple SlotNodes ` +
                        `(group '${prior.group.label ?? '<unlabeled>'}' binding ${prior.binding}, ` +
                        `and group '${node.label ?? '<unlabeled>'}' binding ${bindingIndex}). ` +
                        `Each ResourceSlot may belong to exactly one SlotNode.`
                );
            }
            slotOccurrences.set(sn.slot, { group: node, binding: bindingIndex });
        });

        return node;
    };

    const roots = descriptor.groups.map((g) => buildGroup(g, 1));

    // Step 2: per-shader coverage validation.
    // For every shader appearing in any SlotNode.usedBy, every ResourceSlot in its declarations
    // must be supplied by some SlotNode.usedBy ⟶ this shader. The reverse — a SlotNode naming a
    // shader that does not actually declare the slot — is permitted (harmless; the slot simply
    // contributes to that shader's bind-group layout without being read).
    const shaderToProvidedSlots = new Map<WgslShader, Set<ResourceSlot>>();
    const walk = (g: GroupNode): void => {
        for (const sn of g.slots) {
            for (const shader of sn.usedBy) {
                let set = shaderToProvidedSlots.get(shader);
                if (!set) {
                    set = new Set();
                    shaderToProvidedSlots.set(shader, set);
                }
                set.add(sn.slot);
            }
        }
        for (const child of g.groups) walk(child);
    };
    for (const r of roots) walk(r);

    for (const [shader, provided] of shaderToProvidedSlots) {
        const declared = new Set<ResourceSlot>();
        for (const d of shader.declarations) {
            if (isResourceSlot(d)) declared.add(d);
        }
        for (const ds of declared) {
            if (!provided.has(ds)) {
                throw new Error(
                    `bindings: shader (id='${shader.id}') declares slot '${ds.name}' but the ` +
                        'graph does not provide it for this shader (add the shader to that ' +
                        "SlotNode's usedBy, or remove the slot from the shader)."
                );
            }
        }
    }

    return {
        __graphType: 'binding-graph',
        roots,
    };
}
