import {
    Box2D,
    type CartesianPlane,
    Vec2,
    type box2D,
    type OrthogonalCartesianAxes,
    type vec2,
} from '@alleninstitute/vis-geometry';
import type { Chunk } from 'zarrita';
import type { ZarrRequest } from '../zarr/loading';
import { loadSlice, pickBestScale, planeSizeInVoxels, sizeInUnits } from '../zarr/loading';
import type { VoxelTileImage } from './slice-renderer';
import type { OmeZarrMetadata, OmeZarrShapedDataset } from '../zarr/types';

export type VoxelTile = {
    plane: OrthogonalCartesianAxes; // the plane in which the tile sits
    realBounds: box2D; // in the space given by the axis descriptions of the omezarr dataset
    bounds: box2D; // in voxels, in the plane
    orthoVal: number; // the value along the orthogonal axis to the plane (e.g. the slice index along Z relative to an XY plane)
    level: OmeZarrShapedDataset; // the index in the resolution pyramid of the omezarr dataset
};

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
    dataset: OmeZarrMetadata,
    tileSize: number,
    level: OmeZarrShapedDataset,
) {
    const size = planeSizeInVoxels(plane, dataset.attrs.multiscales[0].axes, level);
    const realSize = sizeInUnits(plane, dataset.attrs.multiscales[0].axes, level);
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
            level,
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
    orthoVal: number,
    metadata: OmeZarrMetadata,
    tileSize: number,
): VoxelTile[] {
    // TODO (someday) open the array, look at its chunks, use that size for the size of the tiles I request!

    const layer = pickBestScale(metadata, plane, camera.view, camera.screenSize);
    // using [1,1] here is asking for the best LOD to fill a single pixel - aka
    // the lowest LOD - this is safer than just assuming that layer will be
    // the first or last in the list.
    const baseLayer = pickBestScale(metadata, plane, camera.view, [1, 1]);
    if (layer.path !== baseLayer.path) {
        // if the layer we want to draw is not the lowest-level of detail,
        // then we inject the low-level of detail tiles into the returned result - the idea
        // is that we draw the low LOD data underneath the desired LOD as a fallback to prevent flickering.
        return [
            ...getVisibleTilesInLayer(camera, plane, orthoVal, metadata, tileSize, baseLayer),
            ...getVisibleTilesInLayer(camera, plane, orthoVal, metadata, tileSize, layer),
        ];
    }
    return getVisibleTilesInLayer(camera, plane, orthoVal, metadata, tileSize, layer);
}
/**
 * a function which returns a promise of float32 data from the requested region of an omezarr dataset.
 * Note that omezarr decoding can be slow - consider wrapping this function in a web-worker (or a pool of them)
 * to improve performance (note also that the webworker message passing will need to itself be wrapped in promises)
 * @param metadata an omezarr object
 * @param r a slice request @see getSlice
 * @param layerIndex an index into the LOD pyramid of the given ZarrDataset.
 * @returns the requested voxel information from the given layer of the given dataset.
 */
export const defaultDecoder = (
    metadata: OmeZarrMetadata,
    r: ZarrRequest,
    level: OmeZarrShapedDataset,
): Promise<VoxelTileImage> => {
    return loadSlice(metadata, r, level).then((result: { shape: number[]; buffer: Chunk<'float32'> }) => {
        const { shape, buffer } = result;
        return { shape, data: new Float32Array(buffer.data) };
    });
};
