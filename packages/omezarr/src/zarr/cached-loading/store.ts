import { type Cacheable, logger, PriorityCache, WorkerPool } from '@alleninstitute/vis-core';
import * as zarr from 'zarrita';
import {
    FETCH_SLICE_MESSAGE_TYPE,
    type FetchSliceResponseMessage,
    isFetchSliceResponseMessage,
} from './fetch-slice.interface';

const DEFAULT_NUM_WORKERS = 6;
const DEFAULT_MAX_DATA_CACHE_BYTES = 256 * 2 ** 10; // 256 MB -- aribtrarily chosen at this point

// @TODO implement a much more context-aware cache size limiting mechanism
const getDataCacheSizeLimit = () => {
    return DEFAULT_MAX_DATA_CACHE_BYTES;
};

export const asCacheKey = (key: zarr.AbsolutePath, range?: zarr.RangeQuery | undefined): string => {
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

    destroy() { }

    sizeInBytes(): number {
        return this.#arr.byteLength;
    }

    get array(): Uint8Array {
        return this.#arr;
    }
}

type CacheKey = string;

type TransferableRequestInit = Omit<RequestInit, 'body' | 'headers' | 'signal'> & {
    body?: string;
    headers?: Record<string, string>;
};

const copyToTransferableHeaders = (headers: RequestInit['headers']): Record<string, string> | undefined => {
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
    return { ...updReq, body: req.body?.toString(), headers: copyToTransferableHeaders(req.headers) };
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

type Guard<T> = (obj: unknown) => obj is T
export interface RequestHandler<RequestType, ResponseType> {
    submitRequest<RequestType, ResponseType>(
        message: RequestType,
        responseValidator: Guard<ResponseType>,
        transfers: Transferable[],
        signal?: AbortSignal | undefined,
    ): Promise<ResponseType>;
}

export class ICachingMultithreadedFetchStore extends zarr.FetchStore {
    /**
     * Maintains a pool of available worker threads.
     */
    #workerPool: RequestHandler<any, any>;

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
    #priorityByTimestamp: Map<CacheKey, number>;

    /**
     * Stores in-progress requests that have not yet resolved.
     */
    #pendingRequests: Map<CacheKey, PendingRequest<Uint8Array | undefined>>;

    /**
     * Stores one instance of a cache key for each time that cache key was requested,
     * removing them all once that particular request is fulfilled. This allows us to
     * keep track of whether or not it is safe to abort a pending request: as long as
     * there are at least 2 instances of the same cache key in this array, then that
     * means multiple requestors are waiting on a particular piece of data, and it is
     * not safe to abort that request.
     */
    #pendingRequestKeyCounts: Map<CacheKey, number>;

    /**
     * A callback form of the `score` function.
     */
    #scoreFn: (h: CacheKey) => number;

    constructor(url: string | URL, handler: RequestHandler<any, any>, options?: CachingMultithreadedFetchStoreOptions) {
        super(url, options?.fetchStoreOptions);
        this.#scoreFn = (h: CacheKey) => this.score(h);
        this.#dataCache = new PriorityCache<CacheableByteArray>(
            new Map<CacheKey, CacheableByteArray>(),
            this.#scoreFn,
            options?.maxBytes ?? getDataCacheSizeLimit(),
        );
        this.#priorityByTimestamp = new Map<CacheKey, number>();
        this.#workerPool = handler;
        this.#pendingRequests = new Map();
        this.#pendingRequestKeyCounts = new Map();
    }

    protected score(key: CacheKey): number {
        return this.#priorityByTimestamp.get(key) ?? 0;
    }

    #fromCache(cacheKey: CacheKey): Uint8Array | undefined {
        const cached = this.#dataCache.get(cacheKey);
        if (cached === undefined) {
            return undefined;
        }
        this.#priorityByTimestamp.set(cacheKey, Date.now());
        return cached.array;
    }

    #incrementKeyCount(cacheKey: CacheKey): number {
        const count = this.#pendingRequestKeyCounts.get(cacheKey);
        const newCount = count !== undefined ? count + 1 : 1;
        this.#pendingRequestKeyCounts.set(cacheKey, newCount);
        return newCount;
    }

    #decrementKeyCount(cacheKey: CacheKey): number {
        const count = this.#pendingRequestKeyCounts.get(cacheKey);
        if (count === undefined) {
            logger.warn('attempted to decrement a non-existent request key');
            return 0;
        }
        if (count <= 1) {
            this.#pendingRequestKeyCounts.delete(cacheKey);
            return 0;
        }
        const newCount = count - 1;
        this.#pendingRequestKeyCounts.set(cacheKey, newCount);
        return newCount;
    }

    async #doFetch(
        key: zarr.AbsolutePath,
        range: zarr.RangeQuery | undefined,
        options: TransferableRequestInit,
        abort: AbortSignal | undefined,
    ): Promise<Uint8Array | undefined> {
        const cacheKey = asCacheKey(key, range);

        this.#priorityByTimestamp.set(cacheKey, Date.now());
        this.#dataCache.reprioritize(this.#scoreFn);

        this.#incrementKeyCount(cacheKey);

        const pending = this.#pendingRequests.get(cacheKey);
        if (pending !== undefined) {
            return pending.promise;
        }

        const { promise, resolve, reject } = Promise.withResolvers<Uint8Array | undefined>();

        this.#pendingRequests.set(cacheKey, { promise, resolve, reject });

        if (abort) {
            abort.onabort = () => {
                const count = this.#decrementKeyCount(cacheKey);
                if (count === 0) {
                    this.#priorityByTimestamp.set(cacheKey, 0);
                    this.#dataCache.reprioritize(this.#scoreFn);
                }
            };
        }

        const request = this.#workerPool.submitRequest(
            {
                type: FETCH_SLICE_MESSAGE_TYPE,
                rootUrl: this.url,
                path: key,
                range,
                options,
            },
            isFetchSliceResponseMessage,
            [],
            abort,
        );

        request
            .then((response: FetchSliceResponseMessage) => {
                const payload = response.payload;
                if (payload === undefined) {
                    resolve(undefined);
                    return;
                }
                const arr = new Uint8Array(payload);
                this.#dataCache.put(cacheKey, new CacheableByteArray(arr));
                resolve(arr);
            })
            .catch((e: unknown) => {
                reject(e);
            })
            .finally(() => {
                this.#pendingRequests.delete(cacheKey);
                this.#pendingRequestKeyCounts.delete(cacheKey);
            });

        return promise;
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
export class CachingMultithreadedFetchStore extends ICachingMultithreadedFetchStore {
    constructor(url: string | URL, options?: CachingMultithreadedFetchStoreOptions) {
        super(url, new WorkerPool(
            options?.numWorkers ?? DEFAULT_NUM_WORKERS,
            new URL('./fetch-slice.worker.ts', import.meta.url),
        ), options)
    }
}