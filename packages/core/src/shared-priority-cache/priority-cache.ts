import { MinHeap } from './min-heap';
import { KeyedMinHeap } from './keyed-heap';

type CacheKey = string;
export interface Cacheable {
    destroy?: () => void;
    sizeInBytes: () => number;
}

export interface Store<K extends {}, V> {
    set(k: K, v: V): void;
    get(k: K): V | undefined;
    has(k: K): boolean;
    delete(k: K): void;
    keys(): Iterable<K>;
    values(): Iterable<V>;
}

export type ScoreFn = (k: CacheKey) => number;

type PendingCacheable<T extends Cacheable> = {
    key: CacheKey;
    fetch: (sig: AbortSignal) => Promise<T>;
};

function negate(fn: ScoreFn) {
    return (k: CacheKey) => -fn(k);
}

export type FetchResult = { status: 'success' } | { status: 'failure'; reason: unknown };

export class PriorityCache<T extends Cacheable> {
    #store: Store<CacheKey, T>;
    #evictPriority: MinHeap<CacheKey>;
    #limit: number;
    #used: number;
    #score: ScoreFn;

    // items with lower scores will be evicted before items with high scores
    constructor(store: Store<CacheKey, T>, score: ScoreFn, limitInBytes: number) {
        this.#store = store;
        this.#score = score;
        this.#evictPriority = new MinHeap<CacheKey>(5000, score);
        this.#limit = limitInBytes;
        this.#used = 0;
    }

    protected get score(): ScoreFn {
        return this.#score;
    }

    // add {key:item} to the cache - return false (and fail) if the key is already present
    // may evict items to make room
    // return true on success
    put(key: CacheKey, item: T): boolean {
        if (this.#store.has(key)) {
            return false;
        }
        const size = this.sanitizedSize(item);
        if (this.#used + size > this.#limit) {
            this.evictUntil(Math.max(0, this.#limit - size));
        }
        this.#evictPriority.addItem(key);
        this.#store.set(key, item);
        this.#used += size;
        return true;
    }
    private sanitizedSize(item: T) {
        const givenSize = item.sizeInBytes?.() ?? 0;
        const size = Number.isFinite(givenSize) ? Math.max(0, givenSize) : 0;
        return size;
    }

    // it is expected that the score function is not "pure" -
    // it has a closure over data that changes over time, representing changing priorities
    // thus - the owner of this cache has a responsibility to notify the cache when significant
    // changes in priority occur!
    reprioritize(score?: ScoreFn | undefined) {
        this.#evictPriority.rebuild(score);
    }

    get(key: CacheKey): T | undefined {
        return this.#store.get(key);
    }

    has(key: CacheKey): boolean {
        return this.#store.has(key);
    }

    cached(key: CacheKey): boolean {
        return this.#store.has(key);
    }

    isFull(): boolean {
        return this.#used >= this.#limit;
    }

    private evictLowestPriority() {
        const evictMe = this.#evictPriority.popMinItem();
        if (evictMe === null) return false;

        const data = this.#store.get(evictMe);
        if (data) {
            data.destroy?.();
            this.#store.delete(evictMe);
            const size = this.sanitizedSize(data);
            this.#used -= size;
        }
        return true;
    }

    private evictUntil(targetUsedBytes: number) {
        while (this.#used > targetUsedBytes) {
            if (!this.evictLowestPriority()) {
                // note: evictLowestPriority mutates this.used
                return; // all items evicted...
            }
        }
    }
}

export class AsyncPriorityCache<T extends Cacheable> extends PriorityCache<T> {
    #fetchPriority: KeyedMinHeap<PendingCacheable<T>, CacheKey>;
    #pendingFetches: Map<CacheKey, AbortController>;
    #MAX_INFLIGHT_FETCHES: number;
    #notify: undefined | ((k: CacheKey, result: FetchResult) => void);

    // items with lower scores will be evicted before items with high scores
    constructor(
        store: Store<CacheKey, T>,
        score: (k: CacheKey) => number,
        limitInBytes: number,
        maxFetches: number,
        onDataArrived?: (key: CacheKey, result: FetchResult) => void,
    ) {
        super(store, score, limitInBytes);

        this.#fetchPriority = new KeyedMinHeap<PendingCacheable<T>, CacheKey>(5000, negate(score), (pr) => pr.key);
        this.#pendingFetches = new Map();
        this.#MAX_INFLIGHT_FETCHES = maxFetches;
        this.#notify = onDataArrived;
    }

    enqueue(key: CacheKey, fetcher: (abort: AbortSignal) => Promise<T>): boolean {
        // enqueue the item, if we dont already have it, or are not already asking
        if (!this.has(key) && !this.#pendingFetches.has(key) && !this.#fetchPriority.hasItemWithKey(key)) {
            this.#fetchPriority.addItem({ key, fetch: fetcher });
            this.#fetchToLimit();
            return true;
        }
        return false;
    }

    async #beginFetch({ key, fetch }: PendingCacheable<T>) {
        const abort = new AbortController();
        this.#pendingFetches.set(key, abort);
        return fetch(abort.signal)
            .then((resource) => {
                this.put(key, resource);
                this.#notify?.(key, { status: 'success' });
            })
            .catch((reason) => {
                this.#notify?.(key, { status: 'failure', reason });
            })
            .finally(() => {
                this.#pendingFetches.delete(key);
                this.#fetchToLimit();
            });
    }

    #fetchToLimit() {
        let toFetch = Math.max(0, this.#MAX_INFLIGHT_FETCHES - this.#pendingFetches.size);
        for (let i = 0; i < toFetch; i++) {
            const fetchMe = this.#fetchPriority.popMinItemWithScore();
            if (fetchMe !== null) {
                if (fetchMe.score !== 0) {
                    this.#beginFetch(fetchMe.item);
                } else {
                    toFetch += 1; // increasing the loop limit inside the loop... a bit sketchy
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
    override reprioritize(score?: ScoreFn | undefined) {
        super.reprioritize(score);
        const sc = score ?? this.score;
        this.#fetchPriority.rebuild(negate(sc));
        for (const [key, abort] of this.#pendingFetches) {
            if (sc(key) === 0) {
                abort.abort('deprioritized');
                this.#pendingFetches.delete(key);
            }
        }
    }

    pending(key: CacheKey): boolean {
        return this.#fetchPriority.hasItemWithKey(key) || this.#pendingFetches.has(key);
    }

    cachedOrPending(key: CacheKey): boolean {
        return this.cached(key) || this.pending(key);
    }
}
