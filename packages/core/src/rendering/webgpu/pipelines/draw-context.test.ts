import { describe, expect, it, vi } from 'vitest';
import { DrawableLeases, isResourceProvider, type ResourceProvider } from './draw-context';
import type { ResourceData } from './resources';

describe('isResourceProvider', () => {
    it('returns true for a callable', () => {
        const provider: ResourceProvider = () => ({ buffer: {} as GPUBuffer });
        expect(isResourceProvider(provider)).toBe(true);
    });

    it('returns false for a fixed ResourceData object', () => {
        const buffer: ResourceData = { buffer: {} as GPUBuffer };
        const texture: ResourceData = { texture: {} as GPUTexture };
        const sampler: ResourceData = { sampler: {} as GPUSampler };
        expect(isResourceProvider(buffer)).toBe(false);
        expect(isResourceProvider(texture)).toBe(false);
        expect(isResourceProvider(sampler)).toBe(false);
    });

    it('returns false for primitives and null', () => {
        expect(isResourceProvider(null)).toBe(false);
        expect(isResourceProvider(undefined)).toBe(false);
        expect(isResourceProvider(false)).toBe(false);
        expect(isResourceProvider(42)).toBe(false);
        expect(isResourceProvider('not a provider')).toBe(false);
    });
});

describe('DrawableLeases', () => {
    it('starts empty', () => {
        const leases = new DrawableLeases();
        expect(leases.count()).toBe(0);
    });

    it('add() increments count and releaseAll() invokes each release exactly once', () => {
        const leases = new DrawableLeases();
        const a = { release: vi.fn() };
        const b = { release: vi.fn() };
        const c = { release: vi.fn() };

        leases.add(a);
        leases.add(b);
        leases.add(c);
        expect(leases.count()).toBe(3);

        leases.releaseAll();

        expect(a.release).toHaveBeenCalledTimes(1);
        expect(b.release).toHaveBeenCalledTimes(1);
        expect(c.release).toHaveBeenCalledTimes(1);
        expect(leases.count()).toBe(0);
    });

    it('releases tokens in insertion order', () => {
        const leases = new DrawableLeases();
        const order: string[] = [];
        leases.add({ release: () => order.push('a') });
        leases.add({ release: () => order.push('b') });
        leases.add({ release: () => order.push('c') });
        leases.releaseAll();
        expect(order).toEqual(['a', 'b', 'c']);
    });

    it('a second releaseAll() is a no-op until further tokens are added', () => {
        const leases = new DrawableLeases();
        const r = { release: vi.fn() };
        leases.add(r);
        leases.releaseAll();
        leases.releaseAll();
        expect(r.release).toHaveBeenCalledTimes(1);

        const r2 = { release: vi.fn() };
        leases.add(r2);
        leases.releaseAll();
        expect(r.release).toHaveBeenCalledTimes(1);
        expect(r2.release).toHaveBeenCalledTimes(1);
    });

    it('nested DrawableLeases releases its children when released by an outer bundle', () => {
        const outer = new DrawableLeases();
        const inner = new DrawableLeases();
        const leaf = { release: vi.fn() };
        inner.add(leaf);
        outer.add(inner);

        outer.releaseAll();

        expect(leaf.release).toHaveBeenCalledTimes(1);
        expect(inner.count()).toBe(0);
        expect(outer.count()).toBe(0);
    });
});
