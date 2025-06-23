import { uniqueId } from 'lodash'
import { MinHeap } from './min-heap'
/*
we want to cache things
the things have the annoying property that they are accessed in groups
so item A refers to cacheable things a,b,c
and item B might refer to cacheable things b,c,d
we could try and cache groups, but that would lead to duplication
it would be great to not evict item b to make room for item d,
because we can only use item d if we also have b!

can we use a priority cache secretly within our priority cache? hrm...
*/

export interface Store<K extends {}, V extends {}> {
    put(k: K, v: V): void;
    get(k: K): V | undefined;
    has(k: K): boolean
    evict(k: K): void;
    keys(): Iterable<K>
    values(): Iterable<V>
}
type ObjectValue<T extends {}> = T extends Record<string, infer Value> ? Value : never;
type PromisesFor<T extends {}> = { [k in keyof T]: () => Promise<T[k]> }
export type CacheClient<Item, V extends Record<string, Resource>> = {
    isKey(item: unknown)=> item is Item;
    cacheKeys: (item: Item) => { [k in keyof V]: string }
    estimatedSize: (k: Item) => number;
    fetch: (k: Item, signal?: AbortSignal) => PromisesFor<V>
    isValid: (v: unknown) => v is V
    onItemArrived: (k: Item, v: V) => void
}
interface Resource {
    destroy?: () => void;
    sizeInBytes: () => number
}
// just check:
type Fake = {
    color: Float32Array
    pos: Uint16Array
}
type proms = PromisesFor<Fake>
type what = ObjectValue<Fake>
/**
 * important: this is a cache, the priorities of which will lead to a poor experience,
 * IF you need a working set of data larger than the cache limit, regardless of the number of clients.
 * the idea is this cache is a tool for several clients, each of which needs only a small portion of an
 * out-of-core (READ: too big to have it all) dataset at a time - just enough to fulfill a view per client.
 * 
 * note also - clients of the cache are concerned with "Items" or chunks of data - however this cache
 * is concerned with resources - a chunk may be comprised of many resources!
 */

// just some type aliases for clarity:
type ClientId = string
type CacheKey = string
type OpaqueChunk = {} // its an object, its not null, thats all we know
export class FancyCache<V extends Record<string, Resource>> {
    private store: Store<CacheKey, Resource>
    private limit: number;
    private used: number;
    private estimatedWorkingSetSize: number
    private clients: Record<string, { client: CacheClient<OpaqueChunk, V>, priorities: Set<OpaqueChunk> }>
    private reqCounts: Map<CacheKey, number>
    private evictPriority: MinHeap<CacheKey>
    private fetchPriority: MinHeap<CacheKey>
    private pendingFetches: Map<CacheKey, AbortController>;
    private MAX_INFLIGHT_FETCHES: number
    constructor(store: Store<CacheKey, Resource>, cacheLimit: number) {
        this.store = store;
        // this.meta = management;
        this.limit = cacheLimit
        this.MAX_INFLIGHT_FETCHES = 3
        this.estimatedWorkingSetSize = 0
        this.used = 0;
        this.clients = {}
        this.reqCounts = new Map<CacheKey, number>();
        // TODO: consider replacing two min-heaps with a single Min-Max heap: https://en.wikipedia.org/wiki/Min-max_heap#Build
        this.evictPriority = new MinHeap<CacheKey>(5000, (k: CacheKey) => this.evictScore(k))
        this.fetchPriority = new MinHeap<CacheKey>(5000, (k: CacheKey) => this.fetchScore(k))
        this.pendingFetches = new Map<CacheKey, AbortController>();
    }
    registerClient<CC extends CacheClient<OpaqueChunk, V>>(client: CC): string {
        const id = uniqueId('client_')
        this.clients[id] = { client: client, priorities: new Set<OpaqueChunk>() };
        return id
    }
    cancelClient(id: ClientId) {
        this.setPriorities(id, new Set<OpaqueChunk>()) // mark the client as requiring nothing
        delete this.clients[id] // now its safe to delete
    }
    private evictScore(k: CacheKey) {
        return this.reqCounts.get(k) ?? 0
    }
    private fetchScore(k: CacheKey) {
        return -(this.reqCounts.get(k) ?? 0)
    }
    // let the priority system know what keys this client will try to use
    // during rendering.
    // return 'backoff' if the estimated size of all priorities for all clients
    // would be above the cache size limit, indicating that clients should consider
    // rendering at lower quality if possible
    setPriorities<K>(client: ClientId, priorities: Set<K>) {
        this.onPriorityChange<K>(client, priorities)
        this.fetchNext()
        return this.estimatedWorkingSetSize > this.limit ? 'backoff' : 'ok'
    }
    // todo: rework to support chunk=>cacheKeys[]
    private prioritizeItem(item: OpaqueChunk, itemValue: number, oldPriorities: Set<K>, newPriorities: Set<K>) {
        const prevCount = this.reqCounts.get(item) ?? 0
        if (!oldPriorities.has(item)) {
            // item is "new"
            this.reqCounts.set(item, prevCount + itemValue)
            if (prevCount === 0 && !this.store.has(item)) {
                // never seen before!
                this.estimatedWorkingSetSize += this.meta.estimatedSize(item)
                this.fetchPriority.addItem(item)
            }
        } else if (!newPriorities.has(item)) {
            // item is an orphan
            const count = Math.max(0, prevCount - itemValue)
            this.reqCounts.set(item, count)
            if (this.pendingFetches.has(item) && count === 0) {
                // cancel this pending fetch!
                this.estimatedWorkingSetSize -= this.meta.estimatedSize(item)
                console.log('cancel: ', item)
                this.cancelPending(item)
            }
        }
    }
    private onPriorityChange<K>(clientId: ClientId, priorities: Set<K>) {
        if (!this.clients[clientId]) {
            return;
        }
        const client = this.clients[clientId]
        const old = client.priorities
        // orphans are in old but not in priorities
        // newItems are in priorities but not in old
        const U = new Set<K>(old)
        for (const p of priorities) {
            U.add(p)
        }
        for (const item of U) {
            this.prioritizeItem(item, 1, old, priorities)
            // else: item is in both old and new, so do nothing
        }
        this.clients[client].priorities = priorities;
        this.evictPriority.rebuild();
        this.fetchPriority.rebuild();

    }
    private cancelPending(k: K) {
        this.pendingFetches.get(k)?.abort('cancelled')
        this.pendingFetches.delete(k);
    }

