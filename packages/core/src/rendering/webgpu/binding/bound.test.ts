import { describe, expect, it } from 'vitest';
import { ShaderStageFlag } from '../native-types';
import { sampler, storage, texture, uniform } from '../shaders';
import { bind, toBindGroupLayoutEntry } from './bound';
import {
    externalTextureSlot,
    samplerSlot,
    storageSlot,
    storageTextureSlot,
    textureSlot,
    uniformSlot,
} from './slot';

describe('bind', () => {
    it('returns a frozen object', () => {
        const r = uniformSlot('u', 'U');
        const b = bind(r, 0, 1);
        expect(Object.isFrozen(b)).toBe(true);
    });

    it('does not mutate the source Resource', () => {
        const r = uniformSlot('u', 'U');
        bind(r, 0, 1);
        expect('group' in r).toBe(false);
        expect('binding' in r).toBe(false);
    });

    it('attaches group and binding to the wrapper', () => {
        const r = uniformSlot('u', 'U');
        const b = bind(r, 2, 5);
        expect(b.group).toBe(2);
        expect(b.binding).toBe(5);
    });

    it('uniform: __gen() byte-matches the equivalent raw $s.uniform output', () => {
        const r = uniformSlot('unis', 'Uniforms');
        expect(bind(r, 0, 0).__gen()).toBe(uniform('unis', 'Uniforms', 0, 0).__gen());
    });

    it('storage: __gen() byte-matches the equivalent raw $s.storage output (with accessMode)', () => {
        const r = storageSlot('buf', 'BufType', { accessMode: 'read_write' });
        expect(bind(r, 1, 2).__gen()).toBe(storage('buf', 'BufType', 1, 2, 'read_write').__gen());
    });

    it('storage: __gen() byte-matches when accessMode is omitted', () => {
        const r = storageSlot('buf', 'BufType');
        expect(bind(r, 0, 0).__gen()).toBe(storage('buf', 'BufType', 0, 0).__gen());
    });

    it('texture: __gen() byte-matches the equivalent raw $s.texture output', () => {
        const r = textureSlot('colorMap', 'texture_2d<f32>');
        expect(bind(r, 0, 1).__gen()).toBe(texture('colorMap', 'texture_2d<f32>', 0, 1).__gen());
    });

    it('storageTexture: __gen() emits a `var` declaration with the supplied type', () => {
        const r = storageTextureSlot('img', 'texture_storage_2d<rgba8unorm, write>', 'rgba8unorm');
        // delegates to $s.texture under the hood — the type identifier carries format/access.
        expect(bind(r, 0, 3).__gen()).toBe(
            texture('img', 'texture_storage_2d<rgba8unorm, write>', 0, 3).__gen()
        );
    });

    it('sampler: __gen() byte-matches the equivalent raw $s.sampler output', () => {
        const r = samplerSlot('samp', 'sampler');
        expect(bind(r, 0, 2).__gen()).toBe(sampler('samp', 'sampler', 0, 2).__gen());
    });

    it('externalTexture: __gen() emits a texture_external var declaration', () => {
        const r = externalTextureSlot('vid');
        expect(bind(r, 0, 0).__gen()).toBe(texture('vid', 'texture_external', 0, 0).__gen());
    });
});

describe('toBindGroupLayoutEntry', () => {
    const VERTEX = ShaderStageFlag.VERTEX;

    it('uniform → buffer.type=uniform', () => {
        const r = uniformSlot('u', 'U', { hasDynamicOffset: true, minBindingSize: 64 });
        const entry = toBindGroupLayoutEntry(bind(r, 0, 0), VERTEX);
        expect(entry).toEqual({
            binding: 0,
            visibility: VERTEX,
            buffer: { type: 'uniform', hasDynamicOffset: true, minBindingSize: 64 },
        });
    });

    it('storage with accessMode=read → buffer.type=read-only-storage', () => {
        const r = storageSlot('b', 'B', { accessMode: 'read' });
        const entry = toBindGroupLayoutEntry(bind(r, 0, 1), VERTEX);
        expect(entry.buffer?.type).toBe('read-only-storage');
    });

    it('storage with accessMode=read_write → buffer.type=storage', () => {
        const r = storageSlot('b', 'B', { accessMode: 'read_write' });
        const entry = toBindGroupLayoutEntry(bind(r, 0, 1), VERTEX);
        expect(entry.buffer?.type).toBe('storage');
    });

    it('texture → texture entry with sampleType + viewDimension + multisampled', () => {
        const r = textureSlot('t', 'texture_2d<f32>', {
            sampleType: 'float',
            viewDimension: '2d',
            multisampled: false,
        });
        const entry = toBindGroupLayoutEntry(bind(r, 0, 0), VERTEX);
        expect(entry.texture).toEqual({ sampleType: 'float', viewDimension: '2d', multisampled: false });
    });

    it('storageTexture → storageTexture entry with format + access + viewDimension', () => {
        const r = storageTextureSlot('img', 'texture_storage_2d<rgba8unorm, write>', 'rgba8unorm', {
            access: 'write-only',
            viewDimension: '2d',
        });
        const entry = toBindGroupLayoutEntry(bind(r, 0, 0), VERTEX);
        expect(entry.storageTexture).toEqual({ format: 'rgba8unorm', access: 'write-only', viewDimension: '2d' });
    });

    it('sampler → sampler entry with bindingType', () => {
        const r = samplerSlot('s', 'sampler', { bindingType: 'filtering' });
        const entry = toBindGroupLayoutEntry(bind(r, 0, 0), VERTEX);
        expect(entry.sampler).toEqual({ type: 'filtering' });
    });

    it('externalTexture → externalTexture entry (empty object)', () => {
        const r = externalTextureSlot('ext');
        const entry = toBindGroupLayoutEntry(bind(r, 0, 0), VERTEX);
        expect(entry.externalTexture).toEqual({});
    });
});
