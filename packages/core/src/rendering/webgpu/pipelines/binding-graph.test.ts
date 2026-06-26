import { describe, expect, it } from 'vitest';
import { samplerSlot, textureSlot, uniformSlot } from '../resources';
import { shader } from '../shaders';
import { bindings, group, isBindingGraph, isBindingGroup } from './binding-graph';
import { resolveShaderBindings, shaderSlotEntries } from './traverse';

describe('group()', () => {
    it('creates a root group at depth 0', () => {
        const u = uniformSlot('u', 'U');
        const g = group({ label: 'frame', slots: [u] });
        expect(isBindingGroup(g)).toBe(true);
        expect(g.depth).toBe(0);
        expect(g.parent).toBeUndefined();
        expect(g.slots).toEqual([u]);
        expect(g.label).toBe('frame');
    });

    it('derives nested depth from parent', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        const root = group({ label: 'root', slots: [a] });
        const child = group({ label: 'child', parent: root, slots: [b] });
        const grand = group({ label: 'grand', parent: child, slots: [c] });
        expect(root.depth).toBe(0);
        expect(child.depth).toBe(1);
        expect(grand.depth).toBe(2);
    });

    it('throws when a slot is already in another group', () => {
        const u = uniformSlot('u', 'U');
        group({ label: 'first', slots: [u] });
        expect(() => group({ label: 'second', slots: [u] })).toThrow(/already assigned to group 'first'/);
    });

    it('throws when an entry is not a ResourceSlot', () => {
        expect(() =>
            // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid input
            group({ label: 'g', slots: [{} as any] })
        ).toThrow(/not a ResourceSlot/);
    });

    it('throws when depth reaches the default limit (4)', () => {
        const s0 = uniformSlot('s0', 'S');
        const s1 = uniformSlot('s1', 'S');
        const s2 = uniformSlot('s2', 'S');
        const s3 = uniformSlot('s3', 'S');
        const g0 = group({ slots: [s0] }); // depth 0
        const g1 = group({ parent: g0, slots: [s1] }); // depth 1
        const g2 = group({ parent: g1, slots: [s2] }); // depth 2
        const g3 = group({ parent: g2, slots: [s3] }); // depth 3 — OK
        expect(g3.depth).toBe(3);
        const s4 = uniformSlot('s4', 'S');
        expect(() => group({ parent: g3, slots: [s4] })).toThrow(/reaches or exceeds the limit of 4/);
    });

    it('honours a custom maxDepth', () => {
        const s0 = uniformSlot('s0', 'S');
        const s1 = uniformSlot('s1', 'S');
        const g0 = group({ slots: [s0], maxDepth: 2 });
        const g1 = group({ parent: g0, slots: [s1], maxDepth: 2 });
        expect(g1.depth).toBe(1);
        const s2 = uniformSlot('s2', 'S');
        expect(() => group({ parent: g1, slots: [s2], maxDepth: 2 })).toThrow(
            /reaches or exceeds the limit of 2/
        );
    });

    it('does not pollute the slot→group registry on validation failure', () => {
        const ok = uniformSlot('ok', 'OK');
        const u = uniformSlot('u', 'U');
        group({ slots: [u] });
        // First call fails because `u` is already taken; `ok` must remain unassigned.
        expect(() => group({ slots: [ok, u] })).toThrow(/already assigned/);
        // Re-using `ok` in a fresh group should still succeed.
        expect(() => group({ slots: [ok] })).not.toThrow();
    });
});

describe('bindings()', () => {
    it('derives a graph from a single shader', () => {
        const u = uniformSlot('u', 'U');
        const t = textureSlot('tex', 'texture_2d<f32>');
        group({ slots: [u, t] });
        const sh = shader([u, t]);
        const g = bindings(sh);
        expect(isBindingGraph(g)).toBe(true);
        expect(g.shaders).toEqual([sh]);
        expect(g.groups).toHaveLength(1);
    });

    it('accepts a single shader or an array equivalently', () => {
        const u = uniformSlot('u', 'U');
        group({ slots: [u] });
        const sh = shader([u]);
        const single = bindings(sh);
        const array = bindings([sh]);
        expect(single.shaders).toEqual(array.shaders);
        expect(single.groups).toEqual(array.groups);
    });

    it('throws on empty shader array', () => {
        expect(() => bindings([])).toThrow(/at least one shader/);
    });

    it('throws when a declared slot is not assigned to any group', () => {
        const u = uniformSlot('u', 'U');
        // intentionally never put in a group
        const sh = shader([u]);
        expect(() => bindings(sh)).toThrow(/'u' but it is not assigned to any group/);
    });

    it("ignores non-ResourceSlot declarations in the shader's declarations array", () => {
        const u = uniformSlot('u', 'U');
        group({ slots: [u] });
        // declarations may include arbitrary DeclarationGenerator objects; only ResourceSlots
        // are routed through the binding graph
        const extra = { __gen: () => '// noop' };
        const sh = shader([u, extra]);
        expect(() => bindings(sh)).not.toThrow();
    });

    it('includes parent groups transitively in the reached set', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const root = group({ label: 'root', slots: [a] });
        const child = group({ label: 'child', parent: root, slots: [b] });
        const sh = shader([b]); // declares only the deeper slot
        const g = bindings(sh);
        // both root and child must appear so the graph is closed under containment
        expect(g.groups).toContain(child);
        expect(g.groups).toContain(root);
        // sorted shallowest-first
        expect(g.groups[0]).toBe(root);
        expect(g.groups[1]).toBe(child);
    });

    it('merges reached groups across multiple shaders without duplication', () => {
        const camera = uniformSlot('camera', 'Camera');
        const albedo = textureSlot('albedo', 'texture_2d<f32>');
        const frame = group({ label: 'frame', slots: [camera] });
        const material = group({ label: 'material', parent: frame, slots: [albedo] });
        const shA = shader([camera, albedo]);
        const shB = shader([camera]);
        const g = bindings([shA, shB]);
        expect(g.shaders).toEqual([shA, shB]);
        expect(new Set(g.groups)).toEqual(new Set([frame, material]));
    });
});

