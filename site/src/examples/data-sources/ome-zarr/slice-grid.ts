import { type OmeZarrMetadata, loadMetadata } from '@alleninstitute/vis-omezarr';
import type { AxisAlignedPlane } from '~/data-renderers/versa-renderer';
import type { ColorMapping } from '../../data-renderers/types';
import type { OptionalTransform, Simple2DTransform } from '../types';
import type { WebResource } from '@alleninstitute/vis-core';

export type ZarrSliceGridConfig = {
    type: 'ZarrSliceGridConfig';
    resource: WebResource;
    plane: AxisAlignedPlane;
    slices: number; // divide this volume into this many slices, and arrange them in a grid.
    gamut: ColorMapping;
    rotation?: number;
    trn?: Simple2DTransform | undefined;
};
export type AxisAlignedZarrSliceGrid = {
    type: 'AxisAlignedZarrSliceGrid';
    metadata: OmeZarrMetadata;
    plane: AxisAlignedPlane;
    slices: number;
    gamut: ColorMapping;
    rotation: number;
} & OptionalTransform;

function assembleZarrSliceGrid(config: ZarrSliceGridConfig, metadata: OmeZarrMetadata): AxisAlignedZarrSliceGrid {
    const { rotation, trn } = config;
    return {
        ...config,
        type: 'AxisAlignedZarrSliceGrid',
        metadata,
        toModelSpace: trn,
        rotation: rotation ?? 0,
    };
}
export function createZarrSliceGrid(config: ZarrSliceGridConfig): Promise<AxisAlignedZarrSliceGrid> {
    const { resource } = config;
    return loadMetadata(resource).then((metadata) => {
        return assembleZarrSliceGrid(config, metadata);
    });
}
