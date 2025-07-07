import * as lo from 'lodash'; // vite/astro went bonkers - not sure why this helps, core has always had lodash in it...
import { PriorityCache, type Store, type Resource } from './priority-cache';
import { mergeAndAdd, prioritizeCacheKeys, priorityDelta } from './utils';
const { uniqueId } = lo;
// goal: we want clients of the cache to experience a type-safe interface -
// they expect that the things coming out of the cache are the type they expect (what they put in it)
// this is not strictly true, as the cache is shared, and other clients may use different types
// also also - there will not be a 1:1 relation between items and
// explaination of terms:
// Item = a placeholder for something in the cache, used as a key in the cache. good examples:
//  metadata {url, bounds} for a tile in a larger dataset.
// ItemContent = the actual heavy data that Item is a placeholder for - for example one or more arrays of
//  raw data used by the client of the cache - the value we are caching.
type CacheInterface<Item, ItemContent extends Record<string, Resource>> = {
    get: (k: Item) => ItemContent | undefined;
    has: (k: Item) => boolean;
    unsubscribeFromCache: () => void;
    setPriorities: (low: Set<Item>, high: Set<Item>) => void;
};
type Fetcher = (sig: AbortSignal) => Promise<Resource>;

export type ClientSpec<Item, ItemContent extends Record<string, Resource>> = {
    isValue: (v: Record<string, Resource | undefined>) => v is ItemContent;
    cacheKeys: (item: Item) => { [k in keyof ItemContent]: string };
    onDataArrived?: (cacheKey: string) => void; // todo very not helpful
    fetch: (item: Item) => { [k in keyof ItemContent]: (abort: AbortSignal) => Promise<Resource> };
};
type ObjectValue<T extends Record<string, any>> = T extends Record<string, infer Value> ? Value : never;

type KV<T extends Record<string, any>> = readonly [keyof T, ObjectValue<T>];

function entries<T extends Record<string, any>>(t: T): ReadonlyArray<KV<T>> {
    return Object.entries(t) as ReadonlyArray<KV<T>>;
}
function mapFields<R extends Record<string, any>, Result>(
    r: R,
    fn: (v: ObjectValue<R>) => Result,
): { [k in keyof R]: Result } {
    return entries(r).reduce((acc, [k, v]) => ({ ...acc, [k]: fn(v) }), {} as { [k in keyof R]: Result });
}

type Client = {
    priorities: Record<string, number>;
    notify: undefined | ((cacheKey: string) => void);
};
export class SharedPriorityCache {
    private cache: PriorityCache;
    private clients: Record<string, Client>;
    private importance: Record<string, number>;
    constructor(store: Store<string, Resource>, limitInBytes: number, max_concurrent_fetches: number = 10) {
        this.importance = {};
        this.clients = {};
        this.cache = new PriorityCache(
            store,
            (ck) => this.importance[ck] ?? 0,
            limitInBytes,
            max_concurrent_fetches,
            (ck) => this.onCacheEntryArrived(ck),
        );
    }
    registerClient<Item, ItemContent extends Record<string, Resource>>(
        spec: ClientSpec<Item, ItemContent>,
    ): CacheInterface<Item, ItemContent> {
        const id = uniqueId('client');
        this.clients[id] = { priorities: {}, notify: spec.onDataArrived };

        const enqueuePriorities = (spec: ClientSpec<Item, ItemContent>, items: Iterable<Item>) => {
            for (const item of items) {
                const keys = spec.cacheKeys(item);
                Object.entries(spec.fetch(item)).forEach(([sk, fetcher]) => {
                    const ck = keys[sk];
                    if (ck !== undefined) {
                        this.cache.enqueue(ck, fetcher);
                    }
                });
            }
        };
        const setPriorities = (low: Iterable<Item>, high: Iterable<Item>) => {
            const client = this.clients[id];

            if (!client) return; // the client can hold onto a reference to this interface, even after they call unregister - this prevents a crash in that scenario

            const updated = mergeAndAdd(prioritizeCacheKeys(spec, low, 1), prioritizeCacheKeys(spec, high, 2));
            let changed = 0;
            priorityDelta(client.priorities, updated, (cacheKey, delta) => {
                changed += delta !== 0 ? 1 : 0;
                this.updateImportance(cacheKey, delta);
            });
            if (changed === 0) {
                // nothing changed at all - no need to reprioritize, nor enqueue requests
                return;
            }
            this.cache.reprioritize((ck) => this.importance[ck] ?? 0);
            client.priorities = updated;

            // note: many keys may already be cached, or requested - its harmless to re-request them.
            // there is obviously some overhead, but in testing it seems fine
            enqueuePriorities(spec, high);
            enqueuePriorities(spec, low);
        };

        return {
            get: (k: Item) => {
                const keys = spec.cacheKeys(k);
                const v = mapFields<Record<string, string>, Resource | undefined>(keys, (k) => this.cache.get(k));
                return spec.isValue(v) ? v : undefined;
            },
            has: (k: Item) => {
                const atLeastOneMissing = Object.values(spec.cacheKeys(k)).some((ck) => !this.cache.has(ck));
                return !atLeastOneMissing;
            },

            unsubscribeFromCache: () => {
                setPriorities(new Set(), new Set()); // mark that this client has no priorities, which will decrement the counts for all
                // priorities it used to have
                delete this.clients[id];
            },
            setPriorities,
        };
    }
    private onCacheEntryArrived(key: string) {
        // find any clients that want this...
        // and notify them
        for (const cid of Object.keys(this.clients)) {
            const client = this.clients[cid];
            if ((client.priorities[key] ?? 0) > 0) {
                client.notify?.(key);
            }
        }
    }
    private updateImportance(key: string, delta: number) {
        this.importance[key] = Math.max(0, (this.importance[key] ?? 0) + delta);
    }
}
