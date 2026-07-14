import { describe, expect, it } from 'vitest';
import { samplerSlot, textureSlot, uniformSlot } from '../../resources';
import { shader } from '../../shaders';
import { bindings, group, isBindingGraph, isBindingGroup } from './binding-graph';
import { resolveShaderBindings, shaderSlotEntries } from './traverse';

describe('group()', () => {
    it('creates a node with slot children (no spec)', () => {
        const u = uniformSlot('u', 'U');
        const g = group(u);
        expect(isBindingGroup(g)).toBe(true);
        expect(g.slots).toEqual([u]);
        expect(g.subgroups).toEqual([]);
        expect(g.label).toBeUndefined();
        expect(g.maxDepth).toBe(4);
    });

    it('accepts an optional spec object as the first argument', () => {
        const u = uniformSlot('u', 'U');
        const g = group({ label: 'frame' }, u);
        expect(g.label).toBe('frame');
        expect(g.slots).toEqual([u]);
    });

    it('accepts a custom maxDepth via spec', () => {
        const g = group({ maxDepth: 2 });
        expect(g.maxDepth).toBe(2);
    });

    it('buckets slot vs subgroup children preserving relative source order', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const sub = group({ label: 'sub' });
        const g = group({ label: 'root' }, a, sub, b);
        expect(g.slots).toEqual([a, b]);
        expect(g.subgroups).toEqual([sub]);
    });

    it('throws when a child is neither a ResourceSlot nor a BindingGroup', () => {
        expect(() =>
            // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid input
            group({ label: 'g' }, { not: 'a slot' } as any)
        ).toThrow(/neither a ResourceSlot nor a BindingGroup/);
    });

    it('does NOT validate within-tree slot uniqueness at construction time', () => {
        // Within-tree uniqueness is enforced by `bindings()`, not by `group()`.
        const u = uniformSlot('u', 'U');
        const a = group(u);
        const b = group(u);
        // Both nodes accept `u`; the error is raised only when `bindings()` walks a tree that
        // would contain both copies (see the 'bindings()' suite below).
        expect(a.slots).toEqual([u]);
        expect(b.slots).toEqual([u]);
    });

    it('produces frozen BindingGroup nodes', () => {
        const g = group(uniformSlot('u', 'U'));
        expect(Object.isFrozen(g)).toBe(true);
    });
});

describe('bindings()', () => {
    it('derives a graph from a single-group tree and one shader', () => {
        const u = uniformSlot('u', 'U');
        const t = textureSlot('tex', 'texture_2d<f32>');
        const root = group({ label: 'frame' }, u, t);
        const sh = shader([u, t]);
        const g = bindings(root, sh);
        expect(isBindingGraph(g)).toBe(true);
        expect(g.root).toBe(root);
        expect(g.shaders).toEqual([sh]);
        expect(g.groups).toEqual([root]);
        expect(g._groupDepth.get(root)).toBe(0);
    });

    it('accepts one or many shaders positionally', () => {
        const u = uniformSlot('u', 'U');
        const root = group(u);
        const shA = shader([u]);
        const shB = shader([u]);
        const single = bindings(root, shA);
        const multi = bindings(root, shA, shB);
        expect(single.shaders).toEqual([shA]);
        expect(multi.shaders).toEqual([shA, shB]);
    });

    it('throws when no shaders are supplied', () => {
        const root = group(uniformSlot('u', 'U'));
        expect(() => bindings(root)).toThrow(/at least one shader/);
    });

    it('throws when the root is not a BindingGroup', () => {
        const sh = shader([]);
        // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid input
        expect(() => bindings({} as any, sh)).toThrow(/must be a BindingGroup/);
    });

    it("throws when a shader declares a slot that is not present in the supplied tree", () => {
        const present = uniformSlot('here', 'H');
        const absent = uniformSlot('missing', 'M');
        const root = group(present);
        const sh = shader([absent]);
        expect(() => bindings(root, sh)).toThrow(/'missing' but it is not present/);
    });

    it("ignores non-ResourceSlot declarations in the shader's declarations array", () => {
        const u = uniformSlot('u', 'U');
        const root = group(u);
        const extra = { __gen: () => '// noop' };
        const sh = shader([u, extra]);
        expect(() => bindings(root, sh)).not.toThrow();
    });

    it('walks subgroups top-down assigning depth = parent depth + 1', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        const grand = group({ label: 'grand' }, c);
        const child = group({ label: 'child' }, b, grand);
        const root = group({ label: 'root' }, a, child);
        const sh = shader([a, b, c]);
        const g = bindings(root, sh);
        expect(g._groupDepth.get(root)).toBe(0);
        expect(g._groupDepth.get(child)).toBe(1);
        expect(g._groupDepth.get(grand)).toBe(2);
        // groups sorted shallowest first
        expect(g.groups[0]).toBe(root);
        expect(g.groups[1]).toBe(child);
        expect(g.groups[2]).toBe(grand);
    });

    it('throws when within-tree slot uniqueness is violated via sibling placement', () => {
        const u = uniformSlot('u', 'U');
        // The same slot appears twice as a sibling.
        const root = group(u, u);
        const sh = shader([u]);
        expect(() => bindings(root, sh)).toThrow(/'u' appears more than once/);
    });

    it('throws when within-tree slot uniqueness is violated via subgroup nesting', () => {
        const u = uniformSlot('u', 'U');
        const sub = group(u);
        const root = group(u, sub);
        const sh = shader([u]);
        expect(() => bindings(root, sh)).toThrow(/'u' appears more than once/);
    });

    it('throws when depth meets or exceeds maxDepth', () => {
        // Default maxDepth is 4 → legal depths are 0..3. Build 5 levels deep.
        const lvl4 = group(uniformSlot('s4', 'S'));
        const lvl3 = group(uniformSlot('s3', 'S'), lvl4);
        const lvl2 = group(uniformSlot('s2', 'S'), lvl3);
        const lvl1 = group(uniformSlot('s1', 'S'), lvl2);
        const root = group(uniformSlot('s0', 'S'), lvl1);
        const sh = shader([]);
        expect(() => bindings(root, sh)).toThrow(/meets or exceeds its maxDepth of 4/);
    });

    it('honours a custom maxDepth on a subgroup node', () => {
        const deep = group({ maxDepth: 2 }, uniformSlot('d', 'D'));
        // deep gets depth=1 under root; its own maxDepth of 2 still permits it.
        const root = group(uniformSlot('r', 'R'), deep);
        const sh = shader([]);
        expect(() => bindings(root, sh)).not.toThrow();
        // But pushing it deeper would fail.
        const root2 = group({ maxDepth: 2 }, group(uniformSlot('x', 'X'), deep));
        expect(() => bindings(root2, shader([]))).toThrow(/meets or exceeds/);
    });

    it('throws when a BindingGroup instance is referenced more than once in the same tree', () => {
        const shared = group(uniformSlot('s', 'S'));
        const root = group(shared, shared);
        const sh = shader([]);
        expect(() => bindings(root, sh)).toThrow(/appears more than once in the tree/);
    });

    it('allows the same slot identity to live in two unrelated graph trees', () => {
        const slot = uniformSlot('shared', 'S');
        const root1 = group(uniformSlot('pad', 'P'), slot); // slot becomes binding 1 here
        const root2 = group(slot); // slot becomes binding 0 here
        const sh = shader([slot]);
        const g1 = bindings(root1, sh);
        const g2 = bindings(root2, sh);
        expect(g1._slotIndex.get(slot)?.binding).toBe(1);
        expect(g2._slotIndex.get(slot)?.binding).toBe(0);
    });

    it('produces a frozen BindingGraph', () => {
        const u = uniformSlot('u', 'U');
        const root = group(u);
        const g = bindings(root, shader([u]));
        expect(Object.isFrozen(g)).toBe(true);
    });
});

