import { describe, it, expect } from 'vitest';
import { constant, type Declaration, func, member, struct, uniform } from './declarations';
import { asSource, isWgslShader, shader } from './shader';

describe('isWgslShader', () => {
    it('returns true for a valid shader with no declarations', () => {
        expect(isWgslShader({ declarations: [] })).toBe(true);
    });

    it('returns true for a shader with declarations', () => {
        expect(isWgslShader({ declarations: [constant('x', 1)] })).toBe(true);
    });

    it('returns false for null', () => {
        expect(isWgslShader(null)).toBe(false);
    });

    it('returns false for non-object primitives', () => {
        expect(isWgslShader('string')).toBe(false);
        expect(isWgslShader(42)).toBe(false);
        expect(isWgslShader(undefined)).toBe(false);
    });

    it('returns false for an object missing the declarations property', () => {
        expect(isWgslShader({})).toBe(false);
    });

    it('returns false when declarations is not an array', () => {
        expect(isWgslShader({ declarations: 'not an array' })).toBe(false);
        expect(isWgslShader({ declarations: null })).toBe(false);
    });
});

describe('shader', () => {
    it('creates a WgslShader with no declarations', () => {
        const s = shader([]);
        expect(s.declarations).toEqual([]);
    });

    it('creates a WgslShader preserving the provided declarations', () => {
        const decls = [constant('a', 1), constant('b', 2)];
        const s = shader(decls);
        expect(s.declarations).toHaveLength(2);
        expect(s.declarations[0]).toBe(decls[0]);
    });
});

describe('asSource', () => {
    it('returns an empty string for a shader with no declarations', () => {
        expect(asSource(shader([]))).toBe('');
    });

    it('returns a single declaration', () => {
        expect(asSource(shader([constant('x', 1)]))).toBe('const x = 1;');
    });

    it('joins multiple declarations with a newline', () => {
        const src = asSource(shader([constant('x', 1), constant('y', 2)]));
        expect(src).toBe('const x = 1;\nconst y = 2;');
    });

    it('renders all declarations in the order they were provided', () => {
        const S = struct('S', [member('v', 'f32')]);
        const U = uniform('u', S, 0, 0);
        const F = func('f', [], () => '');
        const s = shader([S, U, F]);
        const src = asSource(s);
        expect(src).toBe(`${S.__gen()}\n${U.__gen()}\n${F.__gen()}`);
    });

    it('throws for an invalid shader object', () => {
        expect(() => asSource({ declarations: 'bad' as unknown as Declaration[] })).toThrow();
    });
});
