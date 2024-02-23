import { keys } from 'lodash';
import { AsyncDataCache } from './dataset-cache';

function promisify<D>(thing: D | Promise<D>) {
    return thing instanceof Promise ? thing : Promise.resolve(thing);
}
function mapify<D>(results: ReadonlyArray<{ key: string; result: D }>): Record<string, D> {
    return results.reduce((attrs, cur) => ({ ...attrs, [cur.key]: cur.result }), {});
}

function renderIfCached<Column, Item, Settings>(
    mutableCache: AsyncDataCache<Column>,
    item: Item,
    settings: Settings,
    abort: AbortSignal,
    render: (item: Item, settings: Settings, columns: Record<string, Column | undefined>) => void,
    requestsForItem: (item: Item, settings: Settings, signal?: AbortSignal) => Record<string, () => Promise<Column>>,
    cacheKeyForRequest: (requestKey: string, item: Item, settings: Settings) => string = (key) => key
): true | Record<string, () => Promise<Column>> {
    const requests = requestsForItem(item, settings, abort);
    const reqs = keys(requests);
    if (
        mutableCache.areKeysAllCached(
            reqs.map((req) => cacheKeyForRequest(req, item, settings))
        )
    ) {
        render(
            item,
            settings,
            mapify(
                reqs.map((key) => ({ key, result: mutableCache.getCached(cacheKeyForRequest(key, item, settings)) }))
            )
        );
        return true;
    }
    return requests;
}
function isAbortError(error: Error) {
    if (error instanceof DOMException) {
        // beyond this, there is a legacy name, legacy code, and semi-experimental non-legacy name?
        // TODO: this info may change, take a look here: https://developer.mozilla.org/en-US/docs/Web/API/DOMException#error_names
        return error.code === DOMException.ABORT_ERR || error.name === 'AbortError';
    }
    return false;
}

function cacheAndRenderItem<Column, Item, Settings>(
    mutableCache: AsyncDataCache<Column>,
    item: Item,
    settings: Settings,
    abort: AbortSignal,
    requestsForItem: (item: Item, settings: Settings, signal?: AbortSignal) => Record<string, () => Promise<Column>>,
    render: (item: Item, settings: Settings, columns: Record<string, Column | undefined>) => void,
    handleError: (err: Error) => void,
    cacheKeyForRequest: (requestKey: string, item: Item, settings: Settings) => string = (key) => key
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
        const reqs = keys(requests);
        const allDataReady = Promise.all(
            reqs.map((key) =>
                promisify(mutableCache.cache(cacheKeyForRequest(key, item, settings), requests[key])).then(
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
export type FrameLifecycle = {
    cancelFrame: (reason?: string) => void;
};
export type NormalStatus = 'begun' | 'finished' | 'cancelled' | 'finished_synchronously' | 'progress';

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
    reportNormalStatus('begun');
    if (queue.length !== items.length) {
        // we did some work, but there's some left
        reportNormalStatus('progress');
    }
    // inFlight is a staging area, for work on the queue
    // using a staging area like this allows us to control the # of promises/fetches that are
    // alive at any one time, which is important if you dont want to strangle the UI thread / browser
    const inFlight: Set<Item> = new Set<Item>();

    // try our best to cleanup if something goes awry
    const cleanupOnError = (err: unknown) => {
        // clear the queue and the staging area (inFlight)
        inFlight.clear();
        queue.splice(0, queue.length);
        // stop fetching
        abort.abort(err);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        clearInterval(interval);
        // pass the error somewhere better:
        lifecycleCallback({ status: 'error', error: err });
    };
    const doWorkOnQueue = () => {
        while (inFlight.size < Math.max(maximumInflightAsyncTasks, 1)) {
            if (queue.length < 1) {
                // we cant add anything to the in-flight staging area, the final task
                // is already in flight
                if (inFlight.size < 1) {
                    // we do want to wait for that last in-flight task to actually finish though:
                    // eslint-disable-next-line @typescript-eslint/no-use-before-define
                    clearInterval(interval);
                    reportNormalStatus('finished');
                }
                return;
            }
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
    const interval = setInterval(doWorkOnQueue, queueProcessingIntervalMS);

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
