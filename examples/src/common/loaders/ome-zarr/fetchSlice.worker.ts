import { loadSlice, makeOmeZarrSliceLoaderWorker, OmeZarrMetadata } from '@alleninstitute/vis-omezarr';
import { logger } from '@alleninstitute/vis-core';
import type { Chunk, Float32 } from 'zarrita';
import { isCancellationRequest, isSliceRequest } from './types';
// a web-worker which fetches slices of data, decodes them, and returns the result as a flat float32 array, using transferables

const ctx = self;
// const cancelers: Record<string, AbortController> = {}

// ctx.onmessage = (msg: MessageEvent<unknown>) => {
//     const { data } = msg;
//     try {
//         if (isSliceRequest(data)) {
//             const { metadata: dehydratedMetadata, req, level, id } = data;
//             const abort = new AbortController();
//             cancelers[id] = abort;
//             OmeZarrMetadata.rehydrate(dehydratedMetadata).then((metadata) => {
//                 loadSlice(metadata, req, level, abort.signal).then((result: { shape: number[]; buffer: Chunk<Float32> }) => {
//                     const { shape, buffer } = result;
//                     const data = new Float32Array(buffer.data);
//                     ctx.postMessage({ type: 'slice', id, shape, data }, { transfer: [data.buffer] });
//                 });
//             });
//         } else if (isCancellationRequest(data)) {
//             const { id } = data;
//             cancelers[id]?.abort("cancelled");
//         }
//     } catch (err) {
//         logger.error('OME-Zarr fetch onmessage error', err);
//     }
// };
makeOmeZarrSliceLoaderWorker(ctx);
