import { describe, expect, it } from 'vitest';
import { samplerSlot, textureSlot, uniformSlot } from '../resources';
import { shader } from '../shaders';
import {
    binding,
    bindings,
    group,
    isBindingGraph,
    isGroupNode,
    isSlotNode,
} from './binding-graph';
import { resolveShaderBindings, shaderSlotEntries } from './traverse';

describe('bindings()', () => {
    it('constructs a single-root, single-slot graph', () => {
        const u = uniformSlot('u', 'U');
        const sh = shader([u]);
        const g = bindings({
            groups: [group({ slots: [binding(u, [sh])] })],
        });
        expect(isBindingGraph(g)).toBe(true);
        expect(g.roots).toHaveLength(1);
        expect(isGroupNode(g.roots[0])).toBe(true);
        expect(g.roots[0]?.slots).toHaveLength(1);
        expect(isSlotNode(g.roots[0]?.slots[0])).toBe(true);
        expect(g.roots[0]?.slots[0]?.slot).toBe(u);
        expect(g.roots[0]?.slots[0]?.usedBy).toEqual([sh]);
    });

    it('throws when descriptor has no groups', () => {
        expect(() => bindings({ groups: [] })).toThrow(/at least one root group/);
    });

    it('throws when the same slot appears in two SlotNodes', () => {
        const u = uniformSlot('u', 'U');
        const sh = shader([u]);
        expect(() =>
            bindings({
                groups: [
                    group({ slots: [binding(u, [sh])] }),
                    group({ slots: [binding(u, [sh])] }),
                ],
            })
        ).toThrow(/appears in multiple SlotNodes/);
    });

    it('throws when group depth exceeds the limit', () => {
        const u = uniformSlot('u', 'U');
        const sh = shader([u]);
        // Build a chain deeper than the default limit (4).
        const deepest = group({ slots: [binding(u, [sh])] });
        const d4 = group({ groups: [deepest] });
        const d3 = group({ groups: [d4] });
        const d2 = group({ groups: [d3] });
        const d1 = group({ groups: [d2] });
        expect(() => bindings({ groups: [d1] })).toThrow(/exceeds the limit/);
    });

    it('honours a custom groupDepthLimit', () => {
        const u = uniformSlot('u', 'U');
        const sh = shader([u]);
        const deepest = group({ slots: [binding(u, [sh])] });
        const d3 = group({ groups: [deepest] });
        const d2 = group({ groups: [d3] });
        const d1 = group({ groups: [d2] });
        // depth 1→2→3→4: with limit 4, the deepest carrying the slot is at depth 4 → ok.
        expect(() => bindings({ groups: [d1], groupDepthLimit: 4 })).not.toThrow();
        // with limit 3, depth 4 is too deep.
        expect(() => bindings({ groups: [d1], groupDepthLimit: 3 })).toThrow(/exceeds the limit/);
    });

    it('throws when a shader declares a slot not provided by the graph', () => {
        const u = uniformSlot('u', 'U');
        const t = textureSlot('tex', 'texture_2d<f32>');
        const sh = shader([u, t]);
        expect(() =>
            bindings({
                groups: [group({ slots: [binding(u, [sh])] })],
            })
        ).toThrow(/declares slot 'tex'/);
    });

    it('allows a slot in usedBy that the shader does not declare (harmless extra)', () => {
        const u = uniformSlot('u', 'U');
        const extra = uniformSlot('extra', 'X');
        const sh = shader([u]); // does NOT declare `extra`
        expect(() =>
            bindings({
                groups: [
                    group({
                        slots: [binding(u, [sh]), binding(extra, [sh])],
                    }),
                ],
            })
        ).not.toThrow();
    });

    it('deduplicates duplicate shaders in usedBy', () => {
        const u = uniformSlot('u', 'U');
        const sh = shader([u]);
        const g = bindings({
            groups: [group({ slots: [binding(u, [sh, sh, sh])] })],
        });
        expect(g.roots[0]?.slots[0]?.usedBy).toEqual([sh]);
    });

    it('throws when a slot field is not a ResourceSlot', () => {
        const sh = shader([]);
        expect(() =>
            bindings({
                groups: [
                    group({
                        // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid input
                        slots: [{ slot: {} as any, usedBy: [sh] }],
                    }),
                ],
            })
        ).toThrow(/not a ResourceSlot/);
    });
});

