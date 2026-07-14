import { describe, expect, it, vi } from 'vitest';
import type { Drawable } from '../drawable';
import { DRAWABLE_BRAND } from '../drawable';
import type { RenderTarget } from './types';
import {
    blendconstant,
    container,
    draw,
    override,
    scene,
    scissor,
    stencilref,
    viewport,
} from './scene';

// ---- shared fixtures --------------------------------------------------------------------------

const TARGET: RenderTarget = {
    color: [
        {
            view: {} as unknown as GPUTextureView,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
    ],
};

let drawableCounter = 0;
function fakeDrawable(label?: string): Drawable & { readonly destroyCount: () => number } {
    drawableCounter += 1;
    let destroyCalls = 0;
    const d = {
        __brand: DRAWABLE_BRAND,
        id: `drawable-${drawableCounter}`,
        ...(label !== undefined && { label }),
        pipeline: {} as Drawable['pipeline'],
        vertexBuffers: new Map(),
        bindings: new Map(),
        draw: { kind: 'array' as const, vertexCount: 3 },
        destroy: () => {
            destroyCalls += 1;
        },
        reuse: (() => {
            throw new Error('fakeDrawable.reuse: not supported in scene tests');
        }) as Drawable['reuse'],
        destroyCount: () => destroyCalls,
    };
    return Object.freeze(d) as unknown as Drawable & { readonly destroyCount: () => number };
}

// ---- construction -----------------------------------------------------------------------------

describe('scene() construction', () => {
    it('indexes every descendant into the parents map', () => {
        const d1 = draw(fakeDrawable('d1'));
        const d2 = draw(fakeDrawable('d2'));
        const inner = container([d1, d2]);
        const root = container([inner]);
        const s = scene({ target: TARGET, root });
        expect(s.root).toBe(root);
        expect(s.parents.get(inner.id)).toBe(root.id);
        expect(s.parents.get(d1.id)).toBe(inner.id);
        expect(s.parents.get(d2.id)).toBe(inner.id);
        expect(s.parents.has(root.id)).toBe(false);
        expect(s.getNode(d1.id)).toBe(d1);
        expect(s.getNode(root.id)).toBe(root);
    });
});

// ---- add / remove / replace ------------------------------------------------------------------

describe('Scene.add / remove / replace', () => {
    it('add(parent, node) attaches and dirties the affected ancestors', () => {
        const root = container([]);
        const s = scene({ target: TARGET, root });
        const d = draw(fakeDrawable('d'));
        s.add(root.id, d);

        const newRoot = s.root;
        expect(newRoot.id).toBe(root.id); // root.id stable
        expect(newRoot.kind).toBe('container');
        if (newRoot.kind === 'container') {
            expect(newRoot.children).toHaveLength(1);
            expect(newRoot.children[0]?.id).toBe(d.id);
        }
        expect(s.parents.get(d.id)).toBe(root.id);
        expect(s.dirty.has(d.id)).toBe(true);
        expect(s.dirty.has(root.id)).toBe(true);
    });

    it('remove() detaches the subtree and clears it from the index', () => {
        const d = draw(fakeDrawable());
        const inner = container([d]);
        const root = container([inner]);
        const s = scene({ target: TARGET, root });
        s.clearDirty();
        s.remove(inner.id);

        expect(s.getNode(inner.id)).toBeUndefined();
        expect(s.getNode(d.id)).toBeUndefined();
        expect(s.parents.has(d.id)).toBe(false);
        // The root is dirtied because its children array changed.
        expect(s.dirty.has(root.id)).toBe(true);
    });

    it('remove() throws when called on the root', () => {
        const root = container([]);
        const s = scene({ target: TARGET, root });
        expect(() => s.remove(root.id)).toThrow(/cannot remove the root/);
    });

    it('replace() keeps the node id stable and dirties ancestors', () => {
        const root = container([viewport({ x: 0, y: 0, width: 10, height: 10 }, [])]);
        const s = scene({ target: TARGET, root });
        const original = s.root.kind === 'container' ? s.root.children[0]! : null;
        expect(original?.kind).toBe('viewport');
        s.clearDirty();

        // Replace with a different viewport spec; keep the same id (replace API).
        const replacement = viewport({ x: 5, y: 5, width: 20, height: 20 }, []);
        s.replace(original!.id, replacement);

        const newNode = s.getNode(original!.id);
        expect(newNode?.kind).toBe('viewport');
        if (newNode?.kind === 'viewport') {
            expect(newNode.x).toBe(5);
            expect(newNode.width).toBe(20);
        }
        expect(s.dirty.has(original!.id)).toBe(true);
        expect(s.dirty.has(root.id)).toBe(true);
    });
});

// ---- dirty propagation ------------------------------------------------------------------------

describe('Scene.markDirty / markSubtreeDirty', () => {
    it('markDirty(id) marks the node and every ancestor', () => {
        const leaf = draw(fakeDrawable());
        const mid = container([leaf]);
        const root = container([mid]);
        const s = scene({ target: TARGET, root });
        s.clearDirty();

        s.markDirty(leaf.id);
        expect(s.dirty.has(leaf.id)).toBe(true);
        expect(s.dirty.has(mid.id)).toBe(true);
        expect(s.dirty.has(root.id)).toBe(true);
    });

    it('markSubtreeDirty(root) invalidates every node in the scene', () => {
        const leaves = [draw(fakeDrawable()), draw(fakeDrawable()), draw(fakeDrawable())];
        const mid = container(leaves);
        const root = container([mid]);
        const s = scene({ target: TARGET, root });
        s.clearDirty();

        s.markSubtreeDirty(root.id);
        expect(s.dirty.has(root.id)).toBe(true);
        expect(s.dirty.has(mid.id)).toBe(true);
        for (const l of leaves) expect(s.dirty.has(l.id)).toBe(true);
    });

    it('markDirty throws on an unknown id', () => {
        const s = scene({ target: TARGET, root: container([]) });
        expect(() => s.markDirty('does-not-exist')).toThrow(/not found/);
    });
});

// ---- events -----------------------------------------------------------------------------------

describe('Scene events', () => {
    it("fires 'structure-changed' once per add/remove/replace", () => {
        const root = container([]);
        const s = scene({ target: TARGET, root });
        const listener = vi.fn();
        s.on('structure-changed', listener);

        const d = draw(fakeDrawable());
        s.add(root.id, d);
        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0]?.[0]).toMatchObject({
            type: 'structure-changed',
            action: 'add',
            nodeId: d.id,
            parentId: root.id,
        });

        s.remove(d.id);
        expect(listener).toHaveBeenCalledTimes(2);
        expect(listener.mock.calls[1]?.[0]).toMatchObject({
            type: 'structure-changed',
            action: 'remove',
            nodeId: d.id,
        });
    });

    it('off() / unsubscribe stops further notifications', () => {
        const s = scene({ target: TARGET, root: container([]) });
        const listener = vi.fn();
        const off = s.on('structure-changed', listener);
        off();
        s.add(s.root.id, draw(fakeDrawable()));
        expect(listener).not.toHaveBeenCalled();
    });
});

