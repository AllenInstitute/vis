import { describe, expect, it, vi } from 'vitest';
import { ShaderStageFlag } from '../native-types';
import { bindShader, samplerResource, textureResource, uniformResource } from '../resources';
import { asSource, shader } from '../shaders';
import { group, makeBindingGraph, pipeline, resource } from './binding-graphs';
import type { DrawContext, ResourceProvider } from './draw-context';
import type { ResourceData } from './resources';
import {
    assembleBindGroupResources,
    traverseBindingGraph,
    traverseBindingGraphLayout,
} from './traversal';

const fakeBuffer: ResourceData = { buffer: {} as GPUBuffer };
const fakeTexture: ResourceData = { texture: {} as GPUTexture };
const fakeSampler: ResourceData = { sampler: {} as GPUSampler };

const makeCtx = (overrides: Partial<DrawContext> = {}): DrawContext => ({
    drawableId: 'drawable-1',
    frameIndex: 0,
    ...overrides,
});

describe('traverseBindingGraph — single group', () => {
    it('assigns sequential bindings within a group', () => {
        const u = uniformResource('u', 'U');
        const t = textureResource('tex', 'texture_2d<f32>');
        const s = samplerResource('samp', 'sampler');
        const pl = pipeline(shader([u, t, s]), { stages: ShaderStageFlag.FRAGMENT });

        const bg = makeBindingGraph([
            group(undefined, [
                resource(undefined, u, fakeBuffer, [pl]),
                resource(undefined, t, fakeTexture, [pl]),
                resource(undefined, s, fakeSampler, [pl]),
            ]),
        ]);

        const result = traverseBindingGraph(bg);
        expect(result.bindings.get(u)).toEqual({ group: 0, binding: 0 });
        expect(result.bindings.get(t)).toEqual({ group: 0, binding: 1 });
        expect(result.bindings.get(s)).toEqual({ group: 0, binding: 2 });
        expect(result.layouts).toHaveLength(1);
        expect(result.layouts[0]).toHaveLength(3);
        expect(result.bindGroupResources[0]).toEqual([fakeBuffer, fakeTexture, fakeSampler]);
    });
});

describe('traverseBindingGraph — nested subgroups', () => {
    it('assigns each level of the subgroup chain a distinct group index', () => {
        const a = uniformResource('a', 'A');
        const b = uniformResource('b', 'B');
        const c = uniformResource('c', 'C');
        const pl = pipeline(shader([a, b, c]), { stages: ShaderStageFlag.VERTEX });

        const bg = makeBindingGraph([
            group(
                'outer',
                [resource(undefined, a, fakeBuffer, [pl])],
                group(
                    'middle',
                    [resource(undefined, b, fakeBuffer, [pl])],
                    group('inner', [resource(undefined, c, fakeBuffer, [pl])])
                )
            ),
        ]);

        const result = traverseBindingGraph(bg);
        expect(result.bindings.get(a)).toEqual({ group: 0, binding: 0 });
        expect(result.bindings.get(b)).toEqual({ group: 1, binding: 0 });
        expect(result.bindings.get(c)).toEqual({ group: 2, binding: 0 });
        expect(result.layouts).toHaveLength(3);
    });
});

describe('traverseBindingGraph — visibility', () => {
    it('explicit Resource.visibility wins', () => {
        const u = uniformResource('u', 'U', { visibility: ShaderStageFlag.VERTEX });
        const pl = pipeline(shader([u]), { stages: ShaderStageFlag.FRAGMENT });
        const bg = makeBindingGraph([group(undefined, [resource(undefined, u, fakeBuffer, [pl])])]);
        const result = traverseBindingGraph(bg);
        expect(result.layouts[0][0].visibility).toBe(ShaderStageFlag.VERTEX);
    });

    it('unions stages of all referencing pipelines when Resource.visibility is unset', () => {
        const u = uniformResource('u', 'U');
        const plV = pipeline(shader([u]), { stages: ShaderStageFlag.VERTEX });
        const plF = pipeline(shader([u]), { stages: ShaderStageFlag.FRAGMENT });
        const bg = makeBindingGraph([group(undefined, [resource(undefined, u, fakeBuffer, [plV, plF])])]);
        const result = traverseBindingGraph(bg);
        expect(result.layouts[0][0].visibility).toBe(ShaderStageFlag.VERTEX | ShaderStageFlag.FRAGMENT);
    });

    it('defaults to all stages when neither is provided', () => {
        const u = uniformResource('u', 'U');
        const pl = pipeline(shader([u]));
        const bg = makeBindingGraph([group(undefined, [resource(undefined, u, fakeBuffer, [pl])])]);
        const result = traverseBindingGraph(bg);
        expect(result.layouts[0][0].visibility).toBe(
            ShaderStageFlag.VERTEX | ShaderStageFlag.FRAGMENT | ShaderStageFlag.COMPUTE
        );
    });
});