describe('resolveShaderBindings()', () => {
    it('assigns binding indices in slot-order within a group', () => {
        const u = uniformSlot('u', 'U');
        const t = textureSlot('tex', 'texture_2d<f32>');
        const s = samplerSlot('samp', 'sampler');
        const sh = shader([u, t, s]);
        const g = bindings({
            groups: [
                group({
                    slots: [binding(u, [sh]), binding(t, [sh]), binding(s, [sh])],
                }),
            ],
        });
        const map = resolveShaderBindings(g, sh);
        expect(map.get(u)).toEqual({ group: 0, binding: 0 });
        expect(map.get(t)).toEqual({ group: 0, binding: 1 });
        expect(map.get(s)).toEqual({ group: 0, binding: 2 });
    });

    it('assigns group index = depth from root for nested groups', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        const sh = shader([a, b, c]);
        const g = bindings({
            groups: [
                group({
                    slots: [binding(a, [sh])],
                    groups: [
                        group({
                            slots: [binding(b, [sh])],
                            groups: [group({ slots: [binding(c, [sh])] })],
                        }),
                    ],
                }),
            ],
        });
        const map = resolveShaderBindings(g, sh);
        expect(map.get(a)).toEqual({ group: 0, binding: 0 });
        expect(map.get(b)).toEqual({ group: 1, binding: 0 });
        expect(map.get(c)).toEqual({ group: 2, binding: 0 });
    });

    it('returns identical {group, binding} for a slot shared across two shaders (fan-out)', () => {
        const camera = uniformSlot('camera', 'Camera');
        const shaderA = shader([camera]);
        const shaderB = shader([camera]);
        const g = bindings({
            groups: [group({ slots: [binding(camera, [shaderA, shaderB])] })],
        });
        const mapA = resolveShaderBindings(g, shaderA);
        const mapB = resolveShaderBindings(g, shaderB);
        expect(mapA.get(camera)).toEqual({ group: 0, binding: 0 });
        expect(mapB.get(camera)).toEqual({ group: 0, binding: 0 });
        expect(mapA.get(camera)).toEqual(mapB.get(camera));
    });

    it('returns an empty map for a shader not present in any SlotNode', () => {
        const u = uniformSlot('u', 'U');
        const sh = shader([u]);
        const orphan = shader([]);
        const g = bindings({
            groups: [group({ slots: [binding(u, [sh])] })],
        });
        const map = resolveShaderBindings(g, orphan);
        expect(map.size).toBe(0);
    });
});

describe('shaderSlotEntries()', () => {
    it('returns entries sorted by (group, binding)', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const c = uniformSlot('c', 'C');
        const sh = shader([a, b, c]);
        const g = bindings({
            groups: [
                group({
                    slots: [binding(a, [sh]), binding(b, [sh])],
                    groups: [group({ slots: [binding(c, [sh])] })],
                }),
            ],
        });
        const entries = shaderSlotEntries(g, sh);
        expect(entries.map((e) => ({ group: e.group, binding: e.binding, name: e.node.slot.name }))).toEqual([
            { group: 0, binding: 0, name: 'a' },
            { group: 0, binding: 1, name: 'b' },
            { group: 1, binding: 0, name: 'c' },
        ]);
    });

    it('skips slots whose usedBy does not include the supplied shader', () => {
        const a = uniformSlot('a', 'A');
        const b = uniformSlot('b', 'B');
        const shaderA = shader([a]);
        const shaderB = shader([b]);
        const g = bindings({
            groups: [
                group({
                    slots: [binding(a, [shaderA]), binding(b, [shaderB])],
                }),
            ],
        });
        const entriesA = shaderSlotEntries(g, shaderA);
        const entriesB = shaderSlotEntries(g, shaderB);
        expect(entriesA.map((e) => e.node.slot.name)).toEqual(['a']);
        expect(entriesB.map((e) => e.node.slot.name)).toEqual(['b']);
    });
});