describe('resolveShaderBindings()', () => {
    it('returns binding indices in slot-order within a group', () => {
        const u = uniformSlot('u', 'U');
        const t = textureSlot('tex', 'texture_2d<f32>');
        const s = samplerSlot('samp', 'sampler');
        group({ slots: [u, t, s] });
        const sh = shader([u, t, s]);
        const g = bindings(sh);
        const map = resolveShaderBindings(g, sh);
        expect(map.get(u)).toEqual({ group: 0, binding: 0 });
        expect(map.get(t)).toEqual({ group: 0, binding: 1 });
        expect(map.get(s)).toEqual({ group: 0, binding: 2 });
    });

    it('uses group depth as the @group(N) index for nested groups', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        const g0 = group({ slots: [a] });
        const g1 = group({ parent: g0, slots: [b] });
        group({ parent: g1, slots: [c] });
        const sh = shader([a, b, c]);
        const graph = bindings(sh);
        const map = resolveShaderBindings(graph, sh);
        expect(map.get(a)).toEqual({ group: 0, binding: 0 });
        expect(map.get(b)).toEqual({ group: 1, binding: 0 });
        expect(map.get(c)).toEqual({ group: 2, binding: 0 });
    });

    it('resolves a shared slot to identical (group, binding) across multiple shaders', () => {
        const camera = uniformSlot('camera', 'Camera');
        group({ slots: [camera] });
        const shA = shader([camera]);
        const shB = shader([camera]);
        const g = bindings([shA, shB]);
        const a = resolveShaderBindings(g, shA);
        const b = resolveShaderBindings(g, shB);
        expect(a.get(camera)).toEqual({ group: 0, binding: 0 });
        expect(b.get(camera)).toEqual({ group: 0, binding: 0 });
    });

    it('returns sparse binding indices when a shader uses a subset of a group', () => {
        // group has 3 slots; shader only declares the first and third
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        group({ slots: [a, b, c] });
        const sh = shader([a, c]);
        const g = bindings(sh);
        const map = resolveShaderBindings(g, sh);
        expect(map.get(a)).toEqual({ group: 0, binding: 0 });
        expect(map.get(c)).toEqual({ group: 0, binding: 2 }); // skips index 1
        expect(map.has(b)).toBe(false);
    });
});

describe('shaderSlotEntries()', () => {
    it('returns entries sorted by (group, binding)', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        const root = group({ slots: [a, b] });
        group({ parent: root, slots: [c] });
        const sh = shader([a, b, c]);
        const g = bindings(sh);
        const entries = shaderSlotEntries(g, sh);
        expect(entries.map((e) => ({ group: e.group, binding: e.binding, name: e.slot.name }))).toEqual([
            { group: 0, binding: 0, name: 'a' },
            { group: 0, binding: 1, name: 'b' },
            { group: 1, binding: 0, name: 'c' },
        ]);
    });

    it('returns only the slots the supplied shader actually declares', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        group({ slots: [a, b] });
        const shA = shader([a]);
        const shB = shader([b]);
        const g = bindings([shA, shB]);
        expect(shaderSlotEntries(g, shA).map((e) => e.slot.name)).toEqual(['a']);
        expect(shaderSlotEntries(g, shB).map((e) => e.slot.name)).toEqual(['b']);
    });

    it("includes the owning BindingGroup in each entry", () => {
        const u = uniformSlot('u', 'U');
        const owner = group({ label: 'frame', slots: [u] });
        const sh = shader([u]);
        const g = bindings(sh);
        const [entry] = shaderSlotEntries(g, sh);
        expect(entry?.owner).toBe(owner);
    });
});
