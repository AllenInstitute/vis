// a web-worker which fetches slices of data, decodes them, and returns the result as a flat float32 array, using transferables

import { HEARTBEAT_RATE_MS, logger } from '@alleninstitute/vis-core';
import { type AbsolutePath, FetchStore, type RangeQuery } from 'zarrita';
import type { CancelMessage, FetchMessage, TransferrableRequestInit } from './fetch-data.interface';
import {
    FETCH_RESPONSE_MESSAGE_TYPE,
    isCancellationError,
    isCancelMessage,
    isFetchMessage,
} from './fetch-data.interface';

const NUM_RETRIES = 2;
const RETRY_DELAY_MS = 500;

const fetchFile = async (
    rootUrl: string,
    path: AbsolutePath,
    options?: TransferrableRequestInit | undefined,
    abortController?: AbortController | undefined,
): Promise<Uint8Array | undefined> => {
    const store = new FetchStore(rootUrl);
    return store.get(path, { ...(options || {}), signal: abortController?.signal ?? null });
};

const fetchSlice = async (
    rootUrl: string,
    path: AbsolutePath,
    range: RangeQuery,
    options?: TransferrableRequestInit | undefined,
    abortController?: AbortController | undefined,
): Promise<Uint8Array | undefined> => {
    const store = new FetchStore(rootUrl);
    const wait = async (ms: number) =>
        new Promise((resolve) => {
            setTimeout(resolve, ms);
        });
    for (let i = 0; i < NUM_RETRIES; i++) {
        try {
            return await store.getRange(path, range, { ...(options || {}), signal: abortController?.signal ?? null });
        } catch (e) {
            logger.error('getRange request failed:', e);
            const hasRetries = i < NUM_RETRIES - 1;
            const message = `getRange request ${i < NUM_RETRIES - 1 ? `will retry in ${RETRY_DELAY_MS}ms` : 'has no retries left'}`;
            logger.warn(message);
            if (hasRetries) {
                await wait(RETRY_DELAY_MS);
            }
        }
    }
    return undefined;
};

const handleFetch = (message: FetchMessage, abortControllers: Record<string, AbortController>) => {
    const { id, payload } = message;
    const { rootUrl, path, range, options } = payload;

    if (id in abortControllers) {
        logger.error('cannot send message: request ID already in use');
        return;
    }

    const abort = new AbortController();
    abortControllers[id] = abort;
    abort.signal.addEventListener('abort', () => {
        console.error('intentional abort ', id)
        if (!abortControllers[id]) {
            console.log('however it seems to have been resolved too soon')
        }
    })
    const fetchFn =
        range !== undefined
            ? () => fetchSlice(rootUrl, path, range, options, abort)
            : () => fetchFile(rootUrl, path, options, abort);

    fetchFn()
        .then((result: Uint8Array | undefined) => {
            const buffer = result?.buffer;
            const options = buffer !== undefined ? { transfer: [buffer] } : {};
            self.postMessage(
                {
                    type: FETCH_RESPONSE_MESSAGE_TYPE,
                    id,
                    payload: result?.buffer,
                },
                { ...options },
            );
        }, (reason) => {
            console.warn('worker fetch rejected: ', reason)
        })
        .catch((e) => {
            if (!isCancellationError(e)) {
                logger.error('error in slice fetch worker: ', e);
            }
            // can ignore if it is a cancellation error
        });
};

const handleCancel = (message: CancelMessage, abortControllers: Record<string, AbortController>) => {
    const { id } = message;
    const abortController = abortControllers[id];
    if (!abortController) {
        logger.warn('attempted to cancel a non-existent request');
    } else {
        abortController.abort('cancelled');
    }
};

const startHeartbeat = () =>
    setInterval(() => {
        self.postMessage({ type: 'heartbeat' });
    }, HEARTBEAT_RATE_MS);

const setupOnMessage = () => {
    const abortControllers: Record<string, AbortController> = {};
    const onmessage = async (e: MessageEvent<unknown>) => {
        const { data: message } = e;

        if (isFetchMessage(message)) {
            handleFetch(message, abortControllers);
        } else if (isCancelMessage(message)) {
            handleCancel(message, abortControllers);
        }
    };
    return onmessage;
};

export const setupFetchDataWorker = (ctx: typeof self) => {
    ctx.onmessage = setupOnMessage();
    return { startHeartbeat };
};
