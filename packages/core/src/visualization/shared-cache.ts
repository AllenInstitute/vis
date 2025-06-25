import { type Chunk, PriorityCacheWarmer } from "./cache-warmer";
import type { Resource, Store } from "./pcache";

import * as lo from 'lodash' // vite/astro went bonkers - not sure why this helps, core has always had lodash in it...
const { uniqueId } = lo

// goal: we want clients of the cache to experience a type-safe interface -
// they expect that the things coming out of the cache are the type they expect (what they put in it)
// this is not strictly true, as the cache is shared, and other clients may use different types
// also also - there will not be a 1:1 relation between items and
type CacheInterface<Key, Value extends Record<string, Resource>> = {
    get: (k: Key) => Value | undefined
    has: (k: Key) => boolean
    unsubscribeFromCache: () => void;
    setPriorities: (low: Set<Key>, high: Set<Key>) => void;
}

type ClientSpec<Key, Value extends Record<string, Resource>> = {
    isValue: (v: Record<string, Resource | undefined>) => v is Value
    cacheKeys: (item: Key) => { [k in keyof Value]: string }
    onDataArrived?: (cacheKey: string) => void // todo very not helpful
    fetch: (item: Key) => { [k in keyof Value]: (abort: AbortSignal) => Promise<Resource> }
}
type ObjectValue<T extends Record<string, any>> = T extends Record<string, infer Value> ? Value : never;

type KV<T extends Record<string, any>> = readonly [keyof T, ObjectValue<T>]

function entries<T extends Record<string, any>>(t: T): ReadonlyArray<KV<T>> {
    return Object.entries(t) as ReadonlyArray<KV<T>>
}
function mapFields<R extends Record<string, any>, Result>(r: R, fn: (v: ObjectValue<R>) => Result): { [k in keyof R]: Result } {
    return entries(r).reduce((acc, [k, v]) => ({ ...acc, [k]: fn(v) }), {} as { [k in keyof R]: Result })
}

type ish<V extends {}> = { [k in keyof V]: V[k] | undefined }
type Client = {
    low: Set<string>
    high: Set<string>
    notify: undefined | ((cacheKey: string) => void)
}
type loHiChunk = Chunk & { priority: 'low' | 'high' }
export class FancySharedCache {
    private cache: PriorityCacheWarmer;
    private clients: Record<string, Client>
    private importance: Record<string, number>
    constructor(store: Store<string, Resource>, limitInBytes: number, max_concurrent_fetches: number = 10) {
        this.importance = {}
        this.clients = {}
        this.cache = new PriorityCacheWarmer(store, limitInBytes, max_concurrent_fetches, (ck) => this.onCacheEntryArrived(ck))
    }
    registerClient<Key, Value extends Record<string, Resource>>(spec: ClientSpec<Key, Value>): CacheInterface<Key, Value> {
        const id = uniqueId('client')
        this.clients[id] = { low: new Set(), high: new Set(), notify: spec.onDataArrived }

        const makeCacheEntries = (item: Key) => {
            const keys = spec.cacheKeys(item) as Record<string, string>
            const fetchers = spec.fetch(item)
            return Object.keys(fetchers).reduce((acc, sk) => ({ ...acc, [sk]: { cacheKey: keys[sk], fetch: fetchers[sk] } }), {} as Record<string, Chunk>)
        }
        const setPriorities = (low: Set<Key>, high: Set<Key>) => {
            const client = this.clients[id]
            const wasLow = (k: string) => client.low.has(k)
            const wasHigh = (k: string) => client.high.has(k)
            const newToMe = (k: string) => !wasLow(k) && !wasHigh(k)
            const newLow = new Set<string>()
            const newHigh = new Set<string>()
            //TODO: 2 pairs of duplicate(ish) loops - DRY me up!
            for (const lo of low) {
                const entries = makeCacheEntries(lo)
                for (const sk in entries) {
                    const entry = entries[sk]!
                    newLow.add(entry.cacheKey)
                    if (newToMe(entry.cacheKey)) {
                        this.cache.addPriority(entry);
                        this.updateImportance(entry.cacheKey, 1)
                    } else if (wasHigh(entry.cacheKey)) {
                        this.updateImportance(entry.cacheKey, -1)
                    }
                }
            }

            for (const hi of high) {
                const entries = makeCacheEntries(hi)
                for (const sk in entries) {
                    const entry = entries[sk]!
                    newHigh.add(entry.cacheKey)
                    if (newToMe(entry.cacheKey)) {
                        this.cache.addPriority(entry);
                        this.updateImportance(entry.cacheKey, 2)
                    } else if (wasLow(entry.cacheKey)) {
                        this.updateImportance(entry.cacheKey, 1)
                    }
                }
            }
            for (const old of client.low) {
                if (!newLow.has(old) && !newHigh.has(old)) {
                    this.updateImportance(old, -1)
                }
            }
            for (const old of client.high) {
                if (!newLow.has(old) && !newHigh.has(old)) {
                    this.updateImportance(old, -2)
                }
            }
            client.low = newLow
            client.high = newHigh
            this.cache.reprioritize((ck) => this.importance[ck] ?? 0)
        }
        return {
            get: (k: Key) => {
                const keys = spec.cacheKeys(k)
                const v = mapFields<Record<string, string>, Resource | undefined>(keys, (k) => this.cache.get(k))
                return spec.isValue(v) ? v : undefined
            },
            has: (k: Key) => {
                const atLeastOneMissing = Object.values(spec.cacheKeys(k)).some(ck => !this.cache.has(ck))
                return !atLeastOneMissing;
            },

            unsubscribeFromCache: () => {
                setPriorities(new Set(), new Set()) // mark that this client has no priorities, which will decrement the counts for all
                // priorities it used to have
                delete this.clients[id]
            },
            setPriorities
        }
    }
    private onCacheEntryArrived(key: string) {
        // find any clients that want this... 
        // and notify them
        for (const cid of Object.keys(this.clients)) {
            const client = this.clients[cid]
            if (client.high.has(key) || client.low.has(key)) {
                client.notify?.(key)
            }
        }
    }
    private updateImportance(key: string, delta: number) {
        this.importance[key] = Math.max(0, (this.importance[key] ?? 0) + delta);

    }


}



