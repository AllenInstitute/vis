type MaybePromise<D> = D | Promise<D>;
type RecordKey = string | number | symbol
export interface AsyncCache<SemanticKey extends RecordKey, CacheKey extends RecordKey, D> {
    isCached(k: CacheKey): boolean;
    getCached(k: CacheKey): D | undefined;
    cacheAndUse(workingSet: Record<SemanticKey, () => Promise<D>>, use: (items: Record<SemanticKey, D>) => void, cacheKey: (semantic: SemanticKey) => CacheKey): cancelFn | undefined;
}

type useFn<K extends RecordKey, D> = (items: Record<K, D>) => void;
type cancelFn = () => void;
type MutablePendingRequest<SemanticKey extends RecordKey, CacheKey extends RecordKey, D> = {
    runner: useFn<SemanticKey, D>;
    awaiting: Set<CacheKey>;
    ready: Record<SemanticKey, D>;
}
// return true if the request is completely satisfied, false if its still awaiting more entries
function updatePendingRequest<SemanticKey extends RecordKey, CacheKey extends RecordKey, D>(req: MutablePendingRequest<SemanticKey, CacheKey, D>, key: SemanticKey, cacheKey: CacheKey, item: D): boolean {
    if (req.awaiting.has(cacheKey)) {
        req.awaiting.delete(cacheKey);
        req.ready[key] = item;
    }
    return req.awaiting.size === 0
}
type MutableCacheEntry<D> = {
    pendingRequests: number;
    data: MaybePromise<D>;
    lastRequestedTimestamp: number;
};

/**
 * `AsyncDataCache` asynchronous data cache, useful for minimizing network requests by caching the results of
 * a network request and returning the cached result if the request has already been made previously
 * for a given key.
 *
 * It is generalizable over any type of data.
 *
 * @example
 * const getMyData = ()=>fetch('https://example.com/data.json');
 * myCache.cache('myKey', getMyData).then((data)=>{console.log('its here now (and we cached it) ', data)});
 * }
 
 */
export class AsyncDataCache<SemanticKey extends RecordKey, CacheKey extends RecordKey, D> implements AsyncCache<SemanticKey, CacheKey, D> {
    private limit: number;
    private size: (d: D) => number;
    private destroyer: (d: D) => void;
    private entries: Map<CacheKey, MutableCacheEntry<D>>;
    private pendingRequests: Set<MutablePendingRequest<SemanticKey, CacheKey, D>>;
    /**
     * the intended use of this cache is to store resources used for rendering. Because the specific contents are generic, a simple interface must be provided
     * to support LRU cache eviction
     * occasionally, it can be necessary to manage these resources more explicitly (see https://stackoverflow.com/a/31250301 for a great example)
     * @param destroy a function which safely releases the resources owned by an entry in this cache - for normal garbage-collected objects, a no-op function will suffice.
     * @param size a function which returns the size of a resource - this is used only in relation to the cacheLimit
     * @param cacheLimit a limit (in whatever units are returned by the size() parameter) to place on cache contents
     * note that this limit is not a hard limit - old entries are evicted when new data is fetched, but the limit may be exceeded occasionally
     * a reasonable implementation may simply return 1 for size, and a desired occupancy count for the limit
     */
    constructor(destroy: (data: D) => void, size: (data: D) => number, cacheLimit: number) {
        this.size = size;
        this.destroyer = destroy;
        this.limit = cacheLimit;
        this.entries = new Map<CacheKey, MutableCacheEntry<D>>();
        this.pendingRequests = new Set<MutablePendingRequest<SemanticKey, CacheKey, D>>();
    }
    private usedSpace() {
        // Map uses iterators, so we're in for-loop teritorry here
        let sum = 0;
        this.entries.forEach((entry) => (sum += entry.data instanceof Promise ? 0 : this.size(entry.data)));
        return sum;
    }

