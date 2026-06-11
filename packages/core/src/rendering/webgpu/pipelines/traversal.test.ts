import { describe, expect, it } from 'vitest';
import { ShaderStageFlag } from '../native-types';
import { bindShader, samplerResource, textureResource, uniformResource } from '../resources';
import { asSource, shader } from '../shaders';
import { group, makeBindingGraph, pipeline, resource } from './binding-graphs';
import type { ResourceData } from './resources';
import { traverseBindingGraph } from './traversal';

const fakeBuffer: ResourceData = { buffer: {} as GPUBuffer };
const fakeTexture: ResourceData = { texture: {} as GPUTexture };
const fakeSampler: ResourceData = { sampler: {} as GPUSampler };

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
