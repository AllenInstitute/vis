import { type CartesianPlane, Vec2, type vec2 } from '@alleninstitute/vis-geometry';
import type { OmeZarrArray, OmeZarrAxis, OmeZarrDataset, OmeZarrMultiscale, ZarrDimension } from './types';

export class OmeZarrLevel {
    readonly path: string;
    readonly multiscale: OmeZarrMultiscale;
    readonly dataset: OmeZarrDataset;
    readonly datasetIndex: number;
    readonly array: OmeZarrArray;

    constructor(
        path: string,
        multiscale: OmeZarrMultiscale,
        dataset: OmeZarrDataset,
        datasetIndex: number,
        array: OmeZarrArray,
    ) {
        this.path = path;
        this.multiscale = multiscale;
        this.dataset = dataset;
        this.datasetIndex = datasetIndex;
        this.array = array;
    }

    get shape(): readonly number[] {
        return this.array.shape;
    }

    get axes(): readonly OmeZarrAxis[] {
        return this.multiscale.axes;
    }

    /**
     * For a given dimension (e.g. 'x', 'y', 'z'), retrieves the index of that dimension within
     * this level's multiscale axes.
     * @param dim The dimension to find the index for
     * @returns the 0-based index of the given dimension, or -1 if the dimension was not found
     */
    indexFor(dim: ZarrDimension) {
        const axes = this.multiscale.axes;
        return axes.findIndex((axis) => axis.name === dim);
    }

    /**
     * Determine the size of a slice of the volume, in the units specified by the axes metadata
     * as described in the ome-zarr spec (https://ngff.openmicroscopy.org/latest/#axes-md).
     * NOTE that only scale transformations (https://ngff.openmicroscopy.org/latest/#trafo-md)
     * are supported at present - other types will be ignored.
     * @param plane the plane to measure (eg. CartesianPlane('xy'))
     * @returns the size, with respect to the coordinateTransformations present on the given dataset, of the requested plane.
     * @example imagine a layer that is 29998 voxels wide in the X dimension, and a scale transformation of 0.00035 for that dimension.
     * this function would return (29998*0.00035 = 10.4993) for the size of that dimension, which you would interpret to be in whatever unit
     * is given by the axes metadata for that dimension (eg. millimeters)
     */
    sizeInUnits(plane: CartesianPlane): vec2 | undefined {
        const vxls = this.planeSizeInVoxels(plane);
        if (vxls === undefined) {
            return undefined;
        }

        let size: vec2 = vxls;
        const transforms = this.dataset.coordinateTransformations;

        // now, just apply the correct transforms, if they exist...
        for (const trn of transforms) {
            if (trn.type === 'scale') {
                // try to apply it!
                const uIndex = this.indexFor(plane.u);
                const vIndex = this.indexFor(plane.v);
                size = Vec2.mul(size, [trn.scale[uIndex], trn.scale[vIndex]]);
            }
        }
        return size;
    }

    /**
     * Get the size in voxels of the given dimension within this level.
     * @see `planeSizeInVoxels` for sizing of a plane rather than a dimension
     * @param dim the dimension to measure
     * @param axes the axes metadata for the zarr dataset
     * @param shape the dimensional extents of the target dataset
     * @returns the size, in voxels, of the given dimension of the given layer
     * @example (pseudocode of course) return omezarr.multiscales[0].datasets[LAYER].shape[DIMENSION]
     */
    sizeInVoxels(dim: ZarrDimension) {
        const uI = this.indexFor(dim);
        if (uI === -1) return undefined;

        return this.array.shape[uI];
    }

    /**
     * Get the size in voxels of a plane within the volume of this level.
     * @see `sizeInVoxels` for sizing of a dimension rather than a plane
     * @param plane the plane to measure (eg. 'xy')
     * @returns a vec2 containing the requested sizes, or undefined if the requested plane is malformed, or not present in the dataset
     */
    planeSizeInVoxels(plane: CartesianPlane): vec2 | undefined {
        // first - u&v must not refer to the same dimension,
        // and both should exist in the axes...
        if (!plane.isValid()) {
            return undefined;
        }
        const uI = this.indexFor(plane.u);
        const vI = this.indexFor(plane.v);
        if (uI === -1 || vI === -1) {
            return undefined;
        }

        return [this.shape[uI], this.shape[vI]] as const;
    }

    /**
     * Determines the integer index within the given dimensional for the specified parametric value.
     * 
     * For example, if the Z dimension has a depth of 100 and the parameter is given as 0.5, this will return
     * an index of 49 (halfway from 0 to 99).
     * @param parameter a value from [0:1] indicating a parameter of the volume, along the given dimension @param dim,
     * @param dim the dimension (axis) along which @param parameter refers
     * @returns a valid index (between [0, level.shape[axis]]) from the volume, suitable for
     */
    indexOfRelativeSlice(parameter: number, dim: ZarrDimension): number {
        const dimIndex = this.indexFor(dim);
        return Math.floor(this.shape[dimIndex] * Math.max(0, Math.min(1, parameter)));
    }

    toJSON() {
        const path = this.path;
        const multiscale = this.multiscale;
        const dataset = this.dataset;
        const datasetIndex = this.datasetIndex;
        const array = this.array;
        return { path, multiscale, dataset, datasetIndex, array };
    }
}
