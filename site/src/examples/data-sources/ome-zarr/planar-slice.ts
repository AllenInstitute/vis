import { CachedOmeZarrConnection, type OmeZarrMetadata, type OmeZarrConnection } from '@alleninstitute/vis-omezarr';
import type { ColorMapping } from '../../data-renderers/types';
import type { OptionalTransform, Simple2DTransform } from '../types';
import { CartesianPlane, type OrthogonalCartesianAxes } from '@alleninstitute/vis-geometry';
import type { WebResource } from '@alleninstitute/vis-core';

const workerFactory = () => new Worker(new URL('../../common/loaders/omezarr/fetch.worker.ts', import.meta.url));

export type ZarrSliceConfig = {
    type: 'zarrSliceConfig';
    resource: WebResource;
    plane: OrthogonalCartesianAxes;
    planeParameter: number; // [0:1] eg. if if plane is 'xy' and parameter is 0.5, then we want the slice from the middle of the z-axis
    gamut: ColorMapping;
    rotation?: number;
    trn?: Simple2DTransform | undefined;
};

export type AxisAlignedZarrSlice = {
    type: 'AxisAlignedZarrSlice';
    connection: OmeZarrConnection;
    metadata: OmeZarrMetadata;
    plane: CartesianPlane;
    planeParameter: number;
    gamut: ColorMapping;
    rotation: number;
} & OptionalTransform;

function assembleZarrSlice(
    config: ZarrSliceConfig,
    connection: OmeZarrConnection,
    metadata: OmeZarrMetadata,
): AxisAlignedZarrSlice {
    const { rotation, trn } = config;
    return {
        ...config,
        plane: new CartesianPlane(config.plane),
        type: 'AxisAlignedZarrSlice',
        connection,
        metadata,
        toModelSpace: trn,
        rotation: rotation ?? 0,
    };
}
export function createZarrSlice(config: ZarrSliceConfig): Promise<AxisAlignedZarrSlice> {
    const { resource } = config;
    const connection = new CachedOmeZarrConnection(resource, workerFactory);
    return connection.loadMetadata().then((metadata) => {
        return assembleZarrSlice(config, connection, metadata);
    });
}
