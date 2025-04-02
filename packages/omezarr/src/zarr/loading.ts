import {
    Box2D,
    type CartesianPlane,
    type Interval,
    Vec2,
    type box2D,
    limit,
    type vec2,
} from '@alleninstitute/vis-geometry';
import { logger } from '@alleninstitute/vis-core';
import { VisZarrDataError } from '../errors';
import {
    OmeZarrAttrsSchema,
    OmeZarrMetadata,
    type OmeZarrAttrs,
    type OmeZarrAxis,
    type ZarrDimension,
    type OmeZarrShapedDataset,
    type OmeZarrArrayMetadata,
} from './types';
import * as zarr from 'zarrita';
import { ZodError } from 'zod';

// Documentation for OME-Zarr datasets (from which these types are built)
// can be found here:
// - top-level metadata: https://ngff.openmicroscopy.org/latest/#multiscale-md
// - array metadata: v2: https://zarr-specs.readthedocs.io/en/latest/v2/v2.0.html#arrays
//                   v3: https://zarr-specs.readthedocs.io/en/latest/v3/core/v3.0.html#array-metadata

export async function loadZarrAttrsFile(url: string): Promise<OmeZarrAttrs> {
    const store = new zarr.FetchStore(url);
    return loadZarrAttrsFileFromStore(store);
}

async function loadZarrAttrsFileFromStore(store: zarr.FetchStore): Promise<OmeZarrAttrs> {
    const group = await zarr.open(store, { kind: 'group' });
    try {
        return OmeZarrAttrsSchema.parse(group.attrs);
    } catch (e) {
        if (e instanceof ZodError) {
            logger.error('could not load Zarr file: parsing failed');
        }
        throw e;
    }
}

type OmeZarrArrayMetadataLoad = {
    metadata: OmeZarrArrayMetadata;
    raw: zarr.Array<zarr.DataType, zarr.FetchStore>;
};

export async function loadZarrArrayFile(
    url: string,
    path: string,
    version = 2,
    loadV2Attrs = true,
): Promise<OmeZarrArrayMetadata> {
    const store = new zarr.FetchStore(url);
    const result = await loadZarrArrayFileFromStore(store, path, version, loadV2Attrs);
    return result.metadata;
}

async function loadZarrArrayFileFromStore(
    store: zarr.FetchStore,
    path: string,
    version = 2,
    loadV2Attrs = true,
): Promise<OmeZarrArrayMetadataLoad> {
    const root = zarr.root(store);
    let array: zarr.Array<zarr.DataType, zarr.FetchStore>;
    if (version === 3) {
        array = await zarr.open.v3(root.resolve(path), { kind: 'array' });
    } else if (version === 2) {
        array = await zarr.open.v2(root.resolve(path), { kind: 'array', attrs: loadV2Attrs });
    } else {
        const message = `unsupported Zarr format version specified: ${version}`;
        logger.error(message);
        throw new VisZarrDataError(message);
    }
    const { shape, attrs } = array;
    try {
        return { metadata: { path, shape, attrs }, raw: array };
    } catch (e) {
        if (e instanceof ZodError) {
            logger.error('could not load Zarr file: parsing failed');
        }
        throw e;
    }
}

/**
 *
 * @param url a url which resolves to an omezarr dataset
 * @returns a structure describing the omezarr dataset. See
 * https://ngff.openmicroscopy.org/latest/#multiscale-md for the specification.
 * The object returned from this function can be passed to most of the other utilities for ome-zarr data
 * manipulation.
 */
export async function loadMetadata(url: string, version = 2, loadV2ArrayAttrs = true): Promise<OmeZarrMetadata> {
    const store = new zarr.FetchStore(url);
    const attrs: OmeZarrAttrs = await loadZarrAttrsFileFromStore(store);
    const arrays = await Promise.all(
        attrs.multiscales
            .map((multiscale) => {
                return (
                    multiscale.datasets?.map(async (dataset) => {
                        return (await loadZarrArrayFileFromStore(store, dataset.path, version, loadV2ArrayAttrs))
                            .metadata;
                    }) ?? []
                );
            })
            .reduce((prev, curr) => prev.concat(curr))
            .filter((v) => v !== undefined),
    );
    return new OmeZarrMetadata(url, attrs, arrays, version);
}

