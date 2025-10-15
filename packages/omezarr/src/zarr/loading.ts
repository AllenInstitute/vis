import { getResourceUrl, logger, type WebResource } from '@alleninstitute/vis-core';
import {
    type OmeZarrGroup,
    type OmeZarrArray,
    OmeZarrGroupTransform,
    OmeZarrArrayTransform,
} from './types';
import * as zarr from 'zarrita';
import { ZarrFetchStore } from './cached-loading/store';
import { OmeZarrFileset } from './fileset';
import { z } from 'zod';

// Documentation for OME-Zarr datasets (from which these types are built)
// can be found here:
// - top-level metadata: https://ngff.openmicroscopy.org/latest/#multiscale-md
// - array metadata: v2: https://zarr-specs.readthedocs.io/en/latest/v2/v2.0.html#arrays
//                   v3: https://zarr-specs.readthedocs.io/en/latest/v3/core/v3.0.html#array-metadata

type OmeZarrGroupLoadSet<T extends zarr.FetchStore> = {
    raw: zarr.Group<T>;
    transformed: OmeZarrGroup;
};

type OmeZarrArrayLoadSet<T extends zarr.FetchStore> = {
    raw: zarr.Array<zarr.DataType, T>;
    transformed: OmeZarrArray;
};


const loadGroup = async (location: zarr.Location<ZarrFetchStore>): Promise<OmeZarrGroupLoadSet<ZarrFetchStore>> => {
    const group = await zarr.open(location, { kind: 'group' });
    try {
        return { raw: group, transformed: OmeZarrGroupTransform.parse(group.attrs) };
    } catch (e) {
        if (e instanceof z.ZodError) {
            logger.error('could not load Zarr group metadata: parsing failed');
        }
        throw e;
    }
};

const loadArray = async (location: zarr.Location<ZarrFetchStore>): Promise<OmeZarrArrayLoadSet<ZarrFetchStore>> => {
    const array = await zarr.open(location, { kind: 'array' });
    try {
        return { raw: array, transformed: OmeZarrArrayTransform.parse(array) };
    } catch (e) {
        if (e instanceof z.ZodError) {
            logger.error('could not load Zarr array metadata: parsing failed');
        }
        throw e;
    }
};

export type LoadOmeZarrMetadataOptions = {
    numWorkers?: number | undefined;
};

export async function loadOmeZarrFileset(
    res: WebResource,
    workerModule: URL,
    options?: LoadOmeZarrMetadataOptions | undefined,
): Promise<OmeZarrFileset> {
    const url = getResourceUrl(res);
    const store = new ZarrFetchStore(url, workerModule, { numWorkers: options?.numWorkers });
    const root = zarr.root(store);

    const zarritaGroups = new Map<string, zarr.Group<ZarrFetchStore>>();
    const zarritaArrays = new Map<string, zarr.Array<zarr.DataType, ZarrFetchStore>>();

    const { raw: rawRootGroup, transformed: rootGroup } = await loadGroup(root);
    zarritaGroups.set('/', rawRootGroup);

    const arrayResults = await Promise.all(
        rootGroup.attributes.multiscales
            .map((multiscale) =>
                multiscale.datasets?.map(async (dataset) => {
                    return await loadArray(root.resolve(dataset.path));
                }),
            )
            .reduce((prev, curr) => prev.concat(curr))
            .filter((arr) => arr !== undefined),
    );

    const arrays = new Map<string, OmeZarrArray>();

    arrayResults.forEach(({ raw, transformed }) => {
        arrays.set(transformed.path, transformed);
        zarritaArrays.set(raw.path, raw);
    });

    return new OmeZarrFileset(store, root, rootGroup, arrays, zarritaGroups, zarritaArrays);
}

// export type ZarrRequest = Record<ZarrDimension, number | Interval | null>;