describe('traverseBindingGraph — duplicate detection', () => {
    it('throws when the same Resource appears at multiple positions', () => {
        const u = uniformResource('u', 'U');
        const pl = pipeline(shader([u]));
        const bg = makeBindingGraph([
            group(undefined, [
                resource(undefined, u, fakeBuffer, [pl]),
                resource(undefined, u, fakeBuffer, [pl]),
            ]),
        ]);
        expect(() => traverseBindingGraph(bg)).toThrow(/'u'/);
    });
});

describe('integration: traverse → bindShader → asSource', () => {
    it('produces fully resolved WGSL combining raw declarations and Resources', () => {
        const u = uniformResource('unis', 'Uniforms');
        const t = textureResource('tex', 'texture_2d<f32>');
        const s = samplerResource('samp', 'sampler');
        const sh = shader([u, t, s]);
        const pl = pipeline(sh, { stages: ShaderStageFlag.FRAGMENT });
        const bg = makeBindingGraph([
            group(undefined, [
                resource(undefined, u, fakeBuffer, [pl]),
                resource(undefined, t, fakeTexture, [pl]),
                resource(undefined, s, fakeSampler, [pl]),
            ]),
        ]);
        const { bindings } = traverseBindingGraph(bg);
        const bound = bindShader(sh, bindings);
        expect(asSource(bound)).toBe(
            [
                '@group(0) @binding(0) var<uniform> unis: Uniforms;',
                '@group(0) @binding(1) var tex: texture_2d<f32>;',
                '@group(0) @binding(2) var samp: sampler;',
            ].join('\n')
        );
    });
});

describe('traverseBindingGraphLayout — fixed-only graphs', () => {
    it('emits the same bindings and layouts as the legacy single-call API', () => {
        const u = uniformResource('u', 'U');
        const t = textureResource('tex', 'texture_2d<f32>');
        const s = samplerResource('samp', 'sampler');
        const pl = pipeline(shader([u, t, s]), { stages: ShaderStageFlag.FRAGMENT });
        const bg = makeBindingGraph([
            group(undefined, [
                resource(undefined, u, fakeBuffer, [pl]),
                resource(undefined, t, fakeTexture, [pl]),
                resource(undefined, s, fakeSampler, [pl]),
            ]),
        ]);

        const legacy = traverseBindingGraph(bg);
        const layout = traverseBindingGraphLayout(bg);

        expect(layout.bindings.get(u)).toEqual(legacy.bindings.get(u));
        expect(layout.bindings.get(t)).toEqual(legacy.bindings.get(t));
        expect(layout.bindings.get(s)).toEqual(legacy.bindings.get(s));
        expect(layout.layouts).toEqual(legacy.layouts);

        // All slots are fixed and carry the original ResourceData by identity.
        expect(layout.slots).toHaveLength(1);
        expect(layout.slots[0]).toHaveLength(3);
        expect(layout.slots[0]?.[0]).toEqual({ kind: 'fixed', data: fakeBuffer });
        expect(layout.slots[0]?.[1]).toEqual({ kind: 'fixed', data: fakeTexture });
        expect(layout.slots[0]?.[2]).toEqual({ kind: 'fixed', data: fakeSampler });
    });

    it('assembleBindGroupResources on a fixed-only layout matches the legacy bindGroupResources', () => {
        const u = uniformResource('u', 'U');
        const t = textureResource('tex', 'texture_2d<f32>');
        const pl = pipeline(shader([u, t]), { stages: ShaderStageFlag.FRAGMENT });
        const bg = makeBindingGraph([
            group(undefined, [
                resource(undefined, u, fakeBuffer, [pl]),
                resource(undefined, t, fakeTexture, [pl]),
            ]),
        ]);

        const layout = traverseBindingGraphLayout(bg);
        const legacy = traverseBindingGraph(bg);
        const assembled = assembleBindGroupResources(layout, makeCtx());

        expect(assembled).toEqual(legacy.bindGroupResources);
    });
});

