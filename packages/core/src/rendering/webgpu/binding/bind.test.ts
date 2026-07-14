import { describe, expect, it } from 'vitest';
import { constant, shader } from '../shaders';
import { type BindingMap, bindShader } from './bind';
import { uniformSlot } from './slot';

describe('bindShader', () => {
    it('replaces ResourceSlot declarations with BoundSlot wrappers', () => {
        const u = uniformSlot('u', 'U');
        const s = shader([u]);
        const bindings: BindingMap = new Map([[u, { group: 0, binding: 0 }]]);
        const bound = bindShader(s, bindings);
        expect(bound.declarations[0]).not.toBe(u);
        expect(bound.declarations[0].__gen()).toBe('@group(0) @binding(0) var<uniform> u: U;');
    });

    it('passes through non-Resource declarations by reference', () => {
        const c = constant('pi', 3.14);
        const u = uniformSlot('u', 'U');
        const s = shader([c, u]);
        const bindings: BindingMap = new Map([[u, { group: 0, binding: 0 }]]);
        const bound = bindShader(s, bindings);
        expect(bound.declarations[0]).toBe(c);
        expect(bound.declarations[1]).not.toBe(u);
    });

    it('throws listing every unbound resource name', () => {
        const a = uniformSlot('alpha', 'A');
        const b = uniformSlot('beta', 'B');
        const s = shader([a, b]);
        expect(() => bindShader(s, new Map())).toThrow(/alpha.*beta|beta.*alpha/);
    });

    it('returns a new shader (does not mutate input)', () => {
        const u = uniformSlot('u', 'U');
        const s = shader([u]);
        const bindings: BindingMap = new Map([[u, { group: 0, binding: 0 }]]);
        const bound = bindShader(s, bindings);
        expect(bound).not.toBe(s);
        expect(s.declarations[0]).toBe(u);
    });
});
