import { describe, expect, it } from 'vitest';
import { ShaderStageFlag } from '../native-types';
import { textureSlot, uniformSlot } from '../resources';
import { shader } from '../shaders';
import { computeBindGroupCacheKey } from './bind-group-cache';
import { group, makeBindingGraph, pipeline, resource } from './binding-graphs';
import type { DrawContext } from './draw-context';
import type { ResourceData } from './resources';
import { traverseBindingGraphLayout } from './traversal';

const fakeBuffer: ResourceData = { buffer: {} as GPUBuffer };
const fakeTexture: ResourceData = { texture: {} as GPUTexture };

const makeCtx = (overrides: Partial<DrawContext> = {}): DrawContext => ({
    drawableId: 'd1',
    frameIndex: 0,
    ...overrides,
});

function makeTwoBindingLayout() {
    const u = uniformSlot('u', 'U');
    const t = textureSlot('tex', 'texture_2d<f32>');
    const pl = pipeline(shader([u, t]), { stages: ShaderStageFlag.FRAGMENT });
    const bg = makeBindingGraph([
        group(undefined, [resource(undefined, u, fakeBuffer, [pl]), resource(undefined, t, fakeTexture, [pl])]),
    ]);
    return traverseBindingGraphLayout(bg);
}

describe('computeBindGroupCacheKey', () => {
    it('produces a stable, deterministic string for identical inputs', () => {
        const layout = makeTwoBindingLayout();
        const ctx = makeCtx();
        const versions = [[0, 0]];
        expect(computeBindGroupCacheKey(layout, ctx, versions)).toBe(
            computeBindGroupCacheKey(layout, ctx, versions)
        );
    });

    it('key changes when drawableId changes', () => {
        const layout = makeTwoBindingLayout();
        const versions = [[0, 0]];
        const a = computeBindGroupCacheKey(layout, makeCtx({ drawableId: 'A' }), versions);
        const b = computeBindGroupCacheKey(layout, makeCtx({ drawableId: 'B' }), versions);
        expect(a).not.toBe(b);
    });

    it('key changes when any content version changes', () => {
        const layout = makeTwoBindingLayout();
        const ctx = makeCtx();
        const before = computeBindGroupCacheKey(layout, ctx, [[0, 0]]);
        const afterFirst = computeBindGroupCacheKey(layout, ctx, [[1, 0]]);
        const afterSecond = computeBindGroupCacheKey(layout, ctx, [[0, 1]]);
        expect(afterFirst).not.toBe(before);
        expect(afterSecond).not.toBe(before);
        expect(afterFirst).not.toBe(afterSecond);
    });

    it('key does NOT change when frameIndex alone changes', () => {
        // frameIndex is informational for providers; bind-group identity does not depend on it.
        const layout = makeTwoBindingLayout();
        const versions = [[0, 0]];
        const a = computeBindGroupCacheKey(layout, makeCtx({ frameIndex: 0 }), versions);
        const b = computeBindGroupCacheKey(layout, makeCtx({ frameIndex: 99 }), versions);
        expect(a).toBe(b);
    });

    it('throws when contentVersions shape does not match the layout', () => {
        const layout = makeTwoBindingLayout();
        expect(() => computeBindGroupCacheKey(layout, makeCtx(), [])).toThrow(/groups/);
        expect(() => computeBindGroupCacheKey(layout, makeCtx(), [[0]])).toThrow(/bindings/);
        expect(() => computeBindGroupCacheKey(layout, makeCtx(), [[0, 0, 0]])).toThrow(/bindings/);
    });
});