describe('traverseBindingGraphLayout — provider slots', () => {
    it('emits a provider slot for callable gpu values', () => {
        const u = uniformResource('u', 'U');
        const pl = pipeline(shader([u]), { stages: ShaderStageFlag.VERTEX });
        const provide: ResourceProvider = vi.fn(() => fakeBuffer);
        const bg = makeBindingGraph([group(undefined, [resource(undefined, u, provide, [pl])])]);

        const layout = traverseBindingGraphLayout(bg);
        expect(layout.slots[0]?.[0]).toEqual({ kind: 'provider', provide });
        // Providers are not invoked during layout traversal.
        expect(provide).not.toHaveBeenCalled();
    });

    it('assembleBindGroupResources invokes each provider once per call with the supplied ctx', () => {
        const u = uniformResource('u', 'U');
        const t = textureResource('tex', 'texture_2d<f32>');
        const pl = pipeline(shader([u, t]), { stages: ShaderStageFlag.FRAGMENT });

        const provideU: ResourceProvider = vi.fn(() => fakeBuffer);
        const provideT: ResourceProvider = vi.fn(() => fakeTexture);

        const bg = makeBindingGraph([
            group(undefined, [
                resource(undefined, u, provideU, [pl]),
                resource(undefined, t, provideT, [pl]),
            ]),
        ]);
        const layout = traverseBindingGraphLayout(bg);

        const ctx = makeCtx({ drawableId: 'd1', frameIndex: 7 });
        const assembled = assembleBindGroupResources(layout, ctx);

        expect(provideU).toHaveBeenCalledTimes(1);
        expect(provideU).toHaveBeenCalledWith(ctx);
        expect(provideT).toHaveBeenCalledTimes(1);
        expect(provideT).toHaveBeenCalledWith(ctx);
        expect(assembled).toEqual([[fakeBuffer, fakeTexture]]);

        // A second call invokes providers again (assembly is not memoized).
        assembleBindGroupResources(layout, ctx);
        expect(provideU).toHaveBeenCalledTimes(2);
        expect(provideT).toHaveBeenCalledTimes(2);
    });

    it('yields different ResourceData per drawable when the provider varies on ctx', () => {
        const u = uniformResource('u', 'U');
        const pl = pipeline(shader([u]), { stages: ShaderStageFlag.VERTEX });

        const bufferA: ResourceData = { buffer: {} as GPUBuffer };
        const bufferB: ResourceData = { buffer: {} as GPUBuffer };
        const provide: ResourceProvider = (ctx) => (ctx.drawableId === 'A' ? bufferA : bufferB);

        const bg = makeBindingGraph([group(undefined, [resource(undefined, u, provide, [pl])])]);
        const layout = traverseBindingGraphLayout(bg);

        expect(assembleBindGroupResources(layout, makeCtx({ drawableId: 'A' }))[0]?.[0]).toBe(bufferA);
        expect(assembleBindGroupResources(layout, makeCtx({ drawableId: 'B' }))[0]?.[0]).toBe(bufferB);
    });

    it('mixed fixed + provider slots resolve independently in the same group', () => {
        const u = uniformResource('u', 'U');
        const t = textureResource('tex', 'texture_2d<f32>');
        const s = samplerResource('samp', 'sampler');
        const pl = pipeline(shader([u, t, s]), { stages: ShaderStageFlag.FRAGMENT });

        const perDrawBuffer: ResourceData = { buffer: {} as GPUBuffer };
        const provideU: ResourceProvider = vi.fn(() => perDrawBuffer);

        const bg = makeBindingGraph([
            group(undefined, [
                resource(undefined, u, provideU, [pl]),
                resource(undefined, t, fakeTexture, [pl]),
                resource(undefined, s, fakeSampler, [pl]),
            ]),
        ]);
        const layout = traverseBindingGraphLayout(bg);

        expect(layout.slots[0]?.[0]?.kind).toBe('provider');
        expect(layout.slots[0]?.[1]?.kind).toBe('fixed');
        expect(layout.slots[0]?.[2]?.kind).toBe('fixed');

        const assembled = assembleBindGroupResources(layout, makeCtx());
        expect(assembled).toEqual([[perDrawBuffer, fakeTexture, fakeSampler]]);
        expect(provideU).toHaveBeenCalledTimes(1);
    });

    it('throws on the legacy traverseBindingGraph shim when any slot is a provider', () => {
        const u = uniformResource('u', 'U');
        const pl = pipeline(shader([u]), { stages: ShaderStageFlag.VERTEX });
        const provide: ResourceProvider = () => fakeBuffer;
        const bg = makeBindingGraph([group(undefined, [resource(undefined, u, provide, [pl])])]);

        expect(() => traverseBindingGraph(bg)).toThrow(/ResourceProvider/);
    });
});

describe('traverseBindingGraphLayout — layout identity stability', () => {
    it('back-to-back calls produce structurally identical bindings and layouts', () => {
        const u = uniformResource('u', 'U');
        const t = textureResource('tex', 'texture_2d<f32>');
        const pl = pipeline(shader([u, t]), { stages: ShaderStageFlag.FRAGMENT });
        const provideU: ResourceProvider = () => fakeBuffer;
        const bg = makeBindingGraph([
            group(undefined, [
                resource(undefined, u, provideU, [pl]),
                resource(undefined, t, fakeTexture, [pl]),
            ]),
        ]);

        const a = traverseBindingGraphLayout(bg);
        const b = traverseBindingGraphLayout(bg);

        expect(b.bindings.get(u)).toEqual(a.bindings.get(u));
        expect(b.bindings.get(t)).toEqual(a.bindings.get(t));
        expect(b.layouts).toEqual(a.layouts);
        // Slot kinds and the underlying fixed-data identities are stable across calls.
        expect(b.slots[0]?.[0]?.kind).toBe('provider');
        expect(b.slots[0]?.[1]).toEqual({ kind: 'fixed', data: fakeTexture });
    });
});