export type ZarrRequest = Record<ZarrDimension, number | Interval | null>;

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
export function pickBestScale(
    zarr: OmeZarrMetadata,
    plane: CartesianPlane,
    relativeView: box2D, // a box in data-unit-space
    displayResolution: vec2, // in the plane given above
): OmeZarrShapedDataset {
    const datasets = zarr.getAllShapedDatasets(0);
    const axes = zarr.attrs.multiscales[0].axes;
    const firstDataset = datasets[0];
    if (!firstDataset) {
        const message = 'invalid Zarr data: no datasets found';
        logger.error(message);
        throw new VisZarrDataError(message);
    }
    const realSize = sizeInUnits(plane, axes, firstDataset);
    if (!realSize) {
        const message = 'invalid Zarr data: could not determine the size of the plane in the given units';
        logger.error(message);
        throw new VisZarrDataError(message);
    }

    const vxlPitch = (size: vec2) => Vec2.div(realSize, size);
    // size, in dataspace, of a pixel 1/res
    const pxPitch = Vec2.div(Box2D.size(relativeView), displayResolution);
    const dstToDesired = (a: vec2, goal: vec2) => {
        const diff = Vec2.sub(a, goal);
        if (diff[0] * diff[1] > 0) {
            // the res (a) is higher than our goal -
            // weight this heavily to prefer smaller than the goal
            return 1000 * Vec2.length(Vec2.sub(a, goal));
        }
        return Vec2.length(Vec2.sub(a, goal));
    };
    // we assume the datasets are ordered... hmmm TODO
    const choice = datasets.reduce((bestSoFar, cur) => {
        const planeSizeBest = planeSizeInVoxels(plane, axes, bestSoFar);
        const planeSizeCur = planeSizeInVoxels(plane, axes, cur);
        if (!planeSizeBest || !planeSizeCur) {
            return bestSoFar;
        }
        return dstToDesired(vxlPitch(planeSizeBest), pxPitch) > dstToDesired(vxlPitch(planeSizeCur), pxPitch)
            ? cur
            : bestSoFar;
    }, datasets[0]);
    return choice ?? datasets[datasets.length - 1];
}

function indexFor(dim: ZarrDimension, axes: readonly OmeZarrAxis[]) {
    return axes.findIndex((axis) => axis.name === dim);
}

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
export function sizeInUnits(
    plane: CartesianPlane,
    axes: readonly OmeZarrAxis[],
    dataset: OmeZarrShapedDataset,
): vec2 | undefined {
    const vxls = planeSizeInVoxels(plane, axes, dataset);

    if (vxls === undefined) return undefined;

    let size: vec2 = vxls;

    // now, just apply the correct transforms, if they exist...
    for (const trn of dataset.coordinateTransformations) {
        if (trn.type === 'scale') {
            // try to apply it!
            const uIndex = indexOfDimension(axes, plane.u);
            const vIndex = indexOfDimension(axes, plane.v);
            size = Vec2.mul(size, [trn.scale[uIndex], trn.scale[vIndex]]);
        }
    }
    return size;
}
/**
 * get the size in voxels of a layer of an omezarr on a given dimension
 * @param dim the dimension to measure
 * @param axes the axes metadata for the zarr dataset
 * @param dataset an entry in the datasets list in the multiscales list in a ZarrDataset object
 * @returns the size, in voxels, of the given dimension of the given layer
 * @example (pseudocode of course) return omezarr.multiscales[0].datasets[LAYER].shape[DIMENSION]
 */
