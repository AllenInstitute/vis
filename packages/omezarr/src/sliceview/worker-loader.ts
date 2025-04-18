import { logger } from '@alleninstitute/vis-core';
import type { Chunk, Float32 } from 'zarrita';
import { type DehydratedOmeZarrMetadata, OmeZarrMetadata, type OmeZarrShapedDataset } from '../zarr/types'
import { loadSlice, type ZarrRequest } from '../zarr/loading'
// a helper for making a web-worker loader
export type ZarrSliceRequest = {
    id: string;
    type: 'ZarrSliceRequest';
    metadata: DehydratedOmeZarrMetadata;
    req: ZarrRequest;
    level: OmeZarrShapedDataset;
};

export type CancelRequest = {
    type: 'cancel',
    id: string
}

function isSliceRequest(payload: unknown): payload is ZarrSliceRequest {
    return typeof payload === 'object' && payload !== null && 'type' in payload && payload.type === 'ZarrSliceRequest';
}
function isCancellationRequest(payload: unknown): payload is CancelRequest {
    return typeof payload === 'object' && payload !== null && 'type' in payload && payload.type === 'cancel';
}
/**
 * a helper function to initialize a message handler on a webworker,
 * which responds to requests for omezarr slices:
 * messages must be of type MessageEvent<ZarrSliceRequest|CancelRequest>
 * @see ZarrSliceRequest
 * @see CancelRequest
 * @param ctx the "global this" aka self object on a webworker context.
 */
export function makeOmeZarrSliceLoaderWorker(ctx: typeof self) {
    const cancelers: Record<string, AbortController> = {}

    ctx.onmessage = (msg: MessageEvent<unknown>) => {
        const { data } = msg;
        try {
            if (isSliceRequest(data)) {
                const { metadata: dehydratedMetadata, req, level, id } = data;
                const abort = new AbortController();
                cancelers[id] = abort;
                OmeZarrMetadata.rehydrate(dehydratedMetadata).then((metadata) => {
                    loadSlice(metadata, req, level, abort.signal).then((result: { shape: number[]; buffer: Chunk<Float32> }) => {
                        const { shape, buffer } = result;
                        const data = new Float32Array(buffer.data);
                        ctx.postMessage({ type: 'slice', id, shape, data }, { transfer: [data.buffer] });
                    });
                });
            } else if (isCancellationRequest(data)) {
                const { id } = data;
                cancelers[id]?.abort("cancelled");
            }
        } catch (err) {
            logger.error('OME-Zarr fetch onmessage error', err);
        }
    }
}