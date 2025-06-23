
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
    // private priorityItems: Map<CacheKey, number>
    private MAX_INFLIGHT_FETCHES: number;
    constructor(store: Store<string, Resource>, limitInBytes: number, maxConcurrentFetches: number) {
        this.MAX_INFLIGHT_FETCHES = Math.max(1, maxConcurrentFetches)
        this.cache = new PriorityCache(store, (k: CacheKey) => 0, limitInBytes);
        // we want items with a high score to be fetched first
        // so we negate the scores here, because minheaps are designed to quickly give the minimum item
        this.fetchQueue = new MinHeap<Chunk>(5000, (k: Chunk) => 0)
        this.pendingFetches = new Map();
        this.priorities = new Set();
    }
    // this would be fine, but it forces us to re-prioritize globally, over all priorities
    // it would be better if we could prioritize just a little at a time... sort of
    // reprioritize(priorities: ReadonlySet<Chunk>, score: (ck: CacheKey) => number) {
    //     const keys = this.pendingFetches.keys()
    //     const fetchScore = (cnk: Chunk) => -score(cnk.cacheKey)
    //     for (const key of keys) {
    //         if (score(key) === 0) {
    //             this.cancelPending(key)
    //         }
    //     }
    //     for (const pri of priorities) {
    //         if (!this.priorities.has(pri)) {
    //             this.fetchQueue.addItem(pri, fetchScore(pri))
    //         }
    //     }
    //     this.priorities = priorities
    //     this.fetchQueue.rebuild(fetchScore)
    //     this.cache.reprioritize(score)
    // }
    addPriority(chunk: Chunk) {
        if (!this.priorities.has(chunk.cacheKey)) {
            this.fetchQueue.addItem(chunk)
        }
        this.priorities.add(chunk.cacheKey)
    }
    reprioritize(score: (ck: CacheKey) => number) {
        this.cache.reprioritize(score)
        // cancel de-prioritized fetches
        for (const [key, _pending] of this.pendingFetches) {
            if (score(key) === 0) {
                this.cancelPending(key)
            }
        }
        this.saturateFetchQuota();
    }
    //     const newPriorities = new Map<CacheKey, number>();
    //     for (const item of priorities) {
    //         const { cacheKey, priority } = item
    //         if (!this.priorityItems.has(cacheKey)) {
    //             this.fetchQueue.addItem(item)
    //         }
    //         newPriorities.set(cacheKey, priority)
    //     }
    //     for (const old of this.priorityItems.keys()) {
    //         if (!(old in priorities)) {
    //             // we dont care about this anymore - cancel it if its in progress!
    //             // no need to remove it from the fetch queue - its score=0 will take care of the issue
    //             if (this.pendingFetches.has(old)) {
    //                 this.cancelPending(old);
    //             }
    //         }
    //     }
    //     // update all the scores...
    //     this.priorityItems = newPriorities;
    //     this.cache.reprioritize();
    // }
    // add(chunk: Chunk, score: number) {
    //     const { cacheKey } = chunk
    //     const isNew = !this.priorityItems.has(cacheKey)
    //     this.priorityItems.set(cacheKey, score)
    //     if (isNew) {
    //         this.fetchQueue.addItem(chunk)
    //     }
    // }
    // drop(cacheKey: CacheKey, score: number) {
    //     this.priorityItems.set(cacheKey, score)
    // }
    // rebuild() {
    //     // check pending things, cancel them if they have a score of zero
    //     const keys = this.pendingFetches.keys()
    //     for (const key of keys) {
    //         if (this.score(key) === 0) {
    //             this.cancelPending(key)
    //         }
    //     }
    //     this.cache.reprioritize();
    // }

    // higher number = more important
    // private score(k: CacheKey): number {
    //     return this.priorityItems.get(k) ?? 0
    // }

    private cancelPending(item: CacheKey) {
        this.pendingFetches.get(item)?.abort('cancelled')
        this.pendingFetches.delete(item);
    }
    private saturateFetchQuota() {
        if (this.pendingFetches.size > this.MAX_INFLIGHT_FETCHES) {
            console.log('dont fetch, pending queue full')
            return;
        }
        let fetchMe = this.fetchQueue.popMinItemWithScore();
        while (fetchMe !== null && (fetchMe.score === 0 || this.cache.has(fetchMe.item.cacheKey))) {
            // dont bother fetching if we have it, or its priority is 0
            fetchMe = this.fetchQueue.popMinItemWithScore()
        }
        if (fetchMe) {
            const chunk = fetchMe.item
            const abort = new AbortController();
            this.pendingFetches.set(chunk.cacheKey, abort)
            chunk.fetch(abort.signal).then((value) => {
                this.cache.put(chunk.cacheKey, value)
            }).finally(() => {
                this.pendingFetches.delete(chunk.cacheKey)
                this.saturateFetchQuota()
            })
        } // else nothing to fetch

        this.saturateFetchQuota();
    }
    get(key: CacheKey) {
        return this.cache.get(key);
    }
    has(key: CacheKey) {
        return this.cache.has(key);
    }
}