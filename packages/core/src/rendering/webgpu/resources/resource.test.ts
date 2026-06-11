import { describe, expect, it } from 'vitest';
import {
    externalTextureResource,
    isResource,
    RESOURCE_BRAND,
    samplerResource,
    storageResource,
    storageTextureResource,
    textureResource,
    uniformResource,
} from './resource';

describe('isResource', () => {
    it('returns true for objects created by Resource constructors', () => {
        expect(isResource(uniformResource('u', 'U'))).toBe(true);
        expect(isResource(storageResource('s', 'S'))).toBe(true);
        expect(isResource(textureResource('t', 'texture_2d<f32>'))).toBe(true);
        expect(isResource(storageTextureResource('st', 'texture_storage_2d<rgba8unorm, write>', 'rgba8unorm'))).toBe(
            true
        );
        expect(isResource(samplerResource('samp', 'sampler'))).toBe(true);
        expect(isResource(externalTextureResource('ext'))).toBe(true);
    });

    it('returns false for plain objects, primitives, and null', () => {
        expect(isResource(null)).toBe(false);
        expect(isResource(undefined)).toBe(false);
        expect(isResource(42)).toBe(false);
        expect(isResource('uniform')).toBe(false);
        expect(isResource({})).toBe(false);
        expect(isResource({ __brand: 'not-it' })).toBe(false);
        expect(isResource({ name: 'u', kind: 'uniform' })).toBe(false);
    });
});

describe('Resource.__gen (unbound)', () => {
    it('throws a useful error mentioning the resource name', () => {
        const u = uniformResource('myUniform', 'MyType');
        expect(() => u.__gen()).toThrow(/myUniform/);
        expect(() => u.__gen()).toThrow(/bound/);
    });

    it.each([
        ['uniform', () => uniformResource('u', 'U')],
        ['storage', () => storageResource('s', 'S')],
        ['texture', () => textureResource('t', 'texture_2d<f32>')],
        ['storageTexture', () => storageTextureResource('st', 'texture_storage_2d<rgba8unorm, write>', 'rgba8unorm')],
        ['sampler', () => samplerResource('samp', 'sampler')],
        ['externalTexture', () => externalTextureResource('ext')],
    ] as const)('throws for unbound %s resource', (_, build) => {
        expect(() => build().__gen()).toThrow();
    });
});

describe('Resource constructors', () => {
    it('attach the brand symbol', () => {
        expect(uniformResource('u', 'U').__brand).toBe(RESOURCE_BRAND);
    });

    it('preserve provided fields', () => {
        const r = uniformResource('u', 'U', { hasDynamicOffset: true, minBindingSize: 64, visibility: 0x3 });
        expect(r.name).toBe('u');
        expect(r.type).toBe('U');
        expect(r.hasDynamicOffset).toBe(true);
        expect(r.minBindingSize).toBe(64);
        expect(r.visibility).toBe(0x3);
        expect(r.kind).toBe('uniform');
    });

    it('storageResource carries accessMode', () => {
        const r = storageResource('buf', 'BufType', { accessMode: 'read_write' });
        expect(r.accessMode).toBe('read_write');
    });

    it('storageTextureResource carries format', () => {
        const r = storageTextureResource('st', 'texture_storage_2d<rgba8unorm, write>', 'rgba8unorm');
        expect(r.format).toBe('rgba8unorm');
    });
});
