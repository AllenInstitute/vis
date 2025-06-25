import * as lo from 'lodash' // vite/astro went bonkers - not sure why this helps, core has always had lodash in it...
import { PriorityCache, type Store, type Resource } from "./priority-cache";
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
type Fetcher = (sig: AbortSignal) => Promise<Resource>

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

type Client = {
    low: Set<string>
    high: Set<string>
    notify: undefined | ((cacheKey: string) => void)
}
export class FancySharedCache {
    private cache: PriorityCache;
    private clients: Record<string, Client>
    private importance: Record<string, number>
    constructor(store: Store<string, Resource>, limitInBytes: number, max_concurrent_fetches: number = 10) {
        this.importance = {}
        this.clients = {}
        this.cache = new PriorityCache(store, (ck) => this.importance[ck] ?? 0, limitInBytes, max_concurrent_fetches, (ck) => this.onCacheEntryArrived(ck))
    }
    registerClient<Key, Value extends Record<string, Resource>>(spec: ClientSpec<Key, Value>): CacheInterface<Key, Value> {
        const id = uniqueId('client')
        this.clients[id] = { low: new Set(), high: new Set(), notify: spec.onDataArrived }

        const makeCacheEntries = (item: Key) => {
            const keys = spec.cacheKeys(item) as Record<string, string>
            const fetchers = spec.fetch(item)
            return Object.keys(keys).map((sk) => ({ cacheKey: keys[sk], fetcher: fetchers[sk] }))
        }

        const priorityDelta = (key: string, pri: 0 | 1 | 2, low: Set<string>, high: Set<string>) => {
            return pri - (high.has(key) ? 2 : (low.has(key) ? 1 : 0))
        }
        const setPriorities = (low: Set<Key>, high: Set<Key>) => {
            const newLow = new Set<string>()
            const newHigh = new Set<string>()
            const toEnqueue = new Map<string, Fetcher>()
            const client = this.clients[id]
            const handlePriorityCategory = (pri: 1 | 2, cat: Set<string>, low: Set<string>, high: Set<string>) => {
                return (item: Key) => {
                    makeCacheEntries(item).forEach(({ cacheKey, fetcher }) => {
                        const delta = priorityDelta(cacheKey, pri, low, high)
                        cat.add(cacheKey)
                        this.updateImportance(cacheKey, delta)
                        if (!this.cache.cachedOrPending(cacheKey)) {
                            toEnqueue.set(cacheKey, fetcher)
                        }
                    })
                }
            }
            const handleOldPriority = (pri: 1 | 2) => {
                return (ck: string) => {
                    const isOrphan = !newHigh.has(ck) && !newLow.has(ck)
                    // if its not an orphan, our delta-math has already been done, and we'd be double counting
                    if (isOrphan) {
                        this.updateImportance(ck, -pri)
                    }
                }
            }
            high.forEach(handlePriorityCategory(2, newHigh, client.low, client.high))
            low.forEach(handlePriorityCategory(1, newLow, client.low, client.high))
            client.low.forEach(handleOldPriority(1))
            client.high.forEach(handleOldPriority(2))
            client.low = newLow
            client.high = newHigh
            this.cache.reprioritize((ck) => this.importance[ck] ?? 0)
            // this is why this function is convoluted - its desirable to recompute
            // the complete set of scores (importance values) before calling enqueue
            // otherwise, we could easily start fetching a lot of things that were important but now are not!
            toEnqueue.forEach((f, k) => {
                // note: enqueue is harmless for items that are already cached or enqueued
                this.cache.enqueue(k, f);
            })
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



