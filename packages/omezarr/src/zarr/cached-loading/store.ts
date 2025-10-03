import { AsyncPriorityCache, type FetchResult, logger, type Cacheable } from '@alleninstitute/vis-core';
import * as zarr from 'zarrita';
import { WorkerPool } from './worker-pool';
import { FETCH_SLICE_MESSAGE_TYPE, isFetchSliceResponseMessage } from './fetch-slice.interface';

const DEFAULT_NUM_WORKERS = 6;
const DEFAULT_MAX_DATA_CACHE_BYTES = 256 * 2 ** 10; // 256 MB -- aribtrarily chosen at this point
const DEFAULT_NUM_CONCURRENT_FETCHES = DEFAULT_NUM_WORKERS;

// @TODO implement a much more context-aware cache size limiting mechanism
const getDataCacheSizeLimit = () => {
    return DEFAULT_MAX_DATA_CACHE_BYTES;
};

// @TODO implement a much more context-aware cache size limiting mechanism
const getMaxConcurrentFetches = () => {
    return DEFAULT_NUM_CONCURRENT_FETCHES;
};

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
    #arr: Uint8Array | null;

    constructor(arr: Uint8Array) {
        this.#arr = arr;
    }

    destroy() {
        this.#arr = null;
    }

    sizeInBytes(): number {
        return this.#arr?.byteLength ?? 0;
    }

    buffer(): ArrayBufferLike {
        if (this.#arr === null) {
            throw new Error('cannot retrieve data buffer: array is null');
        }
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
    maxFetches?: number | undefined;
    fetchStoreOptions?: FetchStoreOptions | undefined;
};

type PromiseResolve<T> = (t: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// biome-ignore lint/suspicious/noExplicitAny: This is aligned with the standard Promise API
type PromiseReject = (reason: any) => void;

type PendingRequest<T> = {
    resolve: PromiseResolve<T>;
    reject: PromiseReject;
    promise: Promise<T>;
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
    #dataCache: AsyncPriorityCache<CacheableByteArray>;

    /**
     * Maps cache keys to numeric times; the higher the time, the higher the priority.
     *
     * This effectively means that more frequently-requested items will be kept longer.
     */
    #priorityMap: Map<CacheKey, number>;

    #pendingRequests: Map<CacheKey, PendingRequest<Uint8Array | undefined>>;

    /**
     * A callback form of the `score` function.
     */
    #scoreFn: (h: CacheKey) => number;

    constructor(url: string | URL, options?: CachingMultithreadedFetchStoreOptions) {
        super(url, options?.fetchStoreOptions);
        this.#scoreFn = (h: CacheKey) => this.score(h);
        this.#dataCache = new AsyncPriorityCache<CacheableByteArray>(
            new Map<CacheKey, CacheableByteArray>(),
            this.#scoreFn,
            options?.maxBytes ?? getDataCacheSizeLimit(),
            options?.maxFetches ?? getMaxConcurrentFetches(),
            (key: CacheKey, result: FetchResult) => this.#dataReceived(key, result),
        );
        this.#priorityMap = new Map<CacheKey, number>();
        this.#workerPool = new WorkerPool(
            options?.numWorkers ?? DEFAULT_NUM_WORKERS,
            new URL('./fetch-slice.worker.ts', import.meta.url),
        );
        this.#pendingRequests = new Map();
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

    #dataReceived(key: CacheKey, result: FetchResult) {
        const pending = this.#pendingRequests.get(key);
        if (pending === undefined) {
            logger.warn('received data for unrecognized request');
            return;
        }
        if (result.status === 'failure') {
            const reason = new Error('data retrieval failed:', { cause: result.reason });
            pending.reject(reason);
            this.#pendingRequests.delete(key);
            throw reason;
        }
        const cacheable = this.#dataCache.get(key);
        if (cacheable === undefined) {
            pending.resolve(undefined);
            return;
        }
        pending.resolve(new Uint8Array(cacheable.buffer()));
    }

    async #doFetch(
        key: zarr.AbsolutePath,
        range: zarr.RangeQuery | undefined,
        options: TransferableRequestInit,
        abort: AbortSignal | undefined,
    ): Promise<Uint8Array | undefined> {
        const fetcher = async (signal: AbortSignal) => {
            const response = await this.#workerPool.submitRequest(
                {
                    type: FETCH_SLICE_MESSAGE_TYPE,
                    rootUrl: this.url,
                    path: key,
                    range,
                    options,
                    signal,
                },
                isFetchSliceResponseMessage,
                [],
            );
            if (response.payload === undefined) {
                throw new Error('data retrieval failed: resoonse payload was empty');
            }
            const arr = new Uint8Array(response.payload);
            return new CacheableByteArray(arr);
        };

        const cacheKey = asCacheKey(key, range);
        this.#priorityMap.set(cacheKey, Date.now());

        if (abort) {
            abort.onabort = () => {
                this.#priorityMap.set(cacheKey, 0);
                this.#dataCache.reprioritize();
            };
        }

        const queued = this.#dataCache.enqueue(cacheKey, fetcher);
        if (!queued) {
            const pending = this.#pendingRequests.get(cacheKey);
            if (pending === undefined) {
                throw new Error('data cache did not queue request, but request was not found to be pending');
            }
            return await pending.promise;
        }
        const { promise, resolve, reject } = Promise.withResolvers<Uint8Array | undefined>();
        this.#pendingRequests.set(cacheKey, { promise, resolve, reject });
        return await promise;
    }

    async get(key: zarr.AbsolutePath, options?: RequestInit): Promise<Uint8Array | undefined> {
        const cacheKey = asCacheKey(key);
        const cached = this.#fromCache(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const workerOptions = copyToTransferableRequestInit(options);
        const abort = options?.signal ?? undefined;
        return this.#doFetch(key, undefined, workerOptions, abort);
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
        const abort = options?.signal ?? undefined;
        return this.#doFetch(key, range, workerOptions, abort);
    }
}
