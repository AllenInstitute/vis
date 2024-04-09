import { partial, partialRight } from 'lodash';
import { AsyncDataCache } from './dataset-cache';

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
 * @param requestsForItem a function which returns a mapping of "columns" to async functions that would fetch the column
 * @param render The main render function that will be called once all data is available
 * @param lifecycleCallback Callback function so they user can be notified of the status of the frame
 * @param cacheKeyForRequest A function for generating a cache key for a given request key, item, and settings. Defaults to the request key if not provided.
 * @param queueTimeBudgetMS the maximum ammount of time (milliseconds) to spend rendering before yeilding to allow other work to run - rendering will resume next frame (@param queueProcessingIntervalMS)
 * @returns A FrameLifecycle object with a cancelFrame function to allow users to cancel the frame when necessary
 */
export function beginLongRunningFrame<Column, Item, Settings>(
  maximumInflightAsyncTasks: number,
  queueProcessingIntervalMS: number,
  items: Item[],
  mutableCache: AsyncDataCache<string, string, Column>,
  settings: Settings,
  requestsForItem: (item: Item, settings: Settings, signal?: AbortSignal) => Record<string, () => Promise<Column>>,
  render: (item: Item, settings: Settings, columns: Record<string, Column | undefined>) => void,
  lifecycleCallback: (event: { status: NormalStatus } | { status: 'error'; error: unknown }) => void,
  cacheKeyForRequest: (requestKey: string, item: Item, settings: Settings) => string = (key) => key,
  queueTimeBudgetMS: number = queueProcessingIntervalMS / 3
): FrameLifecycle {
  const abort = new AbortController();
  const reportNormalStatus = (status: NormalStatus) => {
    lifecycleCallback({ status });
  };
  const queue: Item[] = [];
  const taskCancelCallbacks: Array<() => void> = [];

  // when starting a frame, we greedily attempt to render any tasks that are already in the cache
  // however, if there is too much overhead (or too many tasks) we would risk hogging the main thread
  // thus - obey the limit (its a soft limit)
  const startTime = performance.now();

  for (let i = 0; i < items.length; i += 1) {
    const itemToRender = items[i];
    const requestFns = requestsForItem(itemToRender, settings, abort.signal)
    const cacheKeys = Object.keys(requestFns).map(key => cacheKeyForRequest(key, itemToRender, settings));
    if (mutableCache.areKeysAllCached(cacheKeys)) {
      const result = mutableCache.cacheAndUse(
        requestFns, partial(render, itemToRender, settings), partialRight(cacheKeyForRequest, itemToRender, settings)
      );
      if (result !== undefined) {
        // this is a problem - the cache reported that all the keys are in the cache, however this result is a cancellation callback,
        // which indicates that the item could not be rendered right away, which should be impossible...
        // TODO
        taskCancelCallbacks.push(result);
      }
    } else {
      // areKeysAllCached returned false - enqueue for later
      queue.push(itemToRender)
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
      taskCancelCallbacks.forEach(cancelMe => cancelMe());
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
      try {
        const result = mutableCache.cacheAndUse(
          requestsForItem(itemToRender, settings, abort.signal), partial(render, itemToRender, settings), partialRight(cacheKeyForRequest, itemToRender, settings)
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
      taskCancelCallbacks.forEach(cancelMe => cancelMe());
      abort.abort(new DOMException(reason, 'AbortError'));
      clearInterval(interval);
      reportNormalStatus('cancelled');
    },
  };
}
