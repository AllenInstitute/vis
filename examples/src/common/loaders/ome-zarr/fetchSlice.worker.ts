import { type OmeZarrMetadata, type OmeZarrShapedDataset, type ZarrRequest, loadSlice } from '@alleninstitute/vis-omezarr';
import { logger } from '@alleninstitute/vis-scatterbrain';
import type { Chunk, Float32 } from 'zarrita';

// a web-worker which fetches slices of data, decodes them, and returns the result as a flat float32 array, using transferables

const ctx = self;

type ZarrSliceRequest = {
    id: string;
    type: 'ZarrSliceRequest';
    metadata: OmeZarrMetadata;
    req: ZarrRequest;
    level: OmeZarrShapedDataset;
};

function isSliceRequest(payload: unknown): payload is ZarrSliceRequest {
    return typeof payload === 'object' && payload !== null && 'type' in payload && payload.type === 'ZarrSliceRequest';
}

ctx.onmessage = (msg: MessageEvent<unknown>) => {
    const { data } = msg;
    try {
        if (isSliceRequest(data)) {
            const { metadata, req, level, id } = data;
            loadSlice(metadata, req, level).then((result: { shape: number[]; buffer: Chunk<Float32> }) => {
                const { shape, buffer } = result;
                const data = new Float32Array(buffer.data);
                ctx.postMessage({ type: 'slice', id, shape, data }, { transfer: [data.buffer] });
            });
        }
    } catch (err) {
        logger.error('OME-Zarr fetch onmessage error', err);
    }
};
