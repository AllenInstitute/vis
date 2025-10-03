// a web-worker which fetches slices of data, decodes them, and returns the result as a flat float32 array, using transferables

import { type AbsolutePath, type RangeQuery, FetchStore } from 'zarrita';
import { logger } from '@alleninstitute/vis-core';
import type { CancelMessage, FetchSliceMessage, TransferrableRequestInit } from './fetch-slice.interface';
import { isCancellationError, isCancelMessage, isFetchSliceMessage } from './fetch-slice.interface';

async function fetchSlice(
    rootUrl: string,
    path: AbsolutePath,
    range: RangeQuery,
    options?: TransferrableRequestInit | undefined,
    abortController?: AbortController | undefined,
): Promise<Uint8Array | undefined> {
    const store = new FetchStore(rootUrl);
    return store.getRange(path, range, { ...(options || {}), signal: abortController?.signal });
}

const abortControllers: Record<string, AbortController> = {};

const handleFetchSlice = (message: FetchSliceMessage) => {
    const { id, payload } = message;
    const { rootUrl, path, range, options } = payload;

    if (id in abortControllers) {
        logger.error('cannot send message: request ID already in use');
        return;
    }

    const abort = new AbortController();
    abortControllers[id] = abort;

    fetchSlice(rootUrl, path, range, options, abort)
        .then((result: Uint8Array | undefined) => {
            const buffer = result?.buffer;
            const options = buffer !== undefined ? { transfer: [buffer] } : {};
            self.postMessage(
                {
                    type: 'fetch-slice-response',
                    id,
                    payload: result?.buffer,
                },
                { ...options },
            );
        })
        .catch((e) => {
            if (!isCancellationError(e)) {
                logger.error('error in slice fetch worker: ', e);
            }
            // can ignore if it is a cancellation error
        });
};

const handleCancel = (message: CancelMessage) => {
    const { id } = message;
    const abortController = abortControllers[id];
    if (!abortController) {
        logger.warn('attempted to cancel a non-existent request');
    } else {
        abortController.abort('cancelled');
    }
};

self.onmessage = async (e: MessageEvent<unknown>) => {
    const { data: message } = e;

    if (isFetchSliceMessage(message)) {
        handleFetchSlice(message);
    } else if (isCancelMessage(message)) {
        handleCancel(message);
    }
};
