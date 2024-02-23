import { AsyncDataCache } from './dataset-cache';

/**
 * `promisify` turns a value into a promise if it is not already a promise, otherwise it returns the promise as-is.
 * 
 * @param value A value to be turned into a promise, or a promise to be returned as-is
 * @returns A resolved promise with the provided value if it is not a promise, or the provided promise
 */
function promisify<D>(value: D | Promise<D>): Promise<D> {
    return value instanceof Promise ? value : Promise.resolve(value);
}

/**
 * `mapify` turns an array of objects with a `key` and `result` property into a record with the `key` as the property name and the `result` as the value.
 * 
 * @param results The array of objects with a `key` and `result` property to turn into a Record
 * @returns A Record with the `key` as the property name and the `result` as the value from the provided array
 */
function mapify<D>(results: ReadonlyArray<{ key: string; result: D }>): Record<string, D> {
    return results.reduce((attrs, cur) => ({ ...attrs, [cur.key]: cur.result }), {});
}

/**
 * Helper function to determine whether a given error is an AbortError, which occurs when a fetch request is aborted
 * using an AbortController.
 * 
 * Contains logic that checks a deprecated field and error name that are subject to change in the future.
 * 
 * @param error Error to check for the AbortError
 * @returns True if it's an AbortError, false otherwise
 */
function isAbortError(error: Error): boolean {
    if (error instanceof DOMException) {
        // WARNING: We currently check a deprecated field, but the DOMException data may change in the future: 
        // https://developer.mozilla.org/en-US/docs/Web/API/DOMException#error_names
        return error.code === DOMException.ABORT_ERR || error.name === 'AbortError';
    }
    return false;
}

/**
 * Runs the user-provided `render` function if the data for the given `item` is already cached,
 * otherwise it returns a record of requests still in flight.
 * 
 * @param mutableCache The asynchronous cache used to store the data
 * @param item An generic items to render
 * @param settings Flexible object of settings related to the items that are being rendered
 * @param abort The abort signal, used for cancelling requests that no longer need to be finished
 * @param render The main render function that will be called once all data is available
 * @param requestsForItem The function that kicks of the asynchronous requests for a given key, item, and settings
 * @param cacheKeyForRequest A function for generating a cache key for a given request key, item, and settings
 * @returns True if all the data is already cached and the items were rendered, otherwise a record of requests still in flight
 */
function renderIfCached<Column, Item, Settings>(
    mutableCache: AsyncDataCache<Column>,
    item: Item,
    settings: Settings,
    abort: AbortSignal,
    render: (item: Item, settings: Settings, columns: Record<string, Column | undefined>) => void,
    requestsForItem: (item: Item, settings: Settings, signal?: AbortSignal) => Record<string, () => Promise<Column>>,
    cacheKeyForRequest: (requestKey: string, item: Item, settings: Settings) => string
): true | Record<string, () => Promise<Column>> {
    const requests = requestsForItem(item, settings, abort);
    const requestKeys = Object.keys(requests);
    if (
        mutableCache.areKeysAllCached(
            requestKeys.map((req) => cacheKeyForRequest(req, item, settings))
        )
    ) {
        render(
            item,
            settings,
            mapify(
                requestKeys.map((key) => ({ key, result: mutableCache.getCached(cacheKeyForRequest(key, item, settings)) }))
            )
        );
        return true;
    }
    return requests;
}

/**
 * Caches and renders an item.
 * 
 * @param mutableCache The asynchronous cache used to store the data 
 * @param item A generic items to render
 * @param settings Flexible object of settings related to the items that are being rendered
 * @param abort The abort signal, used for cancelling requests that no longer need to be finished 
 * @param requestsForItem The function that kicks of the asynchronous requests for a given key, item, and settings 
 * @param render The main render function that will be called once all data is available
 * @param handleError Error handling function to be called if an error occurs 
 * @param cacheKeyForRequest A function for generating a cache key for a given request key, item, and settings
 * @returns Returns true if the render was performed and a promise if it needed to wait for asynchronous requests to complete before rendering. 
 */
function cacheAndRenderItem<Column, Item, Settings>(
    mutableCache: AsyncDataCache<Column>,
    item: Item,
    settings: Settings,
    abort: AbortSignal,
    requestsForItem: (item: Item, settings: Settings, signal?: AbortSignal) => Record<string, () => Promise<Column>>,
    render: (item: Item, settings: Settings, columns: Record<string, Column | undefined>) => void,
    handleError: (err: Error) => void,
    cacheKeyForRequest: (requestKey: string, item: Item, settings: Settings) => string
): Promise<void> | boolean {
    // although this doesnt make  a ton of sense - lets check the abort signal anyway?
    if (abort.aborted) return false;

    const didRenderOrRequests = renderIfCached(
        mutableCache,
        item,
        settings,
        abort,
        render,
        requestsForItem,
        cacheKeyForRequest
    );
    if (didRenderOrRequests !== true) {
        // an async request(s) will need to happen first:
        const requests = didRenderOrRequests;
        const allDataReady = Promise.all(
            Object.entries(requests).map(([key, promises]) =>
                promisify(mutableCache.cache(cacheKeyForRequest(key, item, settings), promises)).then(
                    (result) => ({
                        key,
                        result,
                    })
                )
            )
        );
        return allDataReady
            .then((results) => {
                if (!abort.aborted) {
                    render(item, settings, mapify(results));
                }
            })
            .catch((err) => {
                // abort errors are considered very normal for our use case, so only handle an error if its NOT an AbortError
                if (!isAbortError(err)) {
                    handleError(err);
                }
            });
    }
    return true;
}

/**
 * FrameLifecycle type that defines the functions a user can call to interact with the frame lifecycle.
 * 
 * Currently only supports `cancelFrame` to allow the user to cancel the frame on an ad-hoc basis.
 */
export type FrameLifecycle = {
    cancelFrame: (reason?: string) => void;
};

/**
 * NormalStatus type that defines the possible non-error statuses for a frame.
 * 
 * `begun` - The frame has started running
 * 
 * `finished` - The frame has finished running
 * 
 * `cancelled` - The frame was cancelled by the user
 * 
 * `finished_synchronously` - The frame finished synchronously
 * 
 * `progress` - The frame is still running and has not finished
 */
export type NormalStatus = 'begun' | 'finished' | 'cancelled' | 'finished_synchronously' | 'progress';

/**
 * `beingLongRunningFrame` starts a long-running frame that will render a list of items asynchronously based on
 * the provided data, settings, and rendering functions.
 * 
 * The frame will run until all items have been rendered, or until the user cancels the frame. It will update the
 * provided cache so that the data is available for other frames that may be running. This function is safe to call
 * multiple times in different areas of your code, as it will complete quickly if/when all the data is already cached and available.
 * 
 * You can listen for the status of the frame, allowing you to make decisions based on the progress of the frame.
 * 
 * In addition, you can cancel the frame at any time, which will stop the frame from running and prevent any further
 * rendering or data fetching from occurring.
 * 
 * @param maximumInflightAsyncTasks The maximum number of async tasks to run at once.
 * @param queueProcessingIntervalMS The length of time to wait between processing the queue in milliseconds.
 * @param items An array of generic items to render
 * @param mutableCache The asynchronous cache used to store the data
 * @param settings Flexible object of settings related to the items that are being rendered
 * @param requestsForItem The function that kicks of the asynchronous requests for a given key, item, and settings
 * @param render The main render function that will be called once all data is available
 * @param lifecycleCallback Callback function so they user can be notified of the status of the frame
 * @param cacheKeyForRequest A function for generating a cache key for a given request key, item, and settings. Defaults to the request key if not provided.
 * @returns A FrameLifecycle object with a cancelFrame function to allow users to cancel the frame when necessary
 */
export function beginLongRunningFrame<Column, Item, Settings>(
    maximumInflightAsyncTasks: number,
    queueProcessingIntervalMS: number,
    items: Item[],
    mutableCache: AsyncDataCache<Column>,
    settings: Settings,
    requestsForItem: (item: Item, settings: Settings, signal?: AbortSignal) => Record<string, () => Promise<Column>>,
    render: (item: Item, settings: Settings, columns: Record<string, Column | undefined>) => void,
    lifecycleCallback: (event: { status: NormalStatus } | { status: 'error'; error: unknown }) => void,
    cacheKeyForRequest: (requestKey: string, item: Item, settings: Settings) => string = (key) => key
): FrameLifecycle {
    const abort = new AbortController();
    const reportNormalStatus = (status: NormalStatus) => {
        lifecycleCallback({ status });
    };
    // all items that we cant finish synchronously go in this queue:
    const queue: Item[] = [];

    items.forEach((item) => {
        if (
            // note: explicit check for true here is important - this function is kinda weird and gross, and either returns true | record<string,promises> which would be 'truthy'
            renderIfCached(mutableCache, item, settings, abort.signal, render, requestsForItem, cacheKeyForRequest) !==
            true
        ) {
            queue.push(item);
        } // else its already rendered!
    });

    if (queue.length === 0) {
        // we did all the work - it was already cached
        reportNormalStatus('finished_synchronously');
        return { cancelFrame: () => {} };
    }
    if (queue.length === items.length) {
        // This is the first time the frame has been running
        reportNormalStatus('begun');
    } else {
        // We did some work, but there's some left
        reportNormalStatus('progress');
    }
    // inFlight is a staging area, for work on the queue
    // using a staging area like this allows us to control the # of promises/fetches that are
    // alive at any one time, which is important if you dont want to strangle the UI thread / browser
    const inFlight = new Set<Item>();

    const doWorkOnQueue = (intervalId: number) => {
        // try our best to cleanup if something goes awry
        const cleanupOnError = (err: unknown) => {
            // clear the queue and the staging area (inFlight)
            inFlight.clear();
            queue.splice(0, queue.length);
            // stop fetching
            abort.abort(err);
            clearInterval(intervalId);
            // pass the error somewhere better:
            lifecycleCallback({ status: 'error', error: err });
        };

        while (inFlight.size < Math.max(maximumInflightAsyncTasks, 1)) {
            if (queue.length < 1) {
                // we cant add anything to the in-flight staging area, the final task
                // is already in flight
                if (inFlight.size < 1) {
                    // we do want to wait for that last in-flight task to actually finish though:
                    clearInterval(intervalId);
                    reportNormalStatus('finished');
                }
                return;
            }
            // We know there are items in the queue because of the check above, so we assert the type exist
            const itemToRender = queue.shift()!;
            try {
                const result = cacheAndRenderItem(
                    mutableCache,
                    itemToRender,
                    settings,
                    abort.signal,
                    requestsForItem,
                    render,
                    cleanupOnError,
                    cacheKeyForRequest
                );
                if (result instanceof Promise) {
                    inFlight.add(itemToRender);
                    const cleanup = () => inFlight.delete(itemToRender);
                    result.then(() => reportNormalStatus('progress')).finally(cleanup);
                } else if (!result) {
                    // if result was false, then this frame has been cancelled -
                    // this should be impossible, as the thing that cancels frames also clears the interval that would
                    // call the function we are currently in.
                    // stop now anyway, just in case
                    return;
                }
                // in the event that result was true, that means the cache had all the data it needed, and
                // could finish the rendering synchronously. this should also be impossible, but if it does happen
                // we can go ahead pop another item from the queue and start it
            } catch (err) {
                cleanupOnError(err);
            }
        }
    };
    const interval = setInterval(() => doWorkOnQueue(interval), queueProcessingIntervalMS);

    // return a function to allow our caller to cancel the frame - guaranteed that no settings/data will be
    // touched/referenced after cancellation, unless the author of render() did some super weird bad things
    return {
        cancelFrame: (reason?: string) => {
            abort.abort(new DOMException(reason, 'AbortError'));
            clearInterval(interval);
            reportNormalStatus('cancelled');
        },
    };
}
