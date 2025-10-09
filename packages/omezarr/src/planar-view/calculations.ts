import { logger } from "@alleninstitute/vis-core";
import { Box2D, type box2D, type CartesianPlane, Vec2, type vec2 } from "@alleninstitute/vis-geometry";
import { VisZarrDataError } from "../errors";
import type { OmeZarrFileset, OmeZarrDataContext as OmeZarrLevel } from "../zarr/omezarr-fileset";
import type { OmeZarrAxis, OmeZarrCoordinateTransform, ZarrDimension } from "../zarr/types";
import type { VoxelTile } from "./types";

function indexFor(dim: ZarrDimension, axes: readonly OmeZarrAxis[]) {
    return axes.findIndex((axis) => axis.name === dim);
}

export const pickBestScale = (
    fileset: OmeZarrFileset,
    plane: CartesianPlane,
    relativeView: box2D, // a box in data-unit-space
    displayResolution: vec2, // in the plane given above
    multiscaleName?: string | undefined,
): OmeZarrLevel => {
    if (!fileset.ready) {
        const message = 'cannot pick best-fitting scale: OME-Zarr metadata not yet loaded';
        logger.error(message);
        throw new VisZarrDataError(message);
    }

    const dataContext = fileset.getDataContext({ index: 0, multiscale: multiscaleName });
    if (!dataContext) {
        const message = 'cannot pick best-fitting scale: no initial dataset context found';
        logger.error(message);
        throw new VisZarrDataError(message);
    }

    const { multiscale, dataset, array } = dataContext;

    const axes = multiscale.axes;
    const transforms = dataset.coordinateTransformations;
    const shape = array.shape;

    const realSize = sizeInUnits(plane, axes, transforms, shape);
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

    const dataContexts = Array.from(fileset.getDataContexts());

    // we assume the datasets are ordered... hmmm TODO
    const choice = dataContexts.reduce((bestSoFar, cur) => {
        const planeSizeBest = planeSizeInVoxels(plane, axes, bestSoFar.array.shape);
        const planeSizeCur = planeSizeInVoxels(plane, axes, cur.array.shape);
        if (!planeSizeBest || !planeSizeCur) {
            return bestSoFar;
        }
        return dstToDesired(vxlPitch(planeSizeBest), pxPitch) > dstToDesired(vxlPitch(planeSizeCur), pxPitch)
            ? cur
            : bestSoFar;
    }, dataContexts[0]);
    return choice ?? dataContexts[dataContexts.length - 1];
}

/**
 *
 * @param shape the dimensional extents of the data space
 * @param axes the axes describing this omezarr dataset
 * @param parameter a value from [0:1] indicating a parameter of the volume, along the given dimension @param dim,
 * @param dim the dimension (axis) along which @param parameter refers
 * @returns a valid index (between [0,layer.shape[axis] ]) from the volume, suitable for
 */
export function indexOfRelativeSlice(
    shape: readonly number[],
    axes: readonly OmeZarrAxis[],
    parameter: number,
    dim: ZarrDimension,
): number {
    const dimIndex = indexFor(dim, axes);
    return Math.floor(shape[dimIndex] * Math.max(0, Math.min(1, parameter)));
}

/**
 * @param zarr
 * @param plane
 * @param relativeView
 * @param displayResolution
 * @returns
 */
export function nextSliceStep(
    fileset: OmeZarrFileset,
    plane: CartesianPlane,
    relativeView: box2D, // a box in data-unit-space
    displayResolution: vec2, // in the plane given above
) {
    if (!fileset.ready) {
        const message = 'cannot pick best-fitting scale: OME-Zarr metadata not yet loaded';
        logger.error(message);
        throw new VisZarrDataError(message);
    }

    // figure out what layer we'd be viewing
    const layer = pickBestScale(fileset, plane, relativeView, displayResolution);
    const axes = layer.multiscale.axes;
    const slices = sizeInVoxels(plane.ortho, axes, layer.array.shape);
    return slices === undefined ? undefined : 1 / slices;
}

/**
 * determine the size of a slice of the volume, in the units specified by the axes metadata
 * as described in the ome-zarr spec (https://ngff.openmicroscopy.org/latest/#axes-md)
 * NOTE that only scale transformations (https://ngff.openmicroscopy.org/latest/#trafo-md) are supported at present - other types will be ignored.
 * @param plane the plane to measure (eg. CartesianPlane('xy'))
 * @param axes the axes metadata from the omezarr file in question
 * @param transforms the set of coordinate transforms to use for scaling (https://ngff.openmicroscopy.org/latest/#multiscale-md)
 * @param shape the dimensional extents of this coordinate space
 * @returns the size, with respect to the coordinateTransformations present on the given dataset, of the requested plane.
 * @example imagine a layer that is 29998 voxels wide in the X dimension, and a scale transformation of 0.00035 for that dimension.
 * this function would return (29998*0.00035 = 10.4993) for the size of that dimension, which you would interpret to be in whatever unit
 * is given by the axes metadata for that dimension (eg. millimeters)
 */
export function sizeInUnits(
    plane: CartesianPlane,
    axes: readonly OmeZarrAxis[],
    transforms: OmeZarrCoordinateTransform[],
    shape: readonly number[]
): vec2 | undefined {
    const vxls = planeSizeInVoxels(plane, axes, shape);

    if (vxls === undefined) return undefined;

    let size: vec2 = vxls;

    // now, just apply the correct transforms, if they exist...
    for (const trn of transforms) {
        if (trn.type === 'scale') {
            // try to apply it!
            const uIndex = indexFor(plane.u, axes);
            const vIndex = indexFor(plane.v, axes);
            size = Vec2.mul(size, [trn.scale[uIndex], trn.scale[vIndex]]);
        }
    }
    return size;
}

