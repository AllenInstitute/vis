import { type OmeZarrConnection, CachedOmeZarrConnection, type OmeZarrMetadata } from '@alleninstitute/vis-omezarr';
import type { ColorMapping } from '../../data-renderers/types';
import type { OptionalTransform, Simple2DTransform } from '../types';
import type { WebResource } from '@alleninstitute/vis-core';
import type { OrthogonalCartesianAxes } from '@alleninstitute/vis-geometry';

const workerFactory = () => new Worker(new URL('../../common/loaders/omezarr/fetch.worker.ts', import.meta.url));

export type ZarrSliceGridConfig = {
    type: 'ZarrSliceGridConfig';
    resource: WebResource;
    plane: OrthogonalCartesianAxes;
    slices: number; // divide this volume into this many slices, and arrange them in a grid.
    gamut: ColorMapping;
    rotation?: number;
    trn?: Simple2DTransform | undefined;
};
export type AxisAlignedZarrSliceGrid = {
    type: 'AxisAlignedZarrSliceGrid';
    connection: OmeZarrConnection;
    metadata: OmeZarrMetadata;
    plane: OrthogonalCartesianAxes;
    slices: number;
    gamut: ColorMapping;
    rotation: number;
} & OptionalTransform;

function assembleZarrSliceGrid(
    config: ZarrSliceGridConfig,
    connection: OmeZarrConnection,
    metadata: OmeZarrMetadata,
): AxisAlignedZarrSliceGrid {
    const { rotation, trn } = config;
    return {
        ...config,
        type: 'AxisAlignedZarrSliceGrid',
        connection,
        metadata,
        toModelSpace: trn,
        rotation: rotation ?? 0,
    };
}
export function createZarrSliceGrid(config: ZarrSliceGridConfig): Promise<AxisAlignedZarrSliceGrid> {
    const { resource } = config;
    const connection = new CachedOmeZarrConnection(resource, workerFactory);
    return connection.loadMetadata().then((metadata) => {
        return assembleZarrSliceGrid(config, connection, metadata);
    });
}