export function sizeInVoxels(dim: ZarrDimension, axes: readonly OmeZarrAxis[], dataset: OmeZarrShapedDataset) {
    const uI = indexFor(dim, axes);
    if (uI === -1) return undefined;

    return dataset.shape[uI];
}

// TODO move into ZarrMetadata object
/**
 * get the size of a plane of a volume (given a specific layer) in voxels
 * see @function sizeInVoxels
 * @param plane the plane to measure (eg. 'xy')
 * @param axes the axes metadata of an omezarr object
 * @param dataset a layer of the ome-zarr resolution pyramid
 * @returns a vec2 containing the requested sizes, or undefined if the requested plane is malformed, or not present in the dataset
 */
export function planeSizeInVoxels(
    plane: CartesianPlane,
    axes: readonly OmeZarrAxis[],
    dataset: OmeZarrShapedDataset,
): vec2 | undefined {
    // first - u&v must not refer to the same dimension,
    // and both should exist in the axes...
    if (!plane.isValid()) {
        return undefined;
    }
    const uI = indexFor(plane.u, axes);
    const vI = indexFor(plane.v, axes);
    if (uI === -1 || vI === -1) {
        return undefined;
    }

    return [dataset.shape[uI], dataset.shape[vI]] as const;
}

// feel free to freak out if the request is over or under determined or whatever
function buildQuery(r: Readonly<ZarrRequest>, axes: readonly OmeZarrAxis[], shape: readonly number[]) {
    const ordered = axes.map((a) => r[a.name as ZarrDimension]);
    // if any are undefined, throw up
    if (ordered.some((a) => a === undefined)) {
        throw new VisZarrDataError('request does not match expected dimensions of OME-Zarr dataset');
    }

    return ordered.map((d, i) => {
        const bounds = { min: 0, max: shape[i] };
        if (d === null) {
            return d;
        }
        if (typeof d === 'number') {
            return limit(bounds, d);
        }
        return zarr.slice(limit(bounds, d.min), limit(bounds, d.max));
    });
}

export async function explain(z: OmeZarrMetadata) {
    logger.dir(z);
}

export function indexOfDimension(axes: readonly OmeZarrAxis[], dim: ZarrDimension) {
    return axes.findIndex((ax) => ax.name === dim);
}
/**
 * get voxels / pixels from a region of a layer of an omezarr dataset
 * @param metadata a ZarrMetadata from which to request a slice of voxels
 * @param r a slice object, describing the requested region of data - note that it is quite possible to request
 * data that is not "just" a slice. The semantics of this slice object should match up with conventions in numpy or other multidimensional array tools:
 * @see https://zarrita.dev/slicing.html
 * @param level the layer within the LOD pyramid of the OME-Zarr dataset.
 * @returns the requested chunk of image data from the given layer of the omezarr LOD pyramid. Note that if the given layerIndex is invalid, it will be treated as though it is the highest index possible.
 * @throws an error if the request results in anything of lower-or-equal dimensionality than a single value
 */
export async function loadSlice(metadata: OmeZarrMetadata, r: ZarrRequest, level: OmeZarrShapedDataset) {
    // put the request in native order
    const store = new zarr.FetchStore(metadata.url);
    const scene = metadata.attrs.multiscales[0];
    const { axes } = scene;
    if (!level) {
        const message = 'invalid Zarr data: no datasets found';
        logger.error(message);
        throw new VisZarrDataError(message);
    }
    const arr = metadata.arrays.find((a) => a.path === level.path);
    if (!arr) {
        const message = `cannot load slice: no array found for path [${level.path}]`;
        logger.error(message);
        throw new VisZarrDataError(message);
    }
    const { raw } = await loadZarrArrayFileFromStore(store, arr.path, 2, false);
    const result = await zarr.get(raw, buildQuery(r, axes, level.shape));
    if (typeof result === 'number') {
        throw new Error('oh noes, slice came back all weird');
    }
    return {
        shape: result.shape,
        buffer: result,
    };
}