// ---- factory smoke tests ----------------------------------------------------------------------

describe('node factories', () => {
    it('viewport defaults minDepth/maxDepth to 0/1', () => {
        const v = viewport({ x: 0, y: 0, width: 100, height: 100 }, []);
        expect(v.minDepth).toBe(0);
        expect(v.maxDepth).toBe(1);
        expect(v.kind).toBe('viewport');
    });

    it('scissor / stencilref / blendconstant return correctly-kinded nodes', () => {
        const sc = scissor({ x: 0, y: 0, width: 100, height: 100 }, []);
        expect(sc.kind).toBe('scissor');
        const sr = stencilref(42, []);
        expect(sr.kind).toBe('stencilref');
        expect(sr.value).toBe(42);
        const bc = blendconstant([0.1, 0.2, 0.3, 0.4], []);
        expect(bc.kind).toBe('blendconstant');
    });

    it("override only accepts Map<ResourceSlot, Resource> (not a record)", () => {
        expect(() =>
            override(
                {} as unknown as ReadonlyMap<never, never>,
                []
            )
        ).toThrow(/Map<ResourceSlot, Resource>/);
    });
});

// ---- Drawable ownership -------------------------------------------------------------------------

describe('Scene ownership contract', () => {
    it('Scene.remove destroys every Drawable in the removed subtree', () => {
        const a = fakeDrawable('a');
        const b = fakeDrawable('b');
        const c = fakeDrawable('c');
        const root = container([
            draw(a),
            container([draw(b), draw(c)]),
        ]);
        const s = scene({ target: TARGET, root });
        // Look up the inner container's id (the second child of root).
        const inner = s.root.kind === 'container' ? s.root.children[1] : undefined;
        if (inner === undefined) throw new Error('inner container missing');

        s.remove(inner.id);

        const destroys = (a as unknown as { destroyCount: () => number }).destroyCount;
        expect(destroys()).toBe(0); // 'a' was outside the removed subtree
        expect((b as unknown as { destroyCount: () => number }).destroyCount()).toBe(1);
        expect((c as unknown as { destroyCount: () => number }).destroyCount()).toBe(1);
    });

    it('Scene.replace destroys the previous drawable when the new one is different', () => {
        const a = fakeDrawable('a');
        const b = fakeDrawable('b');
        const root = container([draw(a)]);
        const s = scene({ target: TARGET, root });
        const aNode = s.root.kind === 'container' ? s.root.children[0] : undefined;
        if (aNode === undefined) throw new Error('a node missing');

        s.replace(aNode.id, draw(b));
        expect((a as unknown as { destroyCount: () => number }).destroyCount()).toBe(1);
        expect((b as unknown as { destroyCount: () => number }).destroyCount()).toBe(0);
    });

    it('Scene.replace does NOT destroy when the same drawable is re-wrapped', () => {
        const a = fakeDrawable('a');
        const root = container([draw(a)]);
        const s = scene({ target: TARGET, root });
        const aNode = s.root.kind === 'container' ? s.root.children[0] : undefined;
        if (aNode === undefined) throw new Error('a node missing');

        s.replace(aNode.id, draw(a, 'relabel'));
        expect((a as unknown as { destroyCount: () => number }).destroyCount()).toBe(0);
    });
});