describe('resolveShaderBindings()', () => {
    it('returns binding indices in slot-order within a group', () => {
        const u = uniformSlot('u', 'U');
        const t = textureSlot('tex', 'texture_2d<f32>');
        const s = samplerSlot('samp', 'sampler');
        const root = group(u, t, s);
        const sh = shader([u, t, s]);
        const g = bindings(root, sh);
        const map = resolveShaderBindings(g, sh);
        expect(map.get(u)).toEqual({ group: 0, binding: 0 });
        expect(map.get(t)).toEqual({ group: 0, binding: 1 });
        expect(map.get(s)).toEqual({ group: 0, binding: 2 });
    });

    it('uses graph-local depth as the @group(N) index for nested groups', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        const g2 = group(c);
        const g1 = group(b, g2);
        const root = group(a, g1);
        const sh = shader([a, b, c]);
        const graph = bindings(root, sh);
        const map = resolveShaderBindings(graph, sh);
        expect(map.get(a)).toEqual({ group: 0, binding: 0 });
        expect(map.get(b)).toEqual({ group: 1, binding: 0 });
        expect(map.get(c)).toEqual({ group: 2, binding: 0 });
    });

    it('resolves a shared slot to identical (group, binding) across multiple shaders in one graph', () => {
        const camera = uniformSlot('camera', 'Camera');
        const root = group(camera);
        const shA = shader([camera]);
        const shB = shader([camera]);
        const g = bindings(root, shA, shB);
        const a = resolveShaderBindings(g, shA);
        const b = resolveShaderBindings(g, shB);
        expect(a.get(camera)).toEqual({ group: 0, binding: 0 });
        expect(b.get(camera)).toEqual({ group: 0, binding: 0 });
    });

    it('returns sparse binding indices when a shader uses a subset of a group', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        const root = group(a, b, c);
        const sh = shader([a, c]);
        const g = bindings(root, sh);
        const map = resolveShaderBindings(g, sh);
        expect(map.get(a)).toEqual({ group: 0, binding: 0 });
        expect(map.get(c)).toEqual({ group: 0, binding: 2 });
        expect(map.has(b)).toBe(false);
    });
});

describe('shaderSlotEntries()', () => {
    it('returns entries sorted by (group, binding)', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        const child = group(c);
        const root = group(a, b, child);
        const sh = shader([a, b, c]);
        const g = bindings(root, sh);
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
        const root = group(a, b);
        const shA = shader([a]);
        const shB = shader([b]);
        const g = bindings(root, shA, shB);
        expect(shaderSlotEntries(g, shA).map((e) => e.slot.name)).toEqual(['a']);
        expect(shaderSlotEntries(g, shB).map((e) => e.slot.name)).toEqual(['b']);
    });

    it('includes the owning BindingGroup in each entry', () => {
        const u = uniformSlot('u', 'U');
        const owner = group({ label: 'frame' }, u);
        const sh = shader([u]);
        const g = bindings(owner, sh);
        const [entry] = shaderSlotEntries(g, sh);
        expect(entry?.owner).toBe(owner);
    });
});
