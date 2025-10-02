import type { Decoder, OmeZarrMetadata, OmeZarrShapedDataset, ZarrRequest } from '@alleninstitute/vis-omezarr';
import type { ZarrSliceRequest } from '../types';
import { v4 as uuidv4 } from 'uuid';

type PromiseResolve<T> = (t: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type PromiseReject = (reason: any) => void;


type MessagePromise = {
    requestCacheKey: string;
    resolve: PromiseResolve<Slice>;
    reject: PromiseReject;
    promise: Promise<Slice>;
};

type ExpectedResultSlice = {
    type: 'slice';
    id: string;
} & Slice;
type Slice = {
    data: Float32Array;
    shape: number[];
};

function isExpectedResult(obj: unknown): obj is ExpectedResultSlice {
    return typeof obj === 'object' && obj !== null && 'type' in obj && obj.type === 'slice';
}

export class WorkerPool {
    #workers: Worker[];
    #promises: Record<string, MessagePromise>;
    #which: number;

    constructor(size: number, workerModule: URL) {
        this.#workers = new Array(size);
        for (let i = 0; i < size; i++) {
            this.#workers[i] = new Worker(workerModule, { type: 'module' });
            this.#workers[i].onmessage = (msg) => this.#handleResponse(msg);
        }
        this.#promises = {};
        this.#which = 0;
    }

    #handleResponse(msg: MessageEvent<unknown>) {
        const { data: payload } = msg;
        if (isExpectedResult(payload)) {
            const prom = this.#promises[payload.id];
            if (prom) {
                const { data, shape } = payload;
                prom.resolve({ data, shape });
                delete this.#promises[payload.id];
            }
        }
    }

    #roundRobin() {
        this.#which = (this.#which + 1) % this.#workers.length;
    }

    submitRequest() {
        

        this.#roundRobin();
    }

    #sendMessageToWorker<T extends { type: string }>(workerIndex: number, message: T) {
        const worker = this.#workers[workerIndex];
        if (worker === undefined) {
            throw new Error('cannot send message to worker: index invalid');
        }
        worker.postMessage(message);
    }

    #createMessagePromise(cacheKey: string): MessagePromise {
        const { promise, resolve, reject } = Promise.withResolvers<Slice>();

        return {
            requestCacheKey: cacheKey,
            resolve,
            reject,
            promise,
        };
    }

    requestSlice(metadata: OmeZarrMetadata, req: ZarrRequest, level: OmeZarrShapedDataset, signal?: AbortSignal) {
        const reqId = `rq${uuidv4()}`;
        const cacheKey = JSON.stringify({ url: metadata.url, req, level });
        const selectedWorker = this.#which;

        const message: ZarrSliceRequest = {
            id: reqId,
            type: 'ZarrSliceRequest',
            metadata: metadata.dehydrate(),
            req,
            level,
        };

        const messagePromise = this.#createMessagePromise(cacheKey);
        this.#promises[reqId] = messagePromise;

        if (signal) {
            signal.onabort = () => {
                this.#sendMessageToWorker(selectedWorker, { type: 'cancel', id: reqId });
                messagePromise.reject('cancelled');
            };
        }

        this.#sendMessageToWorker(selectedWorker, message);
        this.#roundRobin();

        return messagePromise.promise;
    }
}

// a singleton...
let slicePool: SliceWorkerPool;
export function getSlicePool() {
    if (!slicePool) {
        slicePool = new SliceWorkerPool(6);
    }
    return slicePool;
}

export const multithreadedDecoder: Decoder = (metadata, req, level: OmeZarrShapedDataset, signal?: AbortSignal) => {
    return getSlicePool().requestSlice(metadata, req, level, signal);
};