    // if the cache is full, sort candidates which are not currently requested by their last-used timestamps
    // evict those items until the cache is no longer full
    private evictIfFull() {
        // find entries which have 0 pending requests, and are not themselves promises...
        let used = this.usedSpace();
        const candidates: { key: CacheKey; data: D; lastRequestedTimestamp: number }[] = [];
        if (used > this.limit) {
            this.entries.forEach((entry, key) => {
                if (!(entry.data instanceof Promise) && entry.pendingRequests < 1) {
                    candidates.push({ key, data: entry.data, lastRequestedTimestamp: entry.lastRequestedTimestamp });
                }
            });
        }
        const priority = candidates.sort((a, b) => a.lastRequestedTimestamp - b.lastRequestedTimestamp);

        for (const evictMe of priority) {
            used -= this.size(evictMe.data);
            this.destroyer(evictMe.data);
            this.entries.delete(evictMe.key);
            if (used < this.limit) {
                return;
            }
        }
    }

    /**
     * `isCached` checks if the entry is in the cache with a resolved promise.
     *
     * @param key The entry key to check for in the cache
     * @returns True if the entry in the cache has been resolved, false if there is no entry with that key or the promise is still pending
     */
    isCached(key: CacheKey): boolean {
        // the key exists, and the value associated is not a promise
        return this.entries.has(key) && !(this.entries.get(key)?.data instanceof Promise);
    }

    /**
     * `areKeysAllCached` checks if all the keys provided are in the cache with resolved promises.
     *
     * Useful for checking if all the data needed for a particular operation is already in the cache.
     *
     * @param cacheKeys A list of keys to check for in the cache
     * @returns True if all keys are cached, false if any are not in the cache
     */
    areKeysAllCached(cacheKeys: readonly CacheKey[]): boolean {
        return cacheKeys.every((key) => this.isCached(key));
    }

    /**
     * `getCached` gets an entry from the cache for the given key (if the promise is resolved).
     *
     * @param key Entry key to look up in the cache
     * @returns The entry (D) if it is present, or undefined if it is not
     */
    getCached(key: CacheKey): D | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;

        entry.lastRequestedTimestamp = performance.now();
        return entry.data instanceof Promise ? undefined : entry?.data;
    }
    getNumPendingTasks(): number {
        return this.pendingRequests.size;
    }
    private dataArrived(key: SemanticKey, cacheKey: CacheKey, data: D) {
        this.evictIfFull(); // we just got some data - is there room in the cache?
        const removeus: MutablePendingRequest<SemanticKey, CacheKey, D>[] = []
        for (const req of this.pendingRequests) {
            if (updatePendingRequest(req, key, cacheKey, data)) {
                req.runner(req.ready);
                removeus.push(req);
            }
        }
        removeus.forEach(finished => this.pendingRequests.delete(finished));
    }
    cacheAndUse(workingSet: Record<SemanticKey, () => Promise<D>>, use: (items: Record<SemanticKey, D>) => void, toCacheKey: (semanticKey: SemanticKey) => CacheKey): cancelFn | undefined {
        const keys: SemanticKey[] = Object.keys(workingSet) as SemanticKey[]
        const req: MutablePendingRequest<SemanticKey, CacheKey, D> = {
            awaiting: new Set<CacheKey>(keys.map(toCacheKey)),
            ready: {} as Record<SemanticKey, D>,
            runner: use,
        }
        for (const semanticKey of keys) {
            if (this.isCached(toCacheKey(semanticKey))) {
                if (updatePendingRequest(req, semanticKey, toCacheKey(semanticKey), this.getCached(toCacheKey(semanticKey))!)) {
                    // we were lucky - it was all cache hits!
                    use(req.ready);
                    return undefined; // no need to actually keep the request!
                }
            }
        }
        this.pendingRequests.add(req);
        // begin actually making the async requests for each key
        keys.forEach((semanticKey) => {
            workingSet[semanticKey]().then((data: D) => {
                this.dataArrived(semanticKey, toCacheKey(semanticKey), data);
            })
        })
        return () => {
            this.pendingRequests.delete(req);
        }
    }

}
