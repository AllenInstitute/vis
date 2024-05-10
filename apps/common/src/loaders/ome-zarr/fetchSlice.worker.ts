
// a web-worker which fetches slices of data, decodes them, and returns the result as a flat float32 array, using transferables
import type { NestedArray, TypedArray } from 'zarr'
import { getSlice, type ZarrDataset, type ZarrRequest } from "./zarr-data";

const ctx = self;
type ZarrSliceRequest = {
    id: string;
    type: 'ZarrSliceRequest'
    metadata: ZarrDataset
    req: ZarrRequest,
    layerIndex: number
}
function isSliceRequest(payload: any): payload is ZarrSliceRequest {
    return typeof payload === 'object' && payload['type'] === 'ZarrSliceRequest';
}
ctx.onmessage = (msg: MessageEvent<unknown>) => {
    const { data } = msg;
    if (isSliceRequest(data)) {
        const { metadata, req, layerIndex, id } = data;
        getSlice(metadata, req, layerIndex).then((result: {
            shape: number[],
            buffer: NestedArray<TypedArray>
        }) => {
            const { shape, buffer } = result;
            const R = new Float32Array(buffer.flatten());
            ctx.postMessage({ type: 'slice', id, shape, data: R }, { transfer: [R.buffer] })
        })
    }
}