
// a thing that owns a cache, and fetches content to put in the cache (warms it)
// based on priorities

import { MinHeap } from "./min-heap";
import { PriorityCache, type Resource, type Store } from "./pcache";
type CacheKey = string;
export type Chunk = {
    fetch: (signal: AbortSignal) => Promise<Resource>
    cacheKey: CacheKey;
}
export class PriorityCacheWarmer {
    private cache: PriorityCache;
    private fetchQueue: MinHeap<Chunk>
    private priorities: Set<CacheKey>
    private pendingFetches: Map<CacheKey, AbortController>;
    private _score: (c: CacheKey) => number
    private notifyOwner: undefined | ((c: CacheKey) => void)
    // private priorityItems: Map<CacheKey, number>
    private MAX_INFLIGHT_FETCHES: number;
    constructor(store: Store<string, Resource>, limitInBytes: number, maxConcurrentFetches: number, onDataArrived?: (k: CacheKey) => void) {
        this.MAX_INFLIGHT_FETCHES = Math.max(1, maxConcurrentFetches)
        this.cache = new PriorityCache(store, (k: CacheKey) => 0, limitInBytes);
        // we want items with a high score to be fetched first
        // so we negate the scores here, because minheaps are designed to quickly give the minimum item
        this.fetchQueue = new MinHeap<Chunk>(5000, ((k: Chunk) => this.score(k.cacheKey)))
        this.pendingFetches = new Map();
        this.priorities = new Set();
        this._score = () => 0
        this.notifyOwner = onDataArrived
    }

    addPriority(chunk: Chunk) {
        if (!this.priorities.has(chunk.cacheKey) && !this.cache.has(chunk.cacheKey)) {
            this.fetchQueue.addItem(chunk)
        }

        this.priorities.add(chunk.cacheKey)
    }
    private score(k: CacheKey): number {
        return this._score(k)
    }
    reprioritize(score: (ck: CacheKey) => number) {
        this._score = score
        this.cache.reprioritize(score)
        // cancel de-prioritized fetches
        for (const [key, _pending] of this.pendingFetches) {
            if (score(key) === 0) {
                this.cancelPending(key)
            }
        }
        this.saturateFetchQuota();
    }

    private popNextItem() {
        const fetchme = this.fetchQueue.popMinItemWithScore()
        if (fetchme) {
            this.priorities.delete(fetchme.item.cacheKey)
            return fetchme
        }
        return null;
    }

    private cancelPending(item: CacheKey) {
        this.pendingFetches.get(item)?.abort('cancelled')
        this.pendingFetches.delete(item);
    }
    private saturateFetchQuota() {
        if (this.pendingFetches.size > this.MAX_INFLIGHT_FETCHES) {
            console.log('dont fetch, pending queue full')
            return;
        }
        let fetchMe = this.popNextItem()
        while (fetchMe !== null && (fetchMe.score === 0 || this.cache.has(fetchMe.item.cacheKey))) {
            // dont bother fetching if we have it, or its priority is 0
            fetchMe = this.popNextItem()
        }
        if (fetchMe) {
            const chunk = fetchMe.item
            const abort = new AbortController();
            this.pendingFetches.set(chunk.cacheKey, abort)
            chunk.fetch(abort.signal).then((value) => {
                console.log('got ', fetchMe.item.cacheKey)
                this.cache.put(chunk.cacheKey, value)
            }).finally(() => {
                this.pendingFetches.delete(chunk.cacheKey)
                this.notifyOwner?.(chunk.cacheKey)
                this.saturateFetchQuota()
            })
            this.saturateFetchQuota();
        } // else nothing to fetch


    }
    get(key: CacheKey) {
        return this.cache.get(key);
    }
    has(key: CacheKey) {
        return this.cache.has(key);
    }
}