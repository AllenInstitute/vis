/**
 * Persistent `Scene` types — Phase 6 of the WebGPU rendering refactor.
 *
 * A `Scene` is a mutable, tree-shaped render-graph whose leaves are `DrawableNode`s wrapping
 * `Drawable` instances built via `ctx.drawable(...)`. Inner nodes are either composite
 * containers (`ContainerNode`) or **scoped state nodes** (`ViewportNode`, `ScissorNode`,
 * `StencilRefNode`, `BlendConstantNode`) whose effect is restored on subtree exit by the
 * encoder. `BindingOverrideNode` replaces specific `ResourceSlot` bindings for its subtree.
 *
 * **No `PipelineRefNode`**: each Drawable owns its pipeline assignment (singular). Multi-
 * pipeline rendering is expressed by constructing multiple Drawables sharing geometry via
 * `Resource.share()` (or `drawable.reuse(...)`).
 *
 * Every node descriptor is a POJO — no closures, no GPU references. The scene itself is
 * `structuredClone`-safe **only** when all nodes are non-`draw` (DrawableNode carries a live
 * Drawable object; in a worker scenario the worker that owns the encoder maintains an
 * `id → drawable` dictionary and reconstructs DrawableNodes locally from the message-passing
 * shape).
 */

import type { Resource } from '../data/resource';
import type { Drawable } from '../drawable';
import type { ResourceSlot } from '../resources/resource';

/** Stable per-instance identifier (UUID-ish). Used by `Scene.add` / `remove` / `replace`. */
export type NodeId = string;

/** WebGPU render-target descriptor consumed by `ctx.submit(scene)` to open a render pass. */
export interface RenderTarget {
    readonly color: readonly GPURenderPassColorAttachment[];
    readonly depthStencil?: GPURenderPassDepthStencilAttachment;
    /** Optional debug label propagated to the begin-pass descriptor. */
    readonly label?: string;
}

// ---- Scene node variants ----------------------------------------------------------------------

/** Brand symbol — used by `isSceneNode` to identify any scene node at runtime. */
export const SCENE_NODE_BRAND: unique symbol = Symbol.for('vis-core.webgpu.SceneNode');

interface SceneNodeBase {
    readonly __brand: typeof SCENE_NODE_BRAND;
    readonly id: NodeId;
    readonly label?: string;
}

/** Pass-through composite — has no encoder effect of its own. Used for grouping. */
export interface ContainerNode extends SceneNodeBase {
    readonly kind: 'container';
    readonly children: readonly SceneNode[];
}

/** Scoped viewport. Encoder calls `setViewport(x, y, width, height, minDepth, maxDepth)` on
 *  subtree entry; restores prior viewport on exit if it differed. */
export interface ViewportNode extends SceneNodeBase {
    readonly kind: 'viewport';
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly minDepth: number;
    readonly maxDepth: number;
    readonly children: readonly SceneNode[];
}

/** Scoped scissor rectangle. Encoder calls `setScissorRect` on entry, restores on exit. */
export interface ScissorNode extends SceneNodeBase {
    readonly kind: 'scissor';
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly children: readonly SceneNode[];
}

/** Scoped stencil reference value. */
export interface StencilRefNode extends SceneNodeBase {
    readonly kind: 'stencilref';
    readonly value: number;
    readonly children: readonly SceneNode[];
}

/** Scoped blend constant color (RGBA). */
export interface BlendConstantNode extends SceneNodeBase {
    readonly kind: 'blendconstant';
    readonly color: GPUColorDict | readonly [number, number, number, number];
    readonly children: readonly SceneNode[];
}

/** Scoped binding override. The encoder snapshots the affected bind groups on entry and
 *  restores them on exit. Slot-by-slot: a `ResourceSlot` not present in `overrides` falls
 *  through to whatever the descendant `Drawable` declares. */
export interface BindingOverrideNode extends SceneNodeBase {
    readonly kind: 'override';
    readonly overrides: ReadonlyMap<ResourceSlot, Resource>;
    readonly children: readonly SceneNode[];
}

/** Leaf node wrapping a `Drawable`. */
export interface DrawableNode extends SceneNodeBase {
    readonly kind: 'draw';
    readonly drawable: Drawable;
}