/**
 * given a region of a volume to view at a certain output resolution, find the layer in the ome-zarr dataset which
 * is most appropriate - that is to say, as close to 1:1 relation between voxels and display pixels as possible.
 * @param zarr an object representing an omezarr file - see @function loadMetadata
 * @param plane a plane in the volume - the dimensions of this plane will be matched to the displayResolution
 * when choosing an appropriate LOD layer
 * @param relativeView a region of the selected plane which is the "screen" - the screen has resolution @param displayResolution.
 * an example relative view of [0,0],[1,1] would suggest we're trying to view the entire slice at the given resolution.
 * @param displayResolution
 * @returns an LOD (level-of-detail) layer from the given dataset, that is appropriate for viewing at the given
 * displayResolution.
 */
// export function pickBestScale(
//     zarr: OmeZarrMetadata,
//     plane: CartesianPlane,
//     relativeView: box2D, // a box in data-unit-space
//     displayResolution: vec2, // in the plane given above
// ): OmeZarrShapedDataset {
//     const datasets = zarr.getAllShapedDatasets(0);
//     const axes = zarr.attrs.multiscales[0].axes;
//     const firstDataset = datasets[0];
//     if (!firstDataset) {
//         const message = 'invalid Zarr data: no datasets found';
//         logger.error(message);
//         throw new VisZarrDataError(message);
//     }
//     const realSize = sizeInUnits(plane, axes, firstDataset);
//     if (!realSize) {
//         const message = 'invalid Zarr data: could not determine the size of the plane in the given units';
//         logger.error(message);
//         throw new VisZarrDataError(message);
//     }

//     const vxlPitch = (size: vec2) => Vec2.div(realSize, size);
//     // size, in dataspace, of a pixel 1/res
//     const pxPitch = Vec2.div(Box2D.size(relativeView), displayResolution);
//     const dstToDesired = (a: vec2, goal: vec2) => {
//         const diff = Vec2.sub(a, goal);
//         if (diff[0] * diff[1] > 0) {
//             // the res (a) is higher than our goal -
//             // weight this heavily to prefer smaller than the goal
//             return 1000 * Vec2.length(Vec2.sub(a, goal));
//         }
//         return Vec2.length(Vec2.sub(a, goal));
//     };
//     // we assume the datasets are ordered... hmmm TODO
//     const choice = datasets.reduce((bestSoFar, cur) => {
//         const planeSizeBest = planeSizeInVoxels(plane, axes, bestSoFar);
//         const planeSizeCur = planeSizeInVoxels(plane, axes, cur);
//         if (!planeSizeBest || !planeSizeCur) {
//             return bestSoFar;
//         }
//         return dstToDesired(vxlPitch(planeSizeBest), pxPitch) > dstToDesired(vxlPitch(planeSizeCur), pxPitch)
//             ? cur
//             : bestSoFar;
//     }, datasets[0]);
//     return choice ?? datasets[datasets.length - 1];
// }
// TODO this is a duplicate of indexOfDimension... delete one of them!
// function indexFor(dim: ZarrDimension, axes: readonly OmeZarrAxis[]) {
//     return axes.findIndex((axis) => axis.name === dim);
// }
/**
 *
 * @param layer a shaped layer from within the omezarr dataset
 * @param axes the axes describing this omezarr dataset
 * @param parameter a value from [0:1] indicating a parameter of the volume, along the given dimension @param dim,
 * @param dim the dimension (axis) along which @param parameter refers
 * @returns a valid index (between [0,layer.shape[axis] ]) from the volume, suitable for
 */
// export function indexOfRelativeSlice(
//     layer: OmeZarrShapedDataset,
//     axes: readonly OmeZarrAxis[],
//     parameter: number,
//     dim: ZarrDimension,
// ): number {
//     const dimIndex = indexFor(dim, axes);
//     return Math.floor(layer.shape[dimIndex] * Math.max(0, Math.min(1, parameter)));
// }
/**
 * @param zarr
 * @param plane
 * @param relativeView
 * @param displayResolution
 * @returns
 */
