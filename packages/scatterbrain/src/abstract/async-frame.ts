import { partial } from 'lodash';
import { AsyncDataCache } from '../dataset-cache';
import type { ReglCacheEntry, Renderer } from './types';
import type REGL from 'regl';

/// THIS file is a copy of render-queue, but with some changes made that I hope will make the idea of beginLongRunningFrame easier to use ///
// TODO: delete (or make deprecated) the old one
// the most obvious difference: a config parameter, rather than a function over 11 arguments!
// the second difference is more subtle - you'll notice an "isPrepared" parameter, which we use to deal with some competing interests
// 1. it would be nice to write render functions that use objects (see the type GpuData) rather than records from strings to the data we want
// 2. this desire is complicated by our desire to share GPU-resident data if possible! because different renderers might want different "objects" to render which *could* all share raw gpu resources
//    it becomes very difficult to express the types of such a system statically.
// SO: by having render-authors provide a type-guard, we can safely (provided the guard is reasonable) cast a record<string, gpuStuff> to a nice, friendly object 'GpuData' at runtime!
// note also: the cache is set up to dissuade users from holding on to references to data in the cache - its still possible of course (this is typescript!) but the whole system is set up to accept
// a generic useWithCache(...) function, which also makes this tricky

export type FrameLifecycle = {
    cancelFrame: (reason?: string) => void;
};

export type FrameBegin = { status: 'begin' };
export type FrameProgress<Dataset, Item> = {
    status: 'progress';
    dataset: Dataset;
    renderedItems: ReadonlyArray<Item>;
};
export type FrameCancelled = { status: 'cancelled' };
export type FrameFinished = { status: 'finished' };
export type FrameError = { status: 'error'; error: unknown };

export type AsyncFrameEvent<Dataset, Item> =
    | FrameBegin
    | FrameProgress<Dataset, Item>
    | FrameFinished
    | FrameCancelled
    | FrameError;
export type RenderCallback<Dataset, Item> = (event: AsyncFrameEvent<Dataset, Item>) => void;

export type RenderFrameConfig<
    Dataset,
    Item,
    Settings,
    RqKey extends string,
    CacheKey extends string,
    CacheEntryType,
    GpuData extends Record<RqKey, CacheEntryType>,
> = {
    maximumInflightAsyncTasks: number; // Maximum number of in-flight fetches to run at any time for this frame
    queueProcessingIntervalMS: number; // The length of time to wait between processing the queue in milliseconds.
    queueTimeBudgetMS: number; // Spend at most (soft limit) this many milliseconds working on the queue at a time
    items: Item[]; // the items to render
    mutableCache: AsyncDataCache<RqKey, CacheKey, CacheEntryType>; // the cached results of fetching item contents
    dataset: Dataset; // the dataset comprised of all Items
    settings: Settings; // the settings (anything that is the same for the entire frame, think colors, point-sizes etc.)
    requestsForItem: (
        item: Item,
        dataset: Dataset,
        settings: Settings,
        signal?: AbortSignal,
    ) => Record<RqKey, () => Promise<CacheEntryType>>;
    lifecycleCallback: RenderCallback<Dataset, Item>;
    cacheKeyForRequest: (item: Item, requestKey: RqKey, dataset: Dataset, settings: Settings) => CacheKey;
    isPrepared: (cacheData: Record<RqKey, CacheEntryType | undefined>) => cacheData is GpuData;
    renderItem: (item: Item, dataset: Dataset, settings: Settings, gpuData: GpuData) => void;
};

export function beginFrame<
    Dataset,
    Item,
    Settings,
    RqKey extends string,
    CacheKey extends string,
    CacheEntryType,
    GpuData extends Record<RqKey, CacheEntryType>,
