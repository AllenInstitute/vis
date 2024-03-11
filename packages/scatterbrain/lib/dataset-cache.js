/**
 * `AsyncDataCache` asynchronous data cache, useful for minimizing network requests by caching the results of
 * a network request and returning the cached result if the request has already been made previously
 * for a given key.
 *
 * It is generalizable over any type of data.
 *
 * @example
 * const myCache = new AsyncDataCache<number>();
 * if (!myCache.isCached('myKey')) {
 *   myCache.cache('myKey', () => fetch('https://example.com/data.json')));
 * }
 * const cachedData = myCache.getCached('myKey');
 * // Use the data
 */
export class AsyncDataCache {
    entries;
    /**
     * Creates a new instance of the AsyncDataCache class with its own map of entries.
     */
    constructor() {
        this.entries = new Map();
    }
    /**
     * `isCached` checks if the entry is in the cache with a resolved promise.
     *
     * @param key The entry key to check for in the cache
     * @returns True if the entry in the cache has been resolved, false if there is no entry with that key or the promise is still pending
     */
    isCached(key) {
        // the key exists, and the value associated is not a promise
        return this.entries.has(key) && !(this.entries.get(key) instanceof Promise);
    }
    /**
     * `areKeysAllCached` checks if all the keys provided are in the cache with resolved promises.
     *
     * Useful for checking if all the data needed for a particular operation is already in the cache.
     *
     * @param cacheKeys A list of keys to check for in the cache
     * @returns True if all keys are cached, false if any are not in the cache
     */
    areKeysAllCached(cacheKeys) {
        return cacheKeys.every((key) => this.isCached(key));
    }
    /**
     * `getCached` gets an entry from the cache for the given key (if the promise is resolved).
     *
     * @param key Entry key to look up in the cache
     * @returns The entry (D) if it is present, or undefined if it is not
     */
    getCached(key) {
        const entry = this.entries.get(key);
        return entry instanceof Promise ? undefined : entry;
    }
    /**
     * `cache` adds a new entry to the cache if it is not already present.
     *
     * It will only call the `getter` parameter if the key isn't already in the cache, making this
     * safe to call multiple times with the same key without worrying about kicking off multiple
     * asynchronous requests.
     *
     * @param key The key to cache the data under
     * @param getter An asynchronous function that will fetch the data to be cached
     * @returns Returns the newly created entry or the existing one if it already existed
     */
    cache(key, getter) {
        if (!this.entries.has(key)) {
            const setWhenFetched = getter().then((actual) => {
                this.entries.set(key, actual);
                // return actual so this can chain promises:
                return actual;
            });
            setWhenFetched.catch((_reason) => {
                // its often the case that these requests get rejected - thats fine
                // remove the promise from the cache in that case:
                this.entries.delete(key);
                // note - promises chained onto this promise will still get rejected,
                // so our caller of course has a chance to do something more smart
            });
            this.entries.set(key, setWhenFetched);
        }
        // We _know_ the entry is in the map (because we just put it there if it wasn't already),
        // so we can safely assert that the entry is non-null.
        return this.entries.get(key);
    }
}
