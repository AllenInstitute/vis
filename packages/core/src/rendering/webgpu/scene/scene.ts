import { v4 as uuidv4 } from 'uuid';
import type { ResourceSlot } from '../binding/slot';
import type { Resource } from '../data/resource';
import { asManagedDrawable, type Drawable } from '../drawable';
import {
    type BindingOverrideNode,
    type BlendConstantNode,
    type ContainerNode,
    type DrawableNode,
    isSceneNode,
    type NodeId,
    SCENE_BRAND,
    SCENE_NODE_BRAND,
    type Scene,
    type SceneDescriptor,
    type SceneEvent,
    type SceneEventListener,
    type SceneNode,
    type ScissorNode,
    type StencilRefNode,
    type ViewportNode,
} from './types';

// ---- Node factories ---------------------------------------------------------------------------

/** Compose a `ContainerNode`. Pass-through grouping. */
export function container(children: readonly SceneNode[], label?: string): ContainerNode {
    return Object.freeze({
        __brand: SCENE_NODE_BRAND,
        id: uuidv4(),
        kind: 'container' as const,
        children: Object.freeze([...children]) as readonly SceneNode[],
        ...(label !== undefined && { label }),
    });
}

/** Spec for `viewport(...)`. Mirrors `GPURenderPassEncoder.setViewport` shape. */
export interface ViewportSpec {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly minDepth?: number;
    readonly maxDepth?: number;
    readonly label?: string;
}

export function viewport(spec: ViewportSpec, children: readonly SceneNode[]): ViewportNode {
    return Object.freeze({
        __brand: SCENE_NODE_BRAND,
        id: uuidv4(),
        kind: 'viewport' as const,
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        minDepth: spec.minDepth ?? 0,
        maxDepth: spec.maxDepth ?? 1,
        children: Object.freeze([...children]) as readonly SceneNode[],
        ...(spec.label !== undefined && { label: spec.label }),
    });
}

/** Spec for `scissor(...)`. Mirrors `setScissorRect`. */
export interface ScissorSpec {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly label?: string;
}

export function scissor(spec: ScissorSpec, children: readonly SceneNode[]): ScissorNode {
    return Object.freeze({
        __brand: SCENE_NODE_BRAND,
        id: uuidv4(),
        kind: 'scissor' as const,
        x: spec.x,
        y: spec.y,
        width: spec.width,
        height: spec.height,
        children: Object.freeze([...children]) as readonly SceneNode[],
        ...(spec.label !== undefined && { label: spec.label }),
    });
}

export function stencilref(
    value: number,
    children: readonly SceneNode[],
    label?: string
): StencilRefNode {
    return Object.freeze({
        __brand: SCENE_NODE_BRAND,
        id: uuidv4(),
        kind: 'stencilref' as const,
        value,
        children: Object.freeze([...children]) as readonly SceneNode[],
        ...(label !== undefined && { label }),
    });
}

export function blendconstant(
    color: GPUColorDict | readonly [number, number, number, number],
    children: readonly SceneNode[],
    label?: string
): BlendConstantNode {
    return Object.freeze({
        __brand: SCENE_NODE_BRAND,
        id: uuidv4(),
        kind: 'blendconstant' as const,
        color,
        children: Object.freeze([...children]) as readonly SceneNode[],
        ...(label !== undefined && { label }),
    });
}

export function override(
    overrides: ReadonlyMap<ResourceSlot, Resource>,
    children: readonly SceneNode[],
    label?: string
): BindingOverrideNode {
    if (!(overrides instanceof Map)) {
        throw new Error(
            'override(...): bindings must be supplied as a Map<ResourceSlot, Resource>. ' +
            'Record<slotName, Resource> is not supported on Scene nodes because the ' +
            'scene has no pipeline context.'
        );
    }
    const map: ReadonlyMap<ResourceSlot, Resource> = new Map(overrides);
    return Object.freeze({
        __brand: SCENE_NODE_BRAND,
        id: uuidv4(),
        kind: 'override' as const,
        overrides: map,
        children: Object.freeze([...children]) as readonly SceneNode[],
        ...(label !== undefined && { label }),
    });
}

/**
 * Wrap a `Drawable` in a `DrawableNode` for inclusion in a scene tree.
 *
 * The scene owns the drawables it contains: removing a `DrawableNode` (or replacing it with a
 * different `Drawable`) releases the detached drawable's GPU resources. A given `Drawable`
 * should therefore belong to at most one scene at a time.
 */
export function draw(drawable: Drawable, label?: string): DrawableNode {
    return Object.freeze({
        __brand: SCENE_NODE_BRAND,
        id: uuidv4(),
        kind: 'draw' as const,
        drawable,
        ...(label !== undefined && { label }),
    });
}

// ---- Scene constructor ------------------------------------------------------------------------

/**
 * Construct a `Scene` from a `SceneDescriptor`. The descriptor's `root` becomes the live root;
 * children are walked once to populate the `parents` map.
 */
export function scene(descriptor: SceneDescriptor): Scene {
    return new SceneImpl(descriptor);
}

/** Internal helpers exposed only for tests / encoder traversal. */
export function childrenOf(node: SceneNode): readonly SceneNode[] {
    if (node.kind === 'draw') return [];
    return node.children;
}

// ---- Scene implementation ---------------------------------------------------------------------

class SceneImpl implements Scene {
    readonly __brand: typeof SCENE_BRAND = SCENE_BRAND;
    readonly id: string;
    private _root: SceneNode;
    private readonly _parents: Map<NodeId, NodeId> = new Map();
    private readonly _nodes: Map<NodeId, SceneNode> = new Map();
    private readonly _dirty: Set<NodeId> = new Set();
    private readonly _listeners: Map<SceneEvent['type'], Set<SceneEventListener>> = new Map();

    constructor(descriptor: SceneDescriptor) {
        this.id = uuidv4();
        this._root = descriptor.root;
        this.indexSubtree(descriptor.root, undefined);
    }

    get root(): SceneNode {
        return this._root;
    }
    get parents(): ReadonlyMap<NodeId, NodeId> {
        return this._parents;
    }
    get dirty(): ReadonlySet<NodeId> {
        return this._dirty;
    }

    getNode(id: NodeId): SceneNode | undefined {
        return this._nodes.get(id);
    }

    add(parentId: NodeId, node: SceneNode): NodeId {
        const parent = this._nodes.get(parentId);
        if (parent === undefined) {
            throw new Error(`Scene.add: parent id '${parentId}' not found.`);
        }
        if (parent.kind === 'draw') {
            throw new Error(`Scene.add: parent '${parentId}' is a draw leaf — cannot accept children.`);
        }
        if (!isSceneNode(node)) {
            throw new Error('Scene.add: node is not a SceneNode (use a factory like `container(...)`).');
        }
        if (this._nodes.has(node.id)) {
            throw new Error(`Scene.add: node id '${node.id}' is already present in the scene.`);
        }
        const newParent = withChildren(parent, [...parent.children, node]);
        this.swapNode(parent, newParent);
        // The new subtree must be indexed before we propagate dirty (so descendants exist).
        this.indexSubtree(node, newParent.id);
        this.markAncestorsDirty(node.id);
        this.emit({ type: 'structure-changed', action: 'add', nodeId: node.id, parentId: newParent.id });
        return node.id;
    }

    remove(id: NodeId): void {
        if (id === this._root.id) {
            throw new Error('Scene.remove: cannot remove the root node.');
        }
        const node = this._nodes.get(id);
        if (node === undefined) {
            throw new Error(`Scene.remove: node id '${id}' not found.`);
        }
        const parentId = this._parents.get(id);
        if (parentId === undefined) {
            throw new Error(`Scene.remove: node '${id}' has no parent (invariant violation).`);
        }
        const parent = this._nodes.get(parentId);
        if (parent === undefined || parent.kind === 'draw') {
            throw new Error(`Scene.remove: parent '${parentId}' is missing or not a composite.`);
        }
        // Collect descendant ids BEFORE unindexing so consumers of `removedNodeIds` can evict
        // per-node state (e.g. the encoder's subtree-command cache) for the whole subtree in
        // one pass. Excludes `id` itself — the event's `nodeId` field already carries that.
        const removedNodeIds: NodeId[] = [];
        this.collectDescendantIds(node, removedNodeIds);
        const newParent = withChildren(
            parent,
            parent.children.filter((c) => c.id !== id)
        );
        // Dirty ancestors first (uses the existing parents map), then unindex.
        this.markAncestorsDirty(parentId);
        this.unindexSubtree(node);
        this.swapNode(parent, newParent);
        this.destroyDrawablesInSubtree(node);
        this.emit({
            type: 'structure-changed',
            action: 'remove',
            nodeId: id,
            parentId,
            ...(removedNodeIds.length > 0 && { removedNodeIds }),
        });
    }

