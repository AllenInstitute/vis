import type { OmeZarrMetadata, ZarrRequest } from '@alleninstitute/vis-omezarr';
import { logger } from '@alleninstitute/vis-core';
import { uniqueId } from 'lodash';
import type { ZarrSliceRequest } from './types';

type PromisifiedMessage = {
    requestCacheKey: string;
    resolve: (t: Slice) => void;
    reject: (reason: unknown) => void;
    promise?: Promise<Slice> | undefined;
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
export class SliceWorkerPool {
    private workers: Worker[];
    private promises: Record<string, PromisifiedMessage>;
    private which: number;
    constructor(size: number) {
        this.workers = new Array(size);
        for (let i = 0; i < size; i++) {
            this.workers[i] = new Worker(new URL('./fetchSlice.worker.ts', import.meta.url), { type: 'module' });
            this.workers[i].onmessage = (msg) => this.handleResponse(msg);
        }
        this.promises = {};
        this.which = 0;
    }

    handleResponse(msg: MessageEvent<unknown>) {
        const { data: payload } = msg;
        if (isExpectedResult(payload)) {
            const prom = this.promises[payload.id];
            if (prom) {
                const { data, shape } = payload;
                prom.resolve({ data, shape });
                delete this.promises[payload.id];
            }
        }
    }
    private roundRobin() {
        this.which = (this.which + 1) % this.workers.length;
    }
    requestSlice(metadata: OmeZarrMetadata, req: ZarrRequest, layerIndex: number) {
        const reqId = uniqueId('rq');
        const cacheKey = JSON.stringify({ url: metadata.url, req, layerIndex });
        const level = metadata.getShapedDataset(layerIndex, 0);
        if (!level) {
            const message = `cannot request slice: invalid layer index: ${layerIndex}`;
            logger.error(message);
            throw new Error(message);
        }
        // TODO caching I guess...
        const eventually = new Promise<Slice>((resolve, reject) => {
            this.promises[reqId] = {
                requestCacheKey: cacheKey,
                resolve,
                reject,
                promise: undefined, // ill get added to the map once I am fully defined!
            };
            const message: ZarrSliceRequest = {
                id: reqId,
                type: 'ZarrSliceRequest',
                metadata: metadata.dehydrate(),
                req,
                level,
            };
            this.workers[this.which].postMessage(message);
            this.roundRobin();
        });
        this.promises[reqId].promise = eventually;
        return eventually;
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