>(config: RenderFrameConfig<Dataset, Item, Settings, RqKey, CacheKey, CacheEntryType, GpuData>): FrameLifecycle {
    const {
        maximumInflightAsyncTasks,
        queueTimeBudgetMS,
        queueProcessingIntervalMS,
        cacheKeyForRequest,
        settings,
        items,
        mutableCache,
        lifecycleCallback,
        renderItem,
        requestsForItem,
        isPrepared,
        dataset,
    } = config;

    const abort = new AbortController();
    const queue: Item[] = [...items];
    const taskCancelCallbacks: Array<() => void> = [];
    const renderItemWrapper = (itemToRender: Item, maybe: Record<RqKey, CacheEntryType | undefined>) => {
        if (isPrepared(maybe) && !abort.signal.aborted) {
            renderItem(itemToRender, dataset, settings, maybe);
        }
    };
    const reportStatus = (event: AsyncFrameEvent<Dataset, Item>, synchronous: boolean) => {
        if (event.status !== 'cancelled' && abort.signal.aborted) {
            return;
        }
        // we want to report our status, however the flow of events can be confusing -
        // our callers anticipate an asynchronous (long running) frame to be started,
        // but there are scenarios in which the whole thing is completely synchronous
        // callers who are scheduling things may be surprised that their frame finished
        // before the code that handles it appears to start. thus, we make the entire lifecycle callback
        // system async, to prevent surprises.
        if (synchronous) {
            lifecycleCallback(event);
        } else {
            Promise.resolve().then(() => lifecycleCallback(event));
        }
    };

    const doWorkOnQueue = (intervalId: number, synchronous: boolean = false) => {
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
            reportStatus({ status: 'error', error: err }, synchronous);
        };
        while (mutableCache.getNumPendingTasks() < Math.max(maximumInflightAsyncTasks, 1)) {
            // We know there are items in the queue because of the check above, so we assert the type exist
            const itemToRender = queue.shift();
            if (!itemToRender) {
                break;
            }
            const toCacheKey = (rq: RqKey) => cacheKeyForRequest(itemToRender, rq, dataset, settings);
            try {
                const result = mutableCache.cacheAndUse(
                    requestsForItem(itemToRender, dataset, settings, abort.signal),
                    partial(renderItemWrapper, itemToRender),
                    toCacheKey,
                    () => reportStatus({ status: 'progress', dataset, renderedItems: [itemToRender] }, synchronous),
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
        if (queue.length < 1) {
            // we cant add anything to the in-flight staging area, the final task
            // is already in flight
            if (mutableCache.getNumPendingTasks() < 1) {
                // we do want to wait for that last in-flight task to actually finish though:
                clearInterval(intervalId);
                reportStatus({ status: 'finished' }, synchronous);
            }
            return;
        }
    };

    reportStatus({ status: 'begin' }, true);
    const interval = setInterval(() => doWorkOnQueue(interval), queueProcessingIntervalMS);
    if (queue.length > 0) {
        doWorkOnQueue(interval, false);
    }
    return {
        cancelFrame: (reason?: string) => {
            abort.abort(new DOMException(reason, 'AbortError'));
            taskCancelCallbacks.forEach((cancelMe) => cancelMe());
            clearInterval(interval);
            reportStatus({ status: 'cancelled' }, true);
        },
    };
}

export function buildAsyncRenderer<
    Dataset,
    Item,
    Settings,
    SemanticKey extends string,
    CacheKeyType extends string,
    GpuData extends Record<SemanticKey, ReglCacheEntry>,
>(renderer: Renderer<Dataset, Item, Settings, GpuData>) {
    return (
        data: Dataset,
        settings: Settings,
        callback: RenderCallback<Dataset, Item>,
        target: REGL.Framebuffer2D | null,
        cache: AsyncDataCache<SemanticKey, CacheKeyType, ReglCacheEntry>,
    ) => {
        const { renderItem, isPrepared, cacheKey, fetchItemContent, getVisibleItems } = renderer;
        const config: RenderFrameConfig<Dataset, Item, Settings, string, string, ReglCacheEntry, GpuData> = {
            queueProcessingIntervalMS: 33,
            maximumInflightAsyncTasks: 5,
            queueTimeBudgetMS: 16,
            cacheKeyForRequest: cacheKey,
            dataset: data,
            isPrepared: isPrepared,
            items: getVisibleItems(data, settings),
            lifecycleCallback: callback,
            mutableCache: cache,
            renderItem: partial(renderItem, target),
            requestsForItem: fetchItemContent,
            settings,
        };
        return beginFrame(config);
    };
}
