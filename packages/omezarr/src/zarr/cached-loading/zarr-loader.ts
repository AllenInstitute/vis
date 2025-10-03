
const DEFAULT_MAX_ATTRS_CACHE_BYTES = 16 * 2 ** 10; // 16 MB -- aribtrarily chosen at this point
const DEFAULT_MAX_DATA_CACHE_BYTES = 256 * 2 ** 10; // 256 MB -- aribtrarily chosen at this point

// @TODO implement a much more context-aware cache size limiting mechanism
const getAttrsCacheSizeLimit = () => {
    return DEFAULT_MAX_ATTRS_CACHE_BYTES;
};

// @TODO implement a much more context-aware cache size limiting mechanism
const getDataCacheSizeLimit = () => {
    return DEFAULT_MAX_ATTRS_CACHE_BYTES;
};



export class CopyableCachedFetchStore extends zarr.FetchStore {
    /**
     * Caches in-progress request promises so that only one request
     * is ever made for the same data.
     */
    #promiseCache: Map<CacheKey, Promise<Uint8Array | undefined>>;

    /**
     * Caches the raw response results from previous requests.
     */
    #dataCache: PriorityCache<CacheableByteArray>;

    /**
     * The set of unique cache keys stored across either the promise
     * cache or the data cache.
     */
    #cacheKeys: Set<CacheKey>;

    /**
     * Stores the configuration options that were used to initialize
     * the underlying FetchStore.
     */
    #options: FetchStoreOptions | undefined;

    constructor(
        url: string | URL,
        maxBytes: number,
        options?: CopyableCachedFetchStoreOptions | undefined
    ) {
        super(url, options);
        const { initCache, ...remainingOptions } = options || {};
        this.#promiseCache = new Map();
        this.#dataCache = new PriorityCache(new Map<CacheKey, CacheableByteArray>(), (h: CacheKey) => this.#score(h), maxBytes);
        this.#options = remainingOptions;
        // this.#maxCacheBytes = maxBytes;
        // this.#currCacheBytes = 0;
        this.#cacheKeys = new Set<CacheKey>();

        if (initCache && initCache.size > 0) {
            initCache.forEach((value, key) => this.#dataCache.put(key, new CacheableByteArray(value.slice())));
        }
    }

    /**
     * Attempts to add a new data block into the data cache, mapped to a unique cache key.
     * If the data is undefined or there isn't enough space in the cache, nothing happens.
     * 
     * @param cacheKey The unique key associated with the data block to cache
     * @param data The data block to cache
     */
    #updateDataCache(cacheKey: string, data: Uint8Array | undefined) {
        if (data === undefined) {
            this.#cacheKeys.delete(cacheKey);
            return; // Zarrita's FetchStore returns an undefined when a 404 is encountered; do nothing
        }
        this.#dataCache.put(cacheKey, new CacheableByteArray(data.slice()));
    }