/**
 * get the size in voxels of a layer of an omezarr on a given dimension
 * @param dim the dimension to measure
 * @param axes the axes metadata for the zarr dataset
 * @param shape the dimensional extents of the target dataset
 * @returns the size, in voxels, of the given dimension of the given layer
 * @example (pseudocode of course) return omezarr.multiscales[0].datasets[LAYER].shape[DIMENSION]
 */
export function sizeInVoxels(dim: ZarrDimension, axes: readonly OmeZarrAxis[], shape: readonly number[]) {
    const uI = indexFor(dim, axes);
    if (uI === -1) return undefined;

    return shape[uI];
}

// TODO move into ZarrMetadata object
/**
 * get the size of a plane of a volume (given a specific layer) in voxels
 * see @function sizeInVoxels
 * @param plane the plane to measure (eg. 'xy')
 * @param axes the axes metadata of an omezarr object
 * @param shape the dimensional extents of the target dataset
 * @returns a vec2 containing the requested sizes, or undefined if the requested plane is malformed, or not present in the dataset
 */
export function planeSizeInVoxels(
    plane: CartesianPlane,
    axes: readonly OmeZarrAxis[],
    shape: readonly number[],
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

    return [shape[uI], shape[vI]] as const;
}

/**
 * given a image with @param size pixels, break it into tiles, each @param idealTilePx.
 * for all such tiles which intersect the given bounds, call the visitor
 * @param idealTilePx the size of a tile, in pixels
 * @param size the size of the image at this level of detail
 * @param bounds visit only the tiles that are within the given bounds (in pixels)
 */
function visitTilesWithin(idealTilePx: vec2, size: vec2, bounds: box2D, visit: (tile: box2D) => void) {
    const withinBoth = Box2D.intersection(bounds, Box2D.create([0, 0], size));
    if (!withinBoth) {
        return;
    }
    // convert the image into tile indexes:
    const boundsInTiles = Box2D.map(withinBoth, (corner) => Vec2.div(corner, idealTilePx));
    for (let x = Math.floor(boundsInTiles.minCorner[0]); x < Math.ceil(boundsInTiles.maxCorner[0]); x += 1) {
        for (let y = Math.floor(boundsInTiles.minCorner[1]); y < Math.ceil(boundsInTiles.maxCorner[1]); y += 1) {
            // all tiles visited are always within both the bounds, and the image itself
            const lo = Vec2.mul([x, y], idealTilePx);
            const hi = Vec2.min(size, Vec2.add(lo, idealTilePx));
            visit(Box2D.create(lo, hi));
        }
    }
}

function getVisibleTilesInLayer(
    camera: {
        view: box2D;
        screenSize: vec2;
    },
    plane: CartesianPlane,
    orthoVal: number,
    axes: OmeZarrAxis[],
    tileSize: number,
    level: OmeZarrLevel,
) {
    const size = planeSizeInVoxels(plane, axes, level.array.shape);
    const realSize = sizeInUnits(plane, axes, level.dataset.coordinateTransformations, level.array.shape);
    if (!size || !realSize) return [];
    const scale = Vec2.div(realSize, size);
    const vxlToReal = (vxl: box2D) => Box2D.scale(vxl, scale);
    const realToVxl = (real: box2D) => Box2D.scale(real, Vec2.div([1, 1], scale));
    const visibleTiles: VoxelTile[] = [];
    visitTilesWithin([tileSize, tileSize], size, realToVxl(camera.view), (uv) => {
        visibleTiles.push({
            plane: plane.axes,
            realBounds: vxlToReal(uv),
            bounds: uv,
            orthoVal,
            dataContext: level,
        });
    });
    return visibleTiles;
}

/**
 * Gets the list of tiles of the given OME-Zarr image which are visible (i.e. they intersect with @param camera.view).
 * @param camera an object describing the current view: the region of the omezarr, and the resolution at which it
 * will be displayed.
 * @param plane the plane (eg. CartesianPlane('xy')) from which to draw tiles
 * @param orthoVal the value of the dimension orthogonal to the reference plane, e.g. the Z value relative to an XY plane. This gives
 * which XY slice of voxels to display within the overall XYZ space of the 3D image.
 * Note that not all OME-Zarr LOD layers can be expected to have the same number of slices! An index which exists at a high LOD may not
 * exist at a low LOD.
 * @param metadata the OME-Zarr image to pull tiles from
 * @param tileSize the size of the tiles, in pixels. It is recommended to use a size that agrees with the chunking used in the dataset; however,
 * other utilities in this library will stitch together chunks to satisfy the requested tile size.
 * @returns an array of objects representing tiles (bounding information, etc.) which are visible within the given dataset
 */
export function getVisibleTiles(
    camera: {
        view: box2D;
        screenSize: vec2;
    },
    plane: CartesianPlane,
    planeLocation: number,
    fileset: OmeZarrFileset,
    tileSize: number,
): VoxelTile[] {
    // TODO (someday) open the array, look at its chunks, use that size for the size of the tiles I request!

    const level = pickBestScale(fileset, plane, camera.view, camera.screenSize);
    // figure out the index of the slice

    const sliceIndex = indexOfRelativeSlice(level.array.shape, level.multiscale.axes, planeLocation, plane.ortho);
    return getVisibleTilesInLayer(camera, plane, sliceIndex, level.multiscale.axes, tileSize, level);
}
