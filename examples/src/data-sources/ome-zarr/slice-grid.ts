import { type ZarrMetadata, loadMetadata } from '@alleninstitute/vis-omezarr';
import type { AxisAlignedPlane } from '~/data-renderers/versa-renderer';
import type { ColorMapping } from '../../data-renderers/types';
import type { OptionalTransform, Simple2DTransform } from '../types';

export type ZarrSliceGridConfig = {
    type: 'ZarrSliceGridConfig';
    url: string;
    plane: AxisAlignedPlane;
    slices: number; // divide this volume into this many slices, and arrange them in a grid.
    gamut: ColorMapping;
    rotation?: number;
    trn?: Simple2DTransform | undefined;
};
export type AxisAlignedZarrSliceGrid = {
    type: 'AxisAlignedZarrSliceGrid';
    metadata: ZarrMetadata;
    plane: AxisAlignedPlane;
    slices: number;
    gamut: ColorMapping;
    rotation: number;
} & OptionalTransform;

function assembleZarrSliceGrid(config: ZarrSliceGridConfig, metadata: ZarrMetadata): AxisAlignedZarrSliceGrid {
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
    const { url } = config;
    return loadMetadata(url).then((metadata) => {
        return assembleZarrSliceGrid(config, metadata);
    });
}
