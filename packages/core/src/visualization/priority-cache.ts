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

export type CacheClient<Item, V extends {}> = {
    size: (v: ObjectValue<V>) => number;
    cacheKeys: (item: Item) => { [k in keyof V]: string }
    estimatedSize: (k: Item) => number;
    destroy: (v: ObjectValue<V>) => void;
    fetch: (k: Item, signal?: AbortSignal) => { [k in keyof V]: ObjectValue<V> }
    isValid: (v: unknown) => v is V
    onItemArrived: (k: Item, v: V) => void
}
/**
 * important: this is a cache, the priorities of which will lead to a poor experience,
 * IF you need a working set of data larger than the cache limit, regardless of the number of clients.
 * the idea is this cache is a tool for several clients, each of which needs only a small portion of an
 * out-of-core (READ: too big to have it all) dataset at a time - just enough to fulfill a view per client.
 */
export class FancyCache<K extends {}, V extends {}> {
    private store: Store<K, V>
    // private meta: CacheClient<K, V>
    private limit: number;
    private used: number;
    private estimatedWorkingSetSize: number
    private clients: Record<string, { client: CacheClient<any, any, string>, priorities: Set<K> }>
    private reqCounts: Map<K, number>
    private evictPriority: MinHeap<K>
    private fetchPriority: MinHeap<K>
    private pendingFetches: Map<K, AbortController>;
    private MAX_INFLIGHT_FETCHES: number
    constructor(store: Store<K, V>, cacheLimit: number) {
        this.store = store;
        // this.meta = management;
        this.limit = cacheLimit
        this.MAX_INFLIGHT_FETCHES = 3
        this.estimatedWorkingSetSize = 0
        this.used = 0;
        this.clients = {}
        this.reqCounts = new Map<K, number>();
        // TODO: consider replacing two min-heaps with a single Min-Max heap: https://en.wikipedia.org/wiki/Min-max_heap#Build
        this.evictPriority = new MinHeap<K>(5000, (k: K) => this.evictScore(k))
        this.fetchPriority = new MinHeap<K>(5000, (k: K) => this.fetchScore(k))
        this.pendingFetches = new Map<K, AbortController>();
    }
    registerClient<Item extends K, Value extends V, CK extends string>(client: CacheClient<Item, Value, CK>): string {
        const id = uniqueId('client_')
        this.clients[id] = { client: client, priorities: new Set<K>() };
        return id
    }
    cancelClient(id: string) {
        this.setPriorities(id, new Set<K>()) // mark the client as requiring nothing
        delete this.clients[id] // now its safe to delete
    }
    private evictScore(k: K) {
        return this.reqCounts.get(k) ?? 0
    }
    private fetchScore(k: K) {
        return -(this.reqCounts.get(k) ?? 0)
    }
    // let the priority system know what keys this client will try to use
    // during rendering.
    // return 'backoff' if the estimated size of all priorities for all clients
    // would be above the cache size limit, indicating that clients should consider
    // rendering at lower quality if possible
    setPriorities(client: string, priorities: Set<K>) {
        this.onPriorityChange(client, priorities)
        this.fetchNext()
        return this.estimatedWorkingSetSize > this.limit ? 'backoff' : 'ok'
    }
    private prioritizeItem(item: K, itemValue: number, oldPriorities: Set<K>, newPriorities: Set<K>) {
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
    private onPriorityChange(client: string, priorities: Set<K>) {
        if (!this.clients[client]) {
            return;
        }
        const old = this.clients[client].priorities
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