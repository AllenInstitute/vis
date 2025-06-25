import { uniqueId } from 'lodash'
import { MinHeap } from './min-heap'
import { KeyedMinHeap } from './keyed-heap';

type CacheKey = string;
export interface Resource {
    destroy?: () => void;
    sizeInBytes: () => number
}
export interface Store<K extends {}, V extends {}> {
    set(k: K, v: V): void;
    get(k: K): V | undefined;
    has(k: K): boolean
    delete(k: K): void;
    keys(): Iterable<K>
    values(): Iterable<V>
}
type PendingResource = {
    key: CacheKey
    fetch: (sig: AbortSignal) => Promise<Resource>
}

function negate(fn: (k: CacheKey) => number) {
    return (k: CacheKey) => -fn(k)
}
export class PriorityCache {
    private store: Store<CacheKey, Resource>
    private evictPriority: MinHeap<CacheKey>
    private fetchPriority: KeyedMinHeap<PendingResource, CacheKey>
    private pendingFetches: Map<CacheKey, AbortController>;
    private limit: number;
    private used: number;
    private MAX_INFLIGHT_FETCHES: number
    private notify: undefined | ((k: CacheKey) => void)
    // items with lower scores will be evicted before items with high scores
    constructor(store: Store<CacheKey, Resource>, score: (k: CacheKey) => number, limitInBytes: number, maxFetches: number, onDataArrived?: (key: CacheKey) => void) {
        this.store = store;
        this.evictPriority = new MinHeap<CacheKey>(5000, score)
        this.fetchPriority = new KeyedMinHeap<PendingResource, CacheKey>(5000, negate(score), (pr) => pr.key)
        this.limit = limitInBytes
        this.pendingFetches = new Map();
        this.used = 0;
        this.MAX_INFLIGHT_FETCHES = maxFetches
        this.notify = onDataArrived
    }
    // add {key:item} to the cache - return false (and fail) if the key is already present
    // may evict items to make room
    // return true on success
    put(key: CacheKey, item: Resource): boolean {
        if (this.store.has(key)) {
            return false;
        }
        const size = item.sizeInBytes?.() ?? 1
        if (this.used + size > this.limit) {
            this.evictUntil(Math.max(0, this.limit - size))
        }
        this.evictPriority.addItem(key);
        this.store.set(key, item);
        this.used += size;
        return true;
    }
    enqueue(key: CacheKey, fetcher: (abort: AbortSignal) => Promise<Resource>) {
        // enqueue the item, if we dont already have it, or are not already asking
        if (!this.has(key) && !this.pendingFetches.has(key) && !this.fetchPriority.hasItemWithKey(key)) {
            this.fetchPriority.addItem({ key, fetch: fetcher })
            this.fetchToLimit();
            return true;
        }
        return false;
    }
    private beginFetch({ key, fetch }: PendingResource) {
        const abort = new AbortController()
        this.pendingFetches.set(key, abort)
        return fetch(abort.signal).then((resource) => {
            this.put(key, resource)
        }).catch((_reason) => {
            //ignore
        })
            .finally(() => {
                this.pendingFetches.delete(key)
                this.fetchToLimit();
            })
            .then(() => this.notify?.(key))
    }
    private fetchToLimit() {
        let toFetch = Math.max(0, this.MAX_INFLIGHT_FETCHES - this.pendingFetches.size)
        for (let i = 0; i < toFetch; i++) {
            const fetchMe = this.fetchPriority.popMinItemWithScore()
            if (fetchMe !== null) {
                if (fetchMe.score !== 0) {
                    this.beginFetch(fetchMe.item)
                } else {
                    console.log('skip fetching: ', fetchMe.item.key)
                    toFetch += 1 // increasing the loop limit inside the loop... a bit sketchy
                }
            } else {
                // if we hit a null, we can stop early - the fetch queue is empty
                break;
            }
        }
    }

    // it is expected that the score function is not "pure" - 
    // it has a closure over data that changes over time, representing changing priorities
    // thus - the owner of this cache has a responsibility to notify the cache when significant
    // changes in priority occur!
    reprioritize(score: (k: CacheKey) => number) {
        this.evictPriority.rebuild(score)
        this.fetchPriority.rebuild(negate(score))
        for (const [key, abort] of this.pendingFetches) {
            if (score(key) === 0) {
                console.log('abort: ', key)
                abort.abort()
                this.pendingFetches.delete(key)
            }
        }
    }
    get(key: CacheKey): Resource | undefined {
        return this.store.get(key)
    }

    has(key: CacheKey): boolean {
        return this.store.has(key)
    }
    cachedOrPending(key: CacheKey): boolean {
        return this.store.has(key) || this.fetchPriority.hasItemWithKey(key) || this.pendingFetches.has(key)
    }
    isFull(): boolean {
        return this.used >= this.limit
    }
    private evictLowestPriority() {
        let evictMe = this.evictPriority.popMinItem()
        if (evictMe === null) return false;

        const data = this.store.get(evictMe)
        if (data) {
            data.destroy?.();
            this.store.delete(evictMe)
            this.used -= data.sizeInBytes?.() ?? 1
        }
        return true;
    }
    private evictUntil(targetUsedBytes: number) {
        while (this.used > targetUsedBytes) {
            if (!this.evictLowestPriority()) { // note: evictLowestPriority mutates this.used
                return; // all items evicted...
            }
        }
    }

}