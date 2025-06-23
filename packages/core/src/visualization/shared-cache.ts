import { uniqueId } from "lodash";
import { type Chunk, PriorityCacheWarmer } from "./cache-warmer";
import type { Resource, Store } from "./pcache";



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
    fetch: (item: Key) => { [k in keyof Value]: (abort: AbortSignal) => Promise<Resource> }
}
type ObjectValue<T extends Record<string, any>> = T extends Record<string, infer Value> ? Value : never;
type wtf = {
    fish: number;
    cats: string
}
type hey = ObjectValue<wtf>
type wat = KV<wtf>
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
    items: Set<Chunk>
}
type loHiChunk = Chunk & { priority: 'low' | 'high' }
export class FancySharedCache {
    private cache: PriorityCacheWarmer;
    private clients: Record<string, Client>
    private importance: Record<string, number>
    constructor(store: Store<string, Resource>, limitInBytes: number, max_concurrent_fetches: number = 10) {
        this.importance = {}
        this.clients = {}
        this.cache = new PriorityCacheWarmer(store, limitInBytes, max_concurrent_fetches)
    }

    registerClient<Key, Value extends Record<string, Resource>>(spec: ClientSpec<Key, Value>): CacheInterface<Key, Value> {
        const id = uniqueId('client')
        this.clients[id] = { low: new Set(), high: new Set(), items: new Set() }
        // const makeCacheEntries = (item: Key) => {
        //     const keys = spec.cacheKeys(item)
        //     const fetchers = spec.fetch(item)
        //     return entries(keys).map(([sk, ck]) => ({ cacheKey: ck as string, fetch: fetchers[sk] }))
        // }
        const makeCacheEntries = (item: Key) => {
            const keys = spec.cacheKeys(item) as Record<string, string>
            const fetchers = spec.fetch(item)
            return Object.values(keys).reduce((acc, ck) => ({ ...acc, [ck]: { cacheKey: ck, fetch: fetchers[ck] } }), {} as Record<string, Chunk>)
        }
        const setPriorities = (low: Set<Key>, high: Set<Key>) => {
            const client = this.clients[id]
            const wasLow = (k: string) => client.low.has(k)
            const wasHigh = (k: string) => client.high.has(k)
            const newToMe = (k: string) => !wasLow(k) && !wasHigh(k)
            const flatPriorities = new Set<string>
            //TODO: 2 pairs of duplicate(ish) loops - DRY me up!
            for (const lo of low) {
                const entries = makeCacheEntries(lo)
                for (const ck in entries) {
                    const entry = entries[ck]!
                    flatPriorities.add(entry.cacheKey)

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
                for (const ck in entries) {
                    const entry = entries[ck]!
                    flatPriorities.add(entry.cacheKey)

                    if (newToMe(entry.cacheKey)) {
                        this.cache.addPriority(entry);
                        this.updateImportance(entry.cacheKey, 2)
                    } else if (wasLow(entry.cacheKey)) {
                        this.updateImportance(entry.cacheKey, 1)
                    }
                }
            }
            for (const old of client.low) {
                if (!flatPriorities.has(old)) {
                    this.updateImportance(old, -1)
                }
            }
            for (const old of client.high) {
                if (!flatPriorities.has(old)) {
                    this.updateImportance(old, -2)
                }
            }
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
    private updateImportance(key: string, delta: number) {
        this.importance[key] = Math.max(0, (this.importance[key] ?? 0) + delta);

    }
    // private updatePriorityMap(id: string, priorities: Record<string, loHiChunk>) {
    //     // update the global counts given new priorities
    //     const client = this.clients[id]
    //     if (!client) return
    //     const other = (pri: 'low' | 'high') => pri === 'low' ? 'high' : 'low'
    //     const priPoints = (pri: 'low' | 'high') => pri === 'low' ? 1 : 2
    //     client.items.clear()
    //     for (const entry of Object.values(priorities)) {
    //         const { cacheKey, priority } = entry
    //         client.items.add(entry)
    //         const points = priPoints(priority)
    //         if (client[other(priority)].has(cacheKey)) {
    //             // it changed categories
    //             this.updateImportance(cacheKey, -priPoints(other(priority)))
    //         }
    //         if (!client[priority].has(cacheKey)) {
    //             // its new to this category
    //             client[priority].add(cacheKey)
    //             this.updateImportance(cacheKey, points)
    //         }
    //     }
    //     // now, find things for this client that are no longer important
    //     for (const cacheKey of client.low) {
    //         if (!(cacheKey in priorities)) {
    //             this.updateImportance(cacheKey, -priPoints('low'))
    //             // the internet says this is fine and will work!
    //             client.low.delete(cacheKey)
    //         }
    //     }
    //     for (const cacheKey of client.high) {
    //         if (!(cacheKey in priorities)) {
    //             this.updateImportance(cacheKey, -priPoints('high'))
    //             client.high.delete(cacheKey)
    //         }
    //     }
    //     this.reprioritizeEverything()
    // }

}



