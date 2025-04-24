import type { DehydratedOmeZarrMetadata, OmeZarrShapedDataset, ZarrRequest } from '@alleninstitute/vis-omezarr';

export type ZarrSliceRequest = {
    id: string;
    type: 'ZarrSliceRequest';
    metadata: DehydratedOmeZarrMetadata;
    req: ZarrRequest;
    level: OmeZarrShapedDataset;
};

export type CancelRequest = {
    type: 'cancel';
    id: string;
};

export function isSliceRequest(payload: unknown): payload is ZarrSliceRequest {
    return typeof payload === 'object' && payload !== null && 'type' in payload && payload.type === 'ZarrSliceRequest';
}
export function isCancellationRequest(payload: unknown): payload is CancelRequest {
    return typeof payload === 'object' && payload !== null && 'type' in payload && payload.type === 'cancel';
}