    replace(id: NodeId, node: SceneNode): void {
        const existing = this._nodes.get(id);
        if (existing === undefined) {
            throw new Error(`Scene.replace: node id '${id}' not found.`);
        }
        if (!isSceneNode(node)) {
            throw new Error('Scene.replace: node is not a SceneNode.');
        }
        if (node.kind !== existing.kind) {
            // We allow this (the encoder will re-evaluate) but reject anything that would
            // change the leaf/composite distinction since it'd break parent.children typing.
            const wasComposite = existing.kind !== 'draw';
            const isComposite = node.kind !== 'draw';
            if (wasComposite !== isComposite) {
                throw new Error(
                    `Scene.replace: cannot swap composite '${existing.kind}' with leaf '${node.kind}' (or vice versa).`
                );
            }
        }
        // Rebrand `node` to carry the existing id + the existing children when the new node is
        // a composite missing children (caller convenience: pass new state, keep children).
        const rebranded: SceneNode =
            node.kind === 'draw'
                ? { ...node, id }
                : node.children.length === 0 && existing.kind !== 'draw' && existing.children.length > 0
                  ? { ...node, id, children: existing.children }
                  : { ...node, id };
        // Determine which existing descendants (if any) this replace detaches, so the emitted
        // event carries `removedNodeIds`. Two cases produce removals:
        //   1. existing is a composite AND rebranded is a leaf → every existing descendant is
        //      detached.
        //   2. existing is a composite AND rebranded is a composite with a fresh (non-kept)
        //      children array → every existing descendant is detached (the new descendants are
        //      a fresh subtree).
        // The "kept-children" path (rebranded.children === existing.children) is a no-op here.
        const removedNodeIds: NodeId[] = [];
        if (existing.kind !== 'draw') {
            const keptChildren =
                rebranded.kind !== 'draw' && rebranded.children === existing.children;
            if (!keptChildren) {
                for (const c of existing.children) this.collectDescendantIds(c, removedNodeIds, true);
            }
        }
        // Reindex: drop the old node's children index entries, re-add the new node's.
        if (existing.kind !== 'draw') this.unindexChildrenOnly(existing);
        // If we replaced a DrawableNode with a different Drawable, release the old one. 
        // Same-drawable replacements (e.g. relabel) are a no-op.
        if (
            existing.kind === 'draw' &&
            rebranded.kind === 'draw' &&
            existing.drawable !== rebranded.drawable
        ) {
            asManagedDrawable(existing.drawable).destroy();
        }
        // Update _nodes for the rebranded id (same id, different node object).
        this._nodes.set(id, rebranded);
        // Patch parent's children array so traversal sees the new node.
        const parentId = this._parents.get(id);
        if (parentId !== undefined) {
            const parent = this._nodes.get(parentId);
            if (parent !== undefined && parent.kind !== 'draw') {
                const newParent = withChildren(
                    parent,
                    parent.children.map((c) => (c.id === id ? rebranded : c))
                );
                this.swapNode(parent, newParent);
            }
        } else {
            // Root replacement.
            this._root = rebranded;
        }
        if (rebranded.kind !== 'draw') {
            this.indexChildrenOnly(rebranded);
        }
        this.markAncestorsDirty(id);
        const evParent = parentId;
        this.emit({
            type: 'structure-changed',
            action: 'replace',
            nodeId: id,
            ...(evParent !== undefined && { parentId: evParent }),
            ...(removedNodeIds.length > 0 && { removedNodeIds }),
        });
    }

    markDirty(id: NodeId): void {
        if (!this._nodes.has(id)) {
            throw new Error(`Scene.markDirty: node id '${id}' not found.`);
        }
        this.markAncestorsDirty(id);
    }

    markSubtreeDirty(id: NodeId): void {
        const node = this._nodes.get(id);
        if (node === undefined) {
            throw new Error(`Scene.markSubtreeDirty: node id '${id}' not found.`);
        }
        // Mark every descendant + the node itself + every ancestor.
        const stack: SceneNode[] = [node];
        while (stack.length > 0) {
            const cur = stack.pop()!;
            this._dirty.add(cur.id);
            if (cur.kind !== 'draw') for (const c of cur.children) stack.push(c);
        }
        // Walk up.
        let p = this._parents.get(id);
        while (p !== undefined) {
            this._dirty.add(p);
            p = this._parents.get(p);
        }
    }

    clearDirty(): void {
        this._dirty.clear();
    }

