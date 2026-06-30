/**
 * `DrawContext` and `ResourceProvider` enable a single binding-graph `Resource` to be backed by a
 * different `ResourceData` per drawable, without rebuilding the graph for each draw.
 *
 * The binding-graph layout (group/binding assignments, BGL entries) is computed once with
 * `traverseBindingGraphLayout(graph)` (see `./traversal`). Per drawable, the caller invokes
 * `assembleBindGroupResources(layout, ctx)` to gather the concrete `ResourceData[][]`. Provider
 * slots invoke their callable with the supplied `ctx`; fixed slots pass through their literal
 * `ResourceData`.
 *
 * Phase 1 ships the types and a usable `DrawableLeases` collector. Phase 2 (the buffer-adapter
 * implementation) will arrange for providers that acquire from the pool to push their lease
 * tokens into `ctx.leases`, so a drawable's destruction can release all of its leases via a
 * single `releaseAll()` call.
 */

import type { ResourceData } from './resources';

/**
 * Per-drawable, per-frame context threaded through `assembleBindGroupResources` to providers.
 *
 * `drawableId` is the stable identity used for bind-group cache keying (see
 * `./bind-group-cache`). `frameIndex` lets providers vary by frame (e.g., a triple-buffered
 * uniform). `leases`, when present, is the destination for any per-draw `release()`-able tokens
 * a provider acquires (e.g., buffer leases from the Phase 2 adapter).
 */
export type DrawContext = {
    readonly drawableId: string;
    readonly frameIndex: number;
    readonly leases?: DrawableLeases;
};

/**
 * Callable that yields a concrete `ResourceData` for a given draw. Providers should be pure
 * with respect to `ctx` and any external state they read (a provider invoked twice with the same
 * `ctx` should return equivalent `ResourceData`).
 */
export type ResourceProvider = (ctx: DrawContext) => ResourceData;

/**
 * Runtime guard distinguishing a `ResourceProvider` (a callable) from a fixed `ResourceData`
 * (always an object). Because `ResourceData` is exclusively object-shaped
 * (`{ buffer }` | `{ texture }` | `{ sampler }`), `typeof === 'function'` is unambiguous.
 */
export function isResourceProvider(value: unknown): value is ResourceProvider {
    return typeof value === 'function';
}

/** Anything that can be released by a drawable's lease bundle. */
export interface Releasable {
    release(): void;
}

/**
 * Bundle of `Releasable` tokens scoped to a single drawable. Providers (in Phase 2) push their
 * acquired buffer leases here so the drawable's owner can `releaseAll()` on destruction without
 * tracking each handle individually.
 *
 * Phase 1: usable as a plain collector; calling `releaseAll()` invokes each `release()` once and
 * clears the internal list.
 */
export class DrawableLeases implements Releasable {
    #items: Releasable[] = [];

    /** Add a releasable token to this bundle. Insertion order is preserved. */
    add(releasable: Releasable): void {
        this.#items.push(releasable);
    }

    /**
     * Release every token added since construction (or since the last `releaseAll()`), in
     * insertion order, then clear the internal list. Safe to call repeatedly; subsequent calls
     * are no-ops until further tokens are added.
     */
    releaseAll(): void {
        const items = this.#items;
        this.#items = [];
        for (const item of items) {
            item.release();
        }
    }

    /** Convenience: behaves identically to `releaseAll()`, so a bundle can itself be added to
     *  another bundle. */
    release(): void {
        this.releaseAll();
    }

    /** Number of currently-held tokens. */
    count(): number {
        return this.#items.length;
    }
}