/** Discriminated union of every `Scene` node variant. */
export type SceneNode =
    | ContainerNode
    | ViewportNode
    | ScissorNode
    | StencilRefNode
    | BlendConstantNode
    | BindingOverrideNode
    | DrawableNode;

/** Subset of nodes that carry children. Helpful for traversal narrowing. */
export type CompositeSceneNode = Exclude<SceneNode, DrawableNode>;

/** Runtime brand check. */
export function isSceneNode(value: unknown): value is SceneNode {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __brand?: unknown }).__brand === SCENE_NODE_BRAND
    );
}

// ---- Events ------------------------------------------------------------------------------------

/** Event payload fired after every mutating call on `Scene`. */
export interface StructureChangedEvent {
    readonly type: 'structure-changed';
    readonly action: 'add' | 'remove' | 'replace';
    /** Id of the node that was added / removed / replaced. */
    readonly nodeId: NodeId;
    /** For `add`: the parent the new node was attached to. For `replace`: the parent of the
     *  replaced node. Omitted for `remove` of the root (which is disallowed anyway). */
    readonly parentId?: NodeId;
    /**
     * For `remove` (and for `replace` when the old node was a composite whose descendants
     * were not re-attached to the new node): the ids of every node that was detached from
     * the scene, EXCLUDING `nodeId` itself. Consumers that maintain per-node state (e.g. the
     * encoder's subtree-command cache) use this to evict entries for the entire removed
     * subtree in one pass. For `add`, this field is omitted.
     */
    readonly removedNodeIds?: readonly NodeId[];
}

export type SceneEvent = StructureChangedEvent;
export type SceneEventListener = (ev: SceneEvent) => void;

// ---- Scene -------------------------------------------------------------------------------------

/** Brand symbol used by `isScene` to discriminate `Scene` objects at runtime. */
export const SCENE_BRAND: unique symbol = Symbol.for('vis-core.webgpu.Scene');

/**
 * The persistent render graph. Constructed via `scene(descriptor)`; mutated via
 * `add`/`remove`/`replace`. `dirty` is the set of nodes whose cached encoded command
 * sequences must be re-recorded next frame; the encoder consults and clears it during
 * `plan`.
 */
export interface Scene {
    readonly __brand: typeof SCENE_BRAND;
    readonly id: string;
    readonly target: RenderTarget;
    /** Current scene root. Replaced wholesale by `replace(root.id, newRoot)`. */
    readonly root: SceneNode;
    /** `parents.get(childId) === parentId` for every non-root node. The root is absent. */
    readonly parents: ReadonlyMap<NodeId, NodeId>;
    /** Nodes whose cached commands need to be re-encoded. Encoder reads + clears during plan. */
    readonly dirty: ReadonlySet<NodeId>;

    /** Locate a node by id. Returns `undefined` if no such node exists. */
    getNode(id: NodeId): SceneNode | undefined;
    /** Attach `node` as the last child of `parentId`. Throws on missing parent or non-composite parent. */
    add(parentId: NodeId, node: SceneNode): NodeId;
    /** Detach `id` (and its entire subtree) from the scene. Throws when called on the root. */
    remove(id: NodeId): void;
    /** Substitute the node at `id` with `node`. The new node retains `id` (i.e. `node` is rebranded
     *  to carry the existing id) so external references to `id` remain valid. */
    replace(id: NodeId, node: SceneNode): void;
    /** Mark `id` and every ancestor as dirty. */
    markDirty(id: NodeId): void;
    /** Mark `id` plus every descendant **and** every ancestor as dirty. */
    markSubtreeDirty(id: NodeId): void;
    /** Internal helper — clear the dirty set. Called by the encoder at the end of `plan`. */
    clearDirty(): void;

    /** Subscribe to scene events. Returns an unsubscribe function. */
    on(type: SceneEvent['type'], listener: SceneEventListener): () => void;
    /** Remove a previously-registered listener. */
    off(type: SceneEvent['type'], listener: SceneEventListener): void;
}

/** Runtime discriminator for `Scene`. */
export function isScene(value: unknown): value is Scene {
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __brand?: unknown }).__brand === SCENE_BRAND
    );
}

// ---- Constructor descriptor --------------------------------------------------------------------

/** Top-level descriptor passed to `scene({...})`. */
export interface SceneDescriptor {
    readonly target: RenderTarget;
    readonly root: SceneNode;
    readonly label?: string;
}
