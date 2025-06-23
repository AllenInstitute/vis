import type { AsyncDataCache } from '../dataset-cache';

// first pass at removing the old FrameLifecycle idea, and replacing it with something that behaves nicer:

class Visualization<Dataset, Item, Settings, RqKey extends string,
    CacheKey extends string, CacheEntryType> {
    private cache: AsyncDataCache<RqKey, CacheKey, CacheEntryType>
    constructor(cache: AsyncDataCache<RqKey, CacheKey, CacheEntryType>, cacheKey) {
        this.cache = cache;
    }
    prioritize(items: Iterable<Item>) {

    }
}