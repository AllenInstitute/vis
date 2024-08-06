
import { type ZarrDataset, load } from 'src/common/loaders/ome-zarr/zarr-data';
import type { AxisAlignedPlane } from 'src/data-renderers/versa-renderer';
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
    dataset: ZarrDataset;
    plane: AxisAlignedPlane;
    slices: number;
    gamut: ColorMapping;
    rotation: number;
} & OptionalTransform;

function assembleZarrSliceGrid(config: ZarrSliceGridConfig, dataset: ZarrDataset): AxisAlignedZarrSliceGrid {
    const { rotation, trn } = config;
    return {
        ...config,
        type: 'AxisAlignedZarrSliceGrid',
        dataset,
        toModelSpace: trn,
        rotation: rotation ?? 0,
    };
}
export function createZarrSliceGrid(config: ZarrSliceGridConfig): Promise<AxisAlignedZarrSliceGrid> {
    const { url } = config;
    return load(url).then((dataset) => {
        return assembleZarrSliceGrid(config, dataset);
    });
}