    on(type: SceneEvent['type'], listener: SceneEventListener): () => void {
        let set = this._listeners.get(type);
        if (set === undefined) {
            set = new Set();
            this._listeners.set(type, set);
        }
        set.add(listener);
        return () => this.off(type, listener);
    }

    off(type: SceneEvent['type'], listener: SceneEventListener): void {
        this._listeners.get(type)?.delete(listener);
    }

    // ---- internals ----

    private emit(ev: SceneEvent): void {
        const set = this._listeners.get(ev.type);
        if (set === undefined) return;
        for (const fn of set) fn(ev);
    }

    private markAncestorsDirty(id: NodeId): void {
        this._dirty.add(id);
        let p = this._parents.get(id);
        while (p !== undefined) {
            this._dirty.add(p);
            p = this._parents.get(p);
        }
    }

    private indexSubtree(node: SceneNode, parentId: NodeId | undefined): void {
        this._nodes.set(node.id, node);
        if (parentId !== undefined) this._parents.set(node.id, parentId);
        if (node.kind === 'draw') return;
        for (const child of node.children) {
            this.indexSubtree(child, node.id);
        }
    }

    private unindexSubtree(node: SceneNode): void {
        this._nodes.delete(node.id);
        this._parents.delete(node.id);
        this._dirty.delete(node.id);
        if (node.kind === 'draw') return;
        for (const child of node.children) this.unindexSubtree(child);
    }

    /**
     * Collect the ids of every node in the subtree rooted at `node` into `out`. `includeSelf`
     * controls whether `node.id` itself is included:
     *   - `false` (default) — pushes ids of every descendant of `node` but NOT `node.id`.
     *     Used by `remove`, where the emitted event already carries the detached subtree's
     *     top id in its `nodeId` field.
     *   - `true` — also pushes `node.id`. Used by `replace` when iterating each detached
     *     child of the previous composite: from that call site, the child itself is a
     *     departing node and belongs in the list.
     * The traversal order is unspecified.
     */
    private collectDescendantIds(node: SceneNode, out: NodeId[], includeSelf = false): void {
        if (includeSelf) out.push(node.id);
        if (node.kind === 'draw') return;
        for (const c of node.children) this.collectDescendantIds(c, out, true);
    }

    /**
     * Walk a (just-detached) subtree and release every `Drawable` in it. The scene owns its
     * drawables and frees them when the subtree they live in is removed or replaced. Idempotent:
     * a drawable's teardown is itself idempotent once its refcount hits zero.
     */
    private destroyDrawablesInSubtree(node: SceneNode): void {
        if (node.kind === 'draw') {
            asManagedDrawable(node.drawable).destroy();
            return;
        }
        for (const child of node.children) this.destroyDrawablesInSubtree(child);
    }

    /** Re-index every descendant of `node` (but not `node` itself). */
    private indexChildrenOnly(node: SceneNode): void {
        if (node.kind === 'draw') return;
        for (const c of node.children) this.indexSubtree(c, node.id);
    }
    private unindexChildrenOnly(node: SceneNode): void {
        if (node.kind === 'draw') return;
        for (const c of node.children) this.unindexSubtree(c);
    }

    /**
     * Replace `oldNode` with `newNode` (same id) in the scene tree, propagating the swap up to
     * the root so every ancestor's `children` array is fresh. Re-points the parent map for the
     * direct children of `newNode` (they keep the same parent id; only the parent object
     * identity changed).
     */
    private swapNode(oldNode: SceneNode, newNode: SceneNode): void {
        this._nodes.set(newNode.id, newNode);
        // Children's parent id is unchanged (same node id), but newer node object is now
        // canonical; nothing further to update for them in `_parents`.
        const parentId = this._parents.get(oldNode.id);
        if (parentId === undefined) {
            this._root = newNode;
            return;
        }
        const parent = this._nodes.get(parentId);
        if (parent === undefined || parent.kind === 'draw') return; // invariant violation; ignore
        const replaced = withChildren(
            parent,
            parent.children.map((c) => (c.id === oldNode.id ? newNode : c))
        );
        this.swapNode(parent, replaced);
    }
}

// ---- helpers ----------------------------------------------------------------------------------

/** Produce a fresh frozen composite with the same kind/state but a new `children` array. */
function withChildren(node: SceneNode, children: readonly SceneNode[]): SceneNode {
    if (node.kind === 'draw') {
        throw new Error(`withChildren: cannot give children to a draw leaf '${node.id}'.`);
    }
    return Object.freeze({
        ...node,
        children: Object.freeze([...children]) as readonly SceneNode[],
    }) as SceneNode;
}
