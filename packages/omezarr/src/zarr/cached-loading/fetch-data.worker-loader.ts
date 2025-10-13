/**
 * A module providing a function that allows third parties to setup a fetch worker. This worker is intended to run as a web
 * worker and fetches a specified chunk of data in a Uint8 (byte) array.
 */

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

const wait = async (ms: number) =>
    new Promise((resolve) => {
        setTimeout(resolve, ms);
    });

const retryAsNeeded = async (
    fnName: string,
    fetchFn: () => Promise<Uint8Array | undefined>,
): Promise<Uint8Array | undefined> => {
    for (let i = 0; i < NUM_RETRIES; i++) {
        try {
            return await fetchFn();
        } catch (e) {
            logger.error(`${fnName} request failed:`, e);
            const hasRetries = i < NUM_RETRIES - 1;
            const message = `${fnName} request ${i < NUM_RETRIES - 1 ? `will retry in ${RETRY_DELAY_MS}ms` : 'has no retries left'}`;
            logger.warn(message);
            if (hasRetries) {
                await wait(RETRY_DELAY_MS);
            }
        }
    }
};

const fetchFile = async (
    rootUrl: string,
    path: AbsolutePath,
    options?: TransferrableRequestInit | undefined,
    abortController?: AbortController | undefined,
): Promise<Uint8Array | undefined> => {
    const store = new FetchStore(rootUrl);
    return retryAsNeeded('get', () => store.get(path, { ...(options || {}), signal: abortController?.signal ?? null }));
};

const fetchSlice = async (
    rootUrl: string,
    path: AbsolutePath,
    range: RangeQuery,
    options?: TransferrableRequestInit | undefined,
    abortController?: AbortController | undefined,
): Promise<Uint8Array | undefined> => {
    const store = new FetchStore(rootUrl);
    return retryAsNeeded('getRange', () =>
        store.getRange(path, range, { ...(options || {}), signal: abortController?.signal ?? null }),
    );
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
