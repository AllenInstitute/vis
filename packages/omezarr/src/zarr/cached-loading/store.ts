import { PriorityCache, type Cacheable } from '@alleninstitute/vis-core';
import * as zarr from 'zarrita';
import { WorkerPool } from './worker-pool';
import { FETCH_SLICE_MESSAGE_TYPE, isFetchSliceResponseMessage } from './fetch-slice.interface';

const DEFAULT_NUM_WORKERS = 6;

const asCacheKey = (key: zarr.AbsolutePath, range?: zarr.RangeQuery | undefined): string => {
    const keyStr = JSON.stringify(key);
    const rangeStr = range ? JSON.stringify(range) : 'no-range';
    return `${keyStr} ${rangeStr}`;
};

type FetchStoreOptions = {
    overrides?: RequestInit;
    useSuffixRequest?: boolean;
};

class CacheableByteArray implements Cacheable {
    #arr: Uint8Array;

    constructor(arr: Uint8Array) {
        this.#arr = arr;
    }

    destroy() {}

    sizeInBytes(): number {
        return this.#arr.byteLength;
    }

    buffer(): ArrayBufferLike {
        return this.#arr.buffer;
    }
}

type CacheKey = string;

type TransferableRequestInit = Omit<RequestInit, 'body' | 'headers' | 'signal'> & {
    body?: string;
    headers?: Record<string, string>;
};

const copyHeaders = (headers: RequestInit['headers']): Record<string, string> | undefined => {
    if (Array.isArray(headers)) {
        const result: Record<string, string> = {};
        headers.forEach(([key, val]) => {
            // TODO is key, val the correct order here?
            result[key] = val;
        });
        return result;
    }
    if (headers instanceof Headers) {
        const result: Record<string, string> = {};
        headers.forEach((val, key) => {
            result[key] = val;
        });
        return result;
    }
    return headers;
};

const copyToTransferableRequestInit = (req: RequestInit | undefined): TransferableRequestInit => {
    if (req === undefined) {
        return {};
    }
    const updReq = { ...req };
    delete updReq.signal;
    delete updReq.window;
    return { ...updReq, body: req.body?.toString(), headers: copyHeaders(req.headers) };
};

export type CachingMultithreadedFetchStoreOptions = {
    maxBytes?: number | undefined;
    numWorkers?: number | undefined;
    fetchStoreOptions?: FetchStoreOptions | undefined;
};

export class CachingMultithreadedFetchStore extends zarr.FetchStore {
    /**
     * Maintains a pool of available worker threads.
     */
    #workerPool: WorkerPool;

    /**
     * Stores the current set of cached data that has been successfully
     * fetched. This data is stored in raw byte array form so that it
     * integrates properly with the Zarrita framework.
     */
    #dataCache: PriorityCache<CacheableByteArray>;

    /**
     * Maps cache keys to numeric times; the higher the time, the higher the priority.
     *
     * This effectively means that more frequently-requested items will be kept longer.
     */
    #priorityMap: Map<CacheKey, number>;

    /**
     * A callback form of the `score` function.
     */
    #scoreFn: (h: CacheKey) => number;

    constructor(url: string | URL, maxBytes: number, options?: CachingMultithreadedFetchStoreOptions) {
        super(url, options?.fetchStoreOptions);
        this.#scoreFn = (h: CacheKey) => this.score(h);
        this.#dataCache = new PriorityCache<CacheableByteArray>(
            new Map<CacheKey, CacheableByteArray>(),
            this.#scoreFn,
            maxBytes,
        );
        this.#priorityMap = new Map<CacheKey, number>();
        this.#workerPool = new WorkerPool(
            options?.numWorkers ?? DEFAULT_NUM_WORKERS,
            new URL('./fetch-slice.worker.ts', import.meta.url),
        );
    }

    protected score(key: CacheKey): number {
        return this.#priorityMap.get(key) ?? 0;
    }

    #fromCache(cacheKey: CacheKey): Uint8Array | undefined {
        const cached = this.#dataCache.get(cacheKey);
        if (cached === undefined) {
            return undefined;
        }
        this.#priorityMap.set(cacheKey, Date.now());
        return new Uint8Array(cached.buffer());
    }

    async #doFetch(
        key: zarr.AbsolutePath,
        range: zarr.RangeQuery | undefined,
        options: TransferableRequestInit,
    ): Promise<Uint8Array | undefined> {
        const response = await this.#workerPool.submitRequest(
            {
                type: FETCH_SLICE_MESSAGE_TYPE,
                rootUrl: this.url,
                path: key,
                range,
                options,
            },
            isFetchSliceResponseMessage,
            [],
        );
        if (response.payload === undefined) {
            return undefined;
        }
        const arr = new Uint8Array(response.payload);
        const cacheKey = asCacheKey(key, range);

        this.#priorityMap.set(cacheKey, Date.now());
        this.#dataCache.put(cacheKey, new CacheableByteArray(arr));
        return arr;
    }

    async get(key: zarr.AbsolutePath, options?: RequestInit): Promise<Uint8Array | undefined> {
        const cacheKey = asCacheKey(key);
        const cached = this.#fromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const workerOptions = copyToTransferableRequestInit(options);
        return this.#doFetch(key, undefined, workerOptions);
    }

    async getRange(
        key: zarr.AbsolutePath,
        range: zarr.RangeQuery,
        options?: RequestInit,
    ): Promise<Uint8Array | undefined> {
        const cacheKey = asCacheKey(key, range);
        const cached = this.#fromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const workerOptions = copyToTransferableRequestInit(options);
        return this.#doFetch(key, range, workerOptions);
    }
}
