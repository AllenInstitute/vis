import { describe, expect, it } from 'vitest';
import {
    atomic,
    depthTexture,
    f32,
    fixedArray,
    mat,
    multisampledTexture,
    scalar,
    storageTexture,
    texture,
    vec,
    vec2f,
    wgslTypeName,
} from './wgsl-types';
import { ZodError } from 'zod';

describe('fixedArray — size validation', () => {
    it('constructs a valid fixed-size array', () => {
        const arr = fixedArray(f32, 4);
        expect(arr).toEqual({ kind: 'array', elementType: f32, size: 4 });
        expect(wgslTypeName(arr)).toBe('array<f32, 4>');
    });

    it('supports nested fixed arrays', () => {
        const nested = fixedArray(fixedArray(vec2f, 3), 2);
        expect(wgslTypeName(nested)).toBe('array<array<vec2f, 3>, 2>');
    });

    it.each([-2, 0, 3.5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid size %p', (size) => {
        expect(() => fixedArray(f32, size)).toThrow(ZodError);
    });
});

describe('flat constructors — valid input', () => {
    it('scalar', () => {
        expect(scalar('u32')).toEqual({ kind: 'scalar', type: 'u32' });
    });

    it('vec', () => {
        expect(vec(3, 'f32')).toEqual({ kind: 'vec', size: 3, componentType: 'f32' });
    });

    it('mat', () => {
        expect(mat(4, 4, 'f32')).toEqual({ kind: 'mat', cols: 4, rows: 4, componentType: 'f32' });
    });

    it('texture', () => {
        expect(texture('2d', 'f32')).toEqual({ kind: 'texture', dimension: '2d', componentType: 'f32' });
    });

    it('depthTexture', () => {
        expect(depthTexture('2d')).toEqual({ kind: 'texture_depth', dimension: '2d' });
    });

    it('multisampledTexture', () => {
        expect(multisampledTexture('f32')).toEqual({
            kind: 'texture_multisampled_2d',
            componentType: 'f32',
        });
    });

    it('storageTexture', () => {
        expect(storageTexture('2d', 'rgba8unorm', 'write')).toEqual({
            kind: 'texture_storage',
            dimension: '2d',
            format: 'rgba8unorm',
            access: 'write',
        });
    });

    it('atomic', () => {
        expect(atomic('i32')).toEqual({ kind: 'atomic', componentType: 'i32' });
    });
});

describe('flat constructors — reject invalid enum values (cast past the type checker)', () => {
    it('scalar rejects an unknown scalar type', () => {
        expect(() => scalar('f64' as never)).toThrow(ZodError);
    });

    it('vec rejects an invalid size', () => {
        expect(() => vec(5 as never, 'f32')).toThrow(ZodError);
    });

    it('vec rejects bool as a component type', () => {
        expect(() => vec(2, 'bool' as never)).toThrow(ZodError);
    });

    it('mat rejects an integer component type', () => {
        expect(() => mat(4, 4, 'i32' as never)).toThrow(ZodError);
    });

    it('texture rejects an unknown dimension', () => {
        expect(() => texture('4d' as never, 'f32')).toThrow(ZodError);
    });

    it('depthTexture rejects the 1d dimension', () => {
        expect(() => depthTexture('1d' as never)).toThrow(ZodError);
    });

    it('storageTexture rejects an unsupported access mode', () => {
        expect(() => storageTexture('2d', 'rgba8unorm', 'append' as never)).toThrow(ZodError);
    });

    it('atomic rejects f32', () => {
        expect(() => atomic('f32' as never)).toThrow(ZodError);
    });
});