// export function nextSliceStep(
//     zarr: OmeZarrMetadata,
//     plane: CartesianPlane,
//     relativeView: box2D, // a box in data-unit-space
//     displayResolution: vec2, // in the plane given above
// ) {
//     // figure out what layer we'd be viewing
//     const layer = pickBestScale(zarr, plane, relativeView, displayResolution);
//     const axes = zarr.attrs.multiscales[0].axes;
//     const slices = sizeInVoxels(plane.ortho, axes, layer);
//     return slices === undefined ? undefined : 1 / slices;
// }

/**
 * determine the size of a slice of the volume, in the units specified by the axes metadata
 * as described in the ome-zarr spec (https://ngff.openmicroscopy.org/latest/#axes-md)
 * NOTE that only scale transformations (https://ngff.openmicroscopy.org/latest/#trafo-md) are supported at present - other types will be ignored.
 * @param plane the plane to measure (eg. CartesianPlane('xy'))
 * @param axes the axes metadata from the omezarr file in question
 * @param dataset one of the "datasets" in the omezarr layer pyramid (https://ngff.openmicroscopy.org/latest/#multiscale-md)
 * @returns the size, with respect to the coordinateTransformations present on the given dataset, of the requested plane.
 * @example imagine a layer that is 29998 voxels wide in the X dimension, and a scale transformation of 0.00035 for that dimension.
 * this function would return (29998*0.00035 = 10.4993) for the size of that dimension, which you would interpret to be in whatever unit
 * is given by the axes metadata for that dimension (eg. millimeters)
 */
// export function sizeInUnits(
//     plane: CartesianPlane,
//     axes: readonly OmeZarrAxis[],
//     dataset: OmeZarrShapedDataset,
// ): vec2 | undefined {
//     const vxls = planeSizeInVoxels(plane, axes, dataset);

//     if (vxls === undefined) return undefined;

//     let size: vec2 = vxls;

//     // now, just apply the correct transforms, if they exist...
//     for (const trn of dataset.coordinateTransformations) {
//         if (trn.type === 'scale') {
//             // try to apply it!
//             const uIndex = indexFor(plane.u, axes);
//             const vIndex = indexFor(plane.v, axes);
//             size = Vec2.mul(size, [trn.scale[uIndex], trn.scale[vIndex]]);
//         }
//     }
//     return size;
// }
/**
 * get the size in voxels of a layer of an omezarr on a given dimension
 * @param dim the dimension to measure
 * @param axes the axes metadata for the zarr dataset
 * @param dataset an entry in the datasets list in the multiscales list in a ZarrDataset object
 * @returns the size, in voxels, of the given dimension of the given layer
 * @example (pseudocode of course) return omezarr.multiscales[0].datasets[LAYER].shape[DIMENSION]
 */
// export function sizeInVoxels(dim: ZarrDimension, axes: readonly OmeZarrAxis[], dataset: OmeZarrShapedDataset) {
//     const uI = indexFor(dim, axes);
//     if (uI === -1) return undefined;

//     return dataset.shape[uI];
// }

// TODO move into ZarrMetadata object
/**
 * get the size of a plane of a volume (given a specific layer) in voxels
 * see @function sizeInVoxels
 * @param plane the plane to measure (eg. 'xy')
 * @param axes the axes metadata of an omezarr object
 * @param dataset a layer of the ome-zarr resolution pyramid
 * @returns a vec2 containing the requested sizes, or undefined if the requested plane is malformed, or not present in the dataset
 */
// export function planeSizeInVoxels(
//     plane: CartesianPlane,
//     axes: readonly OmeZarrAxis[],
//     dataset: OmeZarrShapedDataset,
// ): vec2 | undefined {
//     // first - u&v must not refer to the same dimension,
//     // and both should exist in the axes...
//     if (!plane.isValid()) {
//         return undefined;
//     }
//     const uI = indexFor(plane.u, axes);
//     const vI = indexFor(plane.v, axes);
//     if (uI === -1 || vI === -1) {
//         return undefined;
//     }

//     return [dataset.shape[uI], dataset.shape[vI]] as const;
// }