    #uncachePromise(cacheKey: string): boolean {
        return this.#promiseCache.delete(cacheKey);
    }

    /**
     * Wraps a data request promise within another promise that ensures that the results of
     * the data request are correctly managed within the cache before being returned to the
     * original caller.
     * 
     * @param cacheKey The key representing the signature of a specific data request
     * @param promise The data request represented as a Promise
     * @returns the wrapping Promise
     */
    #wrapPromise(
        cacheKey: string,
        promise: Promise<Uint8Array | undefined>
    ): Promise<Uint8Array | undefined> {
        return new Promise<Uint8Array | undefined>((resolve, reject) => {
            promise
                .then((data) => {
                    this.#updateDataCache(cacheKey, data);
                    resolve(data);
                })
                .catch((e) => {
                    logger.error(`request for ${cacheKey}] failed to fetch; error:`, e);
                    reject(e);
                })
                .finally(() => {
                    this.#uncachePromise(cacheKey);
                });
        });
    }

    /**
     * Performs a cache lookup of the specified cache key to see if there is either 
     *   a) already-loaded data for that cache key, or
     *   b) a data-request promise underway for that cache key.
     * 
     * The cache key is intended to represent the distinctive signature of a request for
     * a particular set of data. Typically, this will be either a URL, or a URL and a
     * byte range within the resource indicated by the URL.
     * 
     * If neither data nor promise is found, a new request is sent, using either a direct
     * URL request (using `FetchStore.get`) or a range request (using `FetchStore.getRange`).
     * @param cacheKey The key representing the signature of a specific data request
     * @param fetchFn Either FetchStore.get or FetchStore.getRange, wrapped in a closure
     * @returns A cache-managed promise of the results from the data request
     */
    #retrieve(cacheKey: string, fetchFn: () => Promise<Uint8Array | undefined>) {
        const cachedData = this.#dataCache.get(cacheKey);

        if (cachedData === undefined) {
            logger.debug(
                `request for ${cacheKey}] not found in data cache, checking promise cache`
            );
            const cachedPromise = this.#promiseCache.get(cacheKey);
            if (cachedPromise === undefined) {
                logger.debug(
                    `request for ${cacheKey}] not found in promise cache; fetching...`
                );
                const promise = this.#wrapPromise(cacheKey, fetchFn());
                this.#promiseCache.set(cacheKey, promise);
                this.#cacheKeys.add(cacheKey);
                return promise;
            }
        }
        return new Promise<Uint8Array | undefined>((resolve) => {
            resolve(cachedData);
        });
    }

    get(
        key: zarr.AbsolutePath,
        options?: RequestInit
    ): Promise<Uint8Array | undefined> {
        const cacheKey = asCacheKey(key);
        return this.#retrieve(cacheKey, () => super.get(key, options));
    }

    getRange(
        key: zarr.AbsolutePath,
        range: zarr.RangeQuery,
        options?: RequestInit
    ): Promise<Uint8Array | undefined> {
        const cacheKey = asCacheKey(key, range);
        return this.#retrieve(cacheKey, () => super.getRange(key, range, options));
    }

    /**
     * Copies this store into a new instance, with the same URL/location, configuration,
     * and current cached data.
     * 
     * NOTE: This function copies only the current cache data and does not copy over any
     * active/unfulfilled requests for additional data. If needed, use `await <this>.pending()`
     * to wait for all active promises to be fulfilled.
     * @returns A new CopyableCachedFetchStore copied from this one
     */
    copy(): CopyableCachedFetchStore {
        return new CopyableCachedFetchStore(this.url, this.#maxCacheBytes, {
            ...this.#options,
            initCache: this.#dataCache,
        });
    }

    get cacheKeys(): SetIterator<CacheKey> {
        return this.#cacheKeys.values();
    }

    /**
     * Synchronously delete all cached data from this store.
     */
    clearData() {
        this.#dataCache.clear();
        this.#currCacheBytes = 0;
    }

    /**
     * Waits until all active requests for data are completed.
     * 
     * NOTE: This does not await any promises that are added AFTER this
     * function is called.
     */
    async pending() {
        await Promise.allSettled(this.#promiseCache.values());
    }

    /**
     * Waits until all active requests for data are completed,
     * then delets all cached data from this store.
     */
    async clear() {
        await this.pending();
        this.clearData();
    }
}



export class CachedOmeZarrLoader {
    #groupAttrsCache: Map<string, OmeZarrMetadata>;
    #arrayAttrsCache: Map<string, Uint8Array>;
    #arrayDataCache: PriorityCache<CacheableByteArray>;

    #maxDataBytes: number;

    #decoder: Decoder;

