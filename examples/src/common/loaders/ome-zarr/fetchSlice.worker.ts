import { type ZarrDataset, type ZarrRequest, getSlice } from '@alleninstitute/vis-omezarr';
import { logger } from '@alleninstitute/vis-scatterbrain';
// a web-worker which fetches slices of data, decodes them, and returns the result as a flat float32 array, using transferables
import type { Chunk } from 'zarrita';

const ctx = self;
type ZarrSliceRequest = {
    id: string;
    type: 'ZarrSliceRequest';
    metadata: ZarrDataset;
    req: ZarrRequest;
    layerIndex: number;
};
function isSliceRequest(payload: unknown): payload is ZarrSliceRequest {
    return typeof payload === 'object' && payload !== null && 'type' in payload && payload.type === 'ZarrSliceRequest';
}
ctx.onmessage = (msg: MessageEvent<unknown>) => {
    const { data } = msg;
    try {
        if (isSliceRequest(data)) {
            const { metadata, req, layerIndex, id } = data;
            getSlice(metadata, req, layerIndex).then((result: { shape: number[]; buffer: Chunk<'float32'> }) => {
                const { shape, buffer } = result;
                const flaots = new Float32Array(buffer.data);
                ctx.postMessage({ type: 'slice', id, shape, data: flaots }, { transfer: [flaots.buffer] });
            });
        }
    } catch (err) {
        logger.error('OMEZarr fetch onmessage error', err);
    }
};
