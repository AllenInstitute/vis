import { load, type ZarrDataset } from "~/loaders/ome-zarr/zarr-data";
import type { AxisAlignedPlane } from "../../../../omezarr-viewer/src/versa-renderer";
import type { ColorMapping } from "../../data-renderers/types";
import type { OptionalTransform, Simple2DTransform } from "../types";
type MaybePromise<T> = T | Promise<T>;
export type ZarrSliceConfig = {
    type: 'zarrSliceConfig',
    url: string;
    plane: AxisAlignedPlane;
    planeParameter: number; // [0:1] eg. if if plane is 'xy' and parameter is 0.5, then we want the slice from the middle of the z-axis
    gamut: ColorMapping;
    rotation?: number;
    trn?: Simple2DTransform | undefined;
}

export type AxisAlignedZarrSlice = {
    type: 'AxisAlignedZarrSlice'
    dataset: ZarrDataset;
    plane: AxisAlignedPlane;
    planeParameter: number;
    gamut: ColorMapping;
    rotation: number;
} & OptionalTransform
function assembleZarrSlice(config: ZarrSliceConfig, dataset: ZarrDataset): AxisAlignedZarrSlice {
    const { rotation, trn } = config
    return {
        ...config,
        type: 'AxisAlignedZarrSlice',
        dataset,
        toModelSpace: trn,
        rotation: rotation ?? 0
    }
}
export function createZarrSlice(config: ZarrSliceConfig): Promise<AxisAlignedZarrSlice> {
    const { url } = config;
    return load(url).then((dataset) => {
        return assembleZarrSlice(config, dataset)
    })
}