    constructor(maxDataBytes: number, maxWorkers: number) {
        this.#maxDataBytes = Math.max(0, Math.min(maxDataBytes, getDataCacheSizeLimit()));
        this.#groupAttrsCache = new Map<string, OmeZarrMetadata>();
        this.#arrayAttrsCache = new Map<string, Uint8Array>();
        this.#arrayDataCache = new PriorityCache<CacheableByteArray>(new Map<string, CacheableByteArray>(), (h: CacheKey) => this.#score(h), this.#maxDataBytes); l
        this.#decoder = (
            dataset: OmeZarrMetadata,
            req: ZarrRequest,
            level: OmeZarrShapedDataset,
            signal?: AbortSignal
        ): Promise<VoxelTileImage> => this.#decode(dataset, req, level, signal);
    }




    #getStore(url: string): CachedFetchStore {
        const store = this.#stores.get(url); // @TODO may not be a safe assumption that this is always the root URL; may not be an issue, though?
        if (store === undefined) {
            const newStore = new CachedFetchStore(url, getCacheSizeLimit());
            this.#stores.set(url, newStore);
            return newStore;
        }
        return store;
    }

    #decode(
        dataset: OmeZarrMetadata,
        req: ZarrRequest,
        level: OmeZarrShapedDataset,
        signal?: AbortSignal
    ): Promise<VoxelTileImage> {
        // check if `dataset` is in cache, if not, load it
        // load group attrs
        // load array attrs
        // check if level matches one in the loaded version of `dataset`, if not, error
        // retrieve `shape` and `path` from `level`
        // retrieve `zarrVersion` from `dataset`
        // retrieve `axes` from multiscale via `level`, `dataset`
        this.#loadSlice(path, shape, axes, zarrVersion);
    }

    get decoder(): Decoder {
        return this.#decoder;
    }

    #loadSlice(path: string, query: zarr.Slice) {
        // check cache
        // cache hit: return slice data
        // cache miss: prepare worker and launch
    }

    loadAttrs(res: WebResource): Promise<OmeZarrAttrs> {
        const cached = this.#attrsCache.get(res.url);
        if (cached !== undefined) {
            return cached;
        }

        const store = this.#getStore(res.url);

        const promise = new Promise<OmeZarrAttrs>(async (resolve, reject) => {
            try {
                const group = await zarr.open(store, { kind: "group" });
                const attrs = OmeZarrAttrsSchema.parse(group.attrs);
                resolve(attrs);
            } catch (e) {
                if (e instanceof ZodError) {
                    logger.error("could not load Zarr file: parsing failed");
                } else {
                    logger.error("could not load Zarr file: ", e);
                }
                reject(e);
            }
        });

        this.#attrsCache.set(res.url, promise);
        return promise;
    }

    async loadArrayMetadata() { }

    async loadMetadata(res: WebResource): Promise<OmeZarrMetadata> {
        const cached = this.#metadataCache.get(res.url);
        if (cached !== undefined) {
            return cached;
        }

        const store = this.#getStore(res.url);

        const promise = new Promise<OmeZarrMetadata>(async (resolve, reject) => {
            const attrs: OmeZarrAttrs = await loadZarrAttrsFileFromStore(store);
            const version = attrs.zarrVersion;
            const arrays = await Promise.all(
                attrs.multiscales
                    .map((multiscale) => {
                        return (
                            multiscale.datasets?.map(async (dataset) => {
                                return (
                                    await loadZarrArrayFileFromStore(
                                        store,
                                        dataset.path,
                                        version,
                                        loadV2ArrayAttrs
                                    )
                                ).metadata;
                            }) ?? []
                        );
                    })
                    .reduce((prev, curr) => prev.concat(curr))
                    .filter((v) => v !== undefined)
            );
            resolve(new OmeZarrMetadata(res.url, attrs, arrays, version));
        });
        this.#metadataCache.set(res.url, promise);
        return promise;
    }
}

class CachedFetchStore extends zarr.FetchStore {
    #cache: Map<string, Promise<Uint8Array | undefined>>;
    #maxBytes: number;
    #currBytes: number;

    constructor(
        url: string | URL,
        maxBytes: number,
        options?: {
            overrides?: RequestInit;
            useSuffixRequest?: boolean;
        }
    ) {
        super(url, options);
        this.#cache = new Map();
    }

    get(
        key: zarr.AbsolutePath,
        options?: RequestInit
    ): Promise<Uint8Array | undefined> {
        const cacheKey = asCacheKey(key);
        if (this.#cache.has(cacheKey)) {
            logger.debug(`get: ${cacheKey} [CACHED]`);
        } else {
            logger.debug(`get: ${cacheKey}`);
        }
        const cached = this.#cache.get(cacheKey);
        if (cached === undefined) {
            const promise = super.get(key, options);
            this.#cache.set(cacheKey, promise);
            return promise;
        }
        return cached;
    }

    getRange(
        key: zarr.AbsolutePath,
        range: zarr.RangeQuery,
        options?: RequestInit
    ): Promise<Uint8Array | undefined> {
        const cacheKey = asCacheKey(key, range);
        if (this.#cache.has(cacheKey)) {
            console.log(`getRange: ${cacheKey} [CACHED]`);
        } else {
            console.log(`getRange: ${cacheKey}`);
        }
        const cached = this.#cache.get(cacheKey);
        if (cached === undefined) {
            const promise = super.getRange(key, range, options);
            this.#cache.set(cacheKey, promise);
            return promise;
        }
        return cached;
    }
}


export async function loadSlice2(
    url: string,
    axes: OmeZarrAxis[],
    r: ZarrRequest,
    path: string,
    zarrVersion: number,
    shape: ReadonlyArray<number>,
    signal?: AbortSignal
) {
    // put the request in native order
    const store = new CachedFetchStore(url, 8 * 2 ** 10);
    // if (!level) {
    //     const message = 'invalid Zarr data: no datasets found';
    //     logger.error(message);
    //     throw new VisZarrDataError(message);
    // }
    // const arr = metadata.arrays.find((a) => a.path === level.path);
    // if (!arr) {
    //     const message = `cannot load slice: no array found for path [${level.path}]`;
    //     logger.error(message);
    //     throw new VisZarrDataError(message);
    // }
    const { raw } = await loadZarrArrayFileFromStore(
        store,
        path,
        zarrVersion,
        false
    );
    const result = await zarr.get(raw, buildQuery(r, axes, shape), {
        opts: { signal: signal ?? null },
    });
    if (typeof result === "number") {
        throw new Error("oh noes, slice came back all weird");
    }
    return {
        shape: result.shape,
        buffer: result,
    };
}