    private notifyClients(item: K) {
        // signal all clients that have item in their priority set
        for (const id in this.clients) {
            const client = this.clients[id]
            if (client.priorities.has(item)) {
                const v = this.store.get(item)
                if (v) {
                    client.callback(item, v)
                }
            }
        }
    }
    private fetchNext() {
        if (this.pendingFetches.size > this.MAX_INFLIGHT_FETCHES) {
            console.log('dont fetch, pending queue full')
            return;
        }
        let fetchMe = this.fetchPriority.popMinItem();
        while (fetchMe !== null && (this.evictScore(fetchMe) === 0 || this.store.has(fetchMe))) {
            // move on if:
            // the thing we popped is already cached, or its score is zero
            console.log('skip fetch', fetchMe, this.evictScore(fetchMe), this.store.has(fetchMe) ? '(already cached)' : '')
            fetchMe = this.fetchPriority.popMinItem();
        }
        if (fetchMe) {
            // begin the fetch!
            const abort = new AbortController();
            this.pendingFetches.set(fetchMe, abort)
            this.meta.fetch(fetchMe, abort.signal).then((v) => {
                this.store.put(fetchMe, v);
                this.notifyClients(fetchMe);
                this.used += this.meta.size(v)
                if (this.used > this.limit) {
                    this.evictToReachLimit()
                }
                this.evictPriority.addItem(fetchMe) // now that its here, we can evict it...

            }).catch((err) => {
                // TODO think more, but also ignore cancellations
            }).finally(() => {
                // no matter what, keep that fetch queue running!
                this.pendingFetches.delete(fetchMe);
                this.fetchNext()
            })
            this.fetchNext()
        }
    }
    private evictToReachLimit() {
        while (this.used > this.limit) {
            const deleted = this.evictOnce() // I mutate this.used (and other stuff of course)
            if (deleted === undefined) {
                // the evict heap is empty - we cant go further!
                break;
            }
        }
    }
    private evictOnce() {
        let evictMe = this.evictPriority.popMinItem()
        while (evictMe !== null && !this.store.has(evictMe)) {
            evictMe = this.evictPriority.popMinItem()
        }
        if (evictMe) {
            const data = this.store.get(evictMe)
            if (data) {
                const s = this.meta.size(data)
                this.meta.destroy(data)
                this.store.evict(evictMe);
                this.used = Math.max(0, (this.used - s))
                return s;
            } // else should be unreachable...
        }
        return undefined
    }
    // ok, the easy part -
    get(k: K) {
        return this.store.get(k)
    }
    has(k: K) {
        return this.store.has(k)
    }

}