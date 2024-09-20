import { partial } from 'lodash';
import { AsyncDataCache } from '../dataset-cache';
import type { ReglCacheEntry, Renderer } from './types';
import type REGL from 'regl';

/// THIS file is a copy of render-queue, but with some changes made that I hope will make the idea of beginLongRunningFrame easier to use ///
// TODO: delete (or make deprecated) the old one
// the most obvious difference: a config parameter, rather than a function over 11 arguments!
// the second difference is more subtle - you'll notice an "isPrepared" parameter, which we use to deal with some competing interests
// 1. it would be nice to write render functions that use objects (see the type GpuData) rather than records from strings to the data we want
// 2. this desire is complicated by our desire to share GPU-resident data if possible! because different renderers want different "objects" to render which *could* all share raw gpu resources
//    it becomes very difficult to express the types of such a system statically. 
// SO: by having render-authors provide a type-guard, we can safely (provided the guard is reasonable) cast a record<string, gpuStuf> to a nice, friendly object 'GpuData' at runtime!
// note also: the cache is set up to dissuade users from holding on to references to data in the cache - its still possible of course (this is typescript!) but the whole system is set up to accept
// a generic useWithCache(...) function, which also makes this tricky

export type FrameLifecycle = {
    cancelFrame: (reason?: string) => void;
};

export type NormalStatus = 'begun' | 'finished' | 'cancelled' | 'finished_synchronously' | 'progress';
export type RenderCallback = (event: { status: NormalStatus } | { status: 'error'; error: unknown }) => void;

export type RenderFrameConfig<Dataset, Item, Settings, RqKey extends string, CacheKey extends string, CacheEntryType, GpuData extends Record<RqKey, CacheEntryType>> = {
    maximumInflightAsyncTasks: number; // Maximum number of in-flight fetches to run at any time for this frame
    queueProcessingIntervalMS: number; // The length of time to wait between processing the queue in milliseconds.
    queueTimeBudgetMS: number;         // Spend at most (soft limit) this many milliseconds working on the queue at a time
    items: Item[];                     // the items to render
    mutableCache: AsyncDataCache<RqKey, CacheKey, CacheEntryType>; // the cached results of fetching item contents
    dataset: Dataset;                   // the dataset comprised of all Items
    settings: Settings;                // the settings (anything that is the same for the entire frame, think colors, point-sizes etc.)
    requestsForItem: (item: Item, dataset: Dataset, settings: Settings, signal?: AbortSignal) => Record<RqKey, () => Promise<CacheEntryType>>;
    lifecycleCallback: RenderCallback,
    cacheKeyForRequest: (item: Item, requestKey: RqKey, dataset: Dataset, settings: Settings) => CacheKey
    isPrepared: (cacheData: Record<RqKey, CacheEntryType | undefined>) => cacheData is GpuData
    renderItem: (item: Item, dataset: Dataset, settings: Settings, gpuData: GpuData) => void;

}

export function beginFrame<Dataset, Item, Settings, RqKey extends string, CacheKey extends string, CacheEntryType, GpuData extends Record<RqKey, CacheEntryType>>(
    config: RenderFrameConfig<Dataset, Item, Settings, RqKey, CacheKey, CacheEntryType, GpuData>
): FrameLifecycle {
    const { maximumInflightAsyncTasks, queueTimeBudgetMS, queueProcessingIntervalMS, cacheKeyForRequest, settings, items, mutableCache, lifecycleCallback, renderItem, requestsForItem, isPrepared, dataset } = config;

    const abort = new AbortController();
    const queue: Item[] = [];
    const taskCancelCallbacks: Array<() => void> = [];
    const fancy = (itemToRender: Item, maybe: Record<RqKey, CacheEntryType | undefined>) => {
        if (isPrepared(maybe)) {
            renderItem(itemToRender, dataset, settings, maybe);
        }
    }
    const reportNormalStatus = (status: NormalStatus) => {
        // we want to report our status, however the flow of events can be confusing -
        // our callers anticipate an asynchronous (long running) frame to be started,
        // but there are scenarios in which the whole thing is completely synchronous
        // callers who are scheduling things may be surprised that their frame finished
        // before the code that handles it appears to start. thus, we make the entire lifecycle callback
        // system async, to prevent surprises.
        Promise.resolve().then(() => lifecycleCallback({ status }));
    };
    // when starting a frame, we greedily attempt to render any tasks that are already in the cache
    // however, if there is too much overhead (or too many tasks) we would risk hogging the main thread
    // thus - obey the limit (its a soft limit)
    const startTime = performance.now();

    for (let i = 0; i < items.length; i += 1) {
        const itemToRender = items[i];
        const requestFns = requestsForItem(itemToRender, dataset, settings, abort.signal);
        const cacheKey = (rq: RqKey): CacheKey => cacheKeyForRequest(itemToRender, rq, dataset, settings);
        const cacheKeys = (Object.keys(requestFns) as RqKey[]).map(cacheKey);


        if (mutableCache.areKeysAllCached(cacheKeys)) {
            const result = mutableCache.cacheAndUse(requestFns, partial(fancy, itemToRender), cacheKey);
            if (result !== undefined) {
                // this is a problem - the cache reported that all the keys are in the cache, however this result is a cancellation callback,
                // which indicates that the item could not be rendered right away, which should be impossible...
                // TODO
                taskCancelCallbacks.push(result);
            }
        } else {
            // areKeysAllCached returned false - enqueue for later
            queue.push(itemToRender);
        }
        if (performance.now() - startTime > queueTimeBudgetMS) {
            // we've used up all our time - enqueue all remaining tasks
            if (i < items.length - 1) {
                queue.push(...items.slice(i + 1));
            }
            break;
        }
    }

    if (queue.length === 0) {
        // we did all the work - it was already cached
        reportNormalStatus('finished_synchronously');
        return { cancelFrame: () => { } };
    }
    // TODO: Re-examine lifecycle reporting, potentially unify all statuses into a single type
    reportNormalStatus('begun');
    if (queue.length !== items.length) {
        // We did some work, but there's some left
        reportNormalStatus('progress');
    }
    const doWorkOnQueue = (intervalId: number) => {
        // try our best to cleanup if something goes awry
        const startWorkTime = performance.now();
        const cleanupOnError = (err: unknown) => {
            // clear the queue and the staging area (inFlight)
            taskCancelCallbacks.forEach((cancelMe) => cancelMe());
            queue.splice(0, queue.length);
            // stop fetching
            abort.abort(err);
            clearInterval(intervalId);
            // pass the error somewhere better:
            lifecycleCallback({ status: 'error', error: err });
        };
        while (mutableCache.getNumPendingTasks() < Math.max(maximumInflightAsyncTasks, 1)) {
            if (queue.length < 1) {
                // we cant add anything to the in-flight staging area, the final task
                // is already in flight
                if (mutableCache.getNumPendingTasks() < 1) {
                    // we do want to wait for that last in-flight task to actually finish though:
                    clearInterval(intervalId);
                    reportNormalStatus('finished');
                }
                return;
            }
            // We know there are items in the queue because of the check above, so we assert the type exist
            const itemToRender = queue.shift()!;
            const toCacheKey = (rq: RqKey) => cacheKeyForRequest(itemToRender, rq, dataset, settings);
            try {
                const result = mutableCache.cacheAndUse(
                    requestsForItem(itemToRender, dataset, settings, abort.signal),
                    partial(fancy, itemToRender),
                    toCacheKey,
                    () => reportNormalStatus('progress')
                );
                if (result !== undefined) {
                    // put this cancel callback in a list where we can invoke if something goes wrong
                    // note that it is harmless to cancel a task that was completed
                    taskCancelCallbacks.push(result);
                }
            } catch (err) {
                cleanupOnError(err);
            }
            if (performance.now() - startWorkTime > queueTimeBudgetMS) {
                // used up all our time - leave remaining work for later
                break;
            }
        }
    };
    const interval = setInterval(() => doWorkOnQueue(interval), queueProcessingIntervalMS);

    // return a function to allow our caller to cancel the frame - guaranteed that no settings/data will be
    // touched/referenced after cancellation, unless the author of render() did some super weird bad things
    return {
        cancelFrame: (reason?: string) => {
            taskCancelCallbacks.forEach((cancelMe) => cancelMe());
            abort.abort(new DOMException(reason, 'AbortError'));
            clearInterval(interval);
            reportNormalStatus('cancelled');
        },
    };
}


export function buildAsyncRenderer<Dataset, Item, Settings, RequestKey extends string, CacheKeyType extends string, GpuData extends Record<RequestKey, ReglCacheEntry>>(
    renderer: Renderer<Dataset, Item, Settings, GpuData>) {
    return (data: Dataset, settings: Settings, callback: RenderCallback, target: REGL.Framebuffer2D | null, cache: AsyncDataCache<RequestKey, CacheKeyType, ReglCacheEntry>) => {
        const config: RenderFrameConfig<Dataset, Item, Settings, string, string, ReglCacheEntry, GpuData> = {
            queueProcessingIntervalMS: 33,
            maximumInflightAsyncTasks: 5,
            queueTimeBudgetMS: 16,
            cacheKeyForRequest: renderer.cacheKey,
            dataset: data,
            isPrepared: renderer.isPrepared,
            items: renderer.getVisibleItems(data, settings),
            lifecycleCallback: callback,
            mutableCache: cache,
            renderItem: partial(renderer.renderItem, target),
            requestsForItem: renderer.fetchItemContent,
            settings
        }
        return beginFrame(config)
    }
}