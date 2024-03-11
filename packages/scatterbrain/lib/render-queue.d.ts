import { AsyncDataCache } from './dataset-cache';
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
export declare function beginLongRunningFrame<Column, Item, Settings>(maximumInflightAsyncTasks: number, queueProcessingIntervalMS: number, items: Item[], mutableCache: AsyncDataCache<Column>, settings: Settings, requestsForItem: (item: Item, settings: Settings, signal?: AbortSignal) => Record<string, () => Promise<Column>>, render: (item: Item, settings: Settings, columns: Record<string, Column | undefined>) => void, lifecycleCallback: (event: {
    status: NormalStatus;
} | {
    status: 'error';
    error: unknown;
}) => void, cacheKeyForRequest?: (requestKey: string, item: Item, settings: Settings) => string): FrameLifecycle;
