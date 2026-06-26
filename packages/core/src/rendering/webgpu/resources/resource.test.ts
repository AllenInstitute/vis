import { describe, expect, it } from 'vitest';
import {
    externalTextureSlot,
    isResourceSlot,
    RESOURCE_SLOT_BRAND,
    samplerSlot,
    storageSlot,
    storageTextureSlot,
    textureSlot,
    uniformSlot,
} from './resource';

describe('isResource', () => {
    it('returns true for objects created by Resource constructors', () => {
        expect(isResourceSlot(uniformSlot('u', 'U'))).toBe(true);
        expect(isResourceSlot(storageSlot('s', 'S'))).toBe(true);
        expect(isResourceSlot(textureSlot('t', 'texture_2d<f32>'))).toBe(true);
        expect(isResourceSlot(storageTextureSlot('st', 'texture_storage_2d<rgba8unorm, write>', 'rgba8unorm'))).toBe(
            true
        );
        expect(isResourceSlot(samplerSlot('samp', 'sampler'))).toBe(true);
        expect(isResourceSlot(externalTextureSlot('ext'))).toBe(true);
    });

    it('returns false for plain objects, primitives, and null', () => {
        expect(isResourceSlot(null)).toBe(false);
        expect(isResourceSlot(undefined)).toBe(false);
        expect(isResourceSlot(42)).toBe(false);
        expect(isResourceSlot('uniform')).toBe(false);
        expect(isResourceSlot({})).toBe(false);
        expect(isResourceSlot({ __brand: 'not-it' })).toBe(false);
        expect(isResourceSlot({ name: 'u', kind: 'uniform' })).toBe(false);
    });
});

describe('Resource.__gen (unbound)', () => {
    it('throws a useful error mentioning the resource name', () => {
        const u = uniformSlot('myUniform', 'MyType');
        expect(() => u.__gen()).toThrow(/myUniform/);
        expect(() => u.__gen()).toThrow(/bound/);
    });

    it.each([
        ['uniform', () => uniformSlot('u', 'U')],
        ['storage', () => storageSlot('s', 'S')],
        ['texture', () => textureSlot('t', 'texture_2d<f32>')],
        ['storageTexture', () => storageTextureSlot('st', 'texture_storage_2d<rgba8unorm, write>', 'rgba8unorm')],
        ['sampler', () => samplerSlot('samp', 'sampler')],
        ['externalTexture', () => externalTextureSlot('ext')],
    ] as const)('throws for unbound %s resource', (_, build) => {
        expect(() => build().__gen()).toThrow();
    });
});

describe('Resource constructors', () => {
    it('attach the brand symbol', () => {
        expect(uniformSlot('u', 'U').__brand).toBe(RESOURCE_SLOT_BRAND);
    });

    it('preserve provided fields', () => {
        const r = uniformSlot('u', 'U', { hasDynamicOffset: true, minBindingSize: 64, visibility: 0x3 });
        expect(r.name).toBe('u');
        expect(r.type).toBe('U');
        expect(r.hasDynamicOffset).toBe(true);
        expect(r.minBindingSize).toBe(64);
        expect(r.visibility).toBe(0x3);
        expect(r.kind).toBe('uniform');
    });

    it('storageSlot carries accessMode', () => {
        const r = storageSlot('buf', 'BufType', { accessMode: 'read_write' });
        expect(r.accessMode).toBe('read_write');
    });

    it('storageTextureSlot carries format', () => {
        const r = storageTextureSlot('st', 'texture_storage_2d<rgba8unorm, write>', 'rgba8unorm');
        expect(r.format).toBe('rgba8unorm');
    });
});
