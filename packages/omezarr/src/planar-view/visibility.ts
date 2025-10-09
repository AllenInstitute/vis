import { Box2D, type box2D, type CartesianPlane, Vec2, type vec2 } from '@alleninstitute/vis-geometry';
import type { OmeZarrFileset } from '../zarr/omezarr-fileset';
import type { OmeZarrLevel } from '../zarr/omezarr-level';
import type { PlanarVoxelTile } from './types';

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

function getVisibleTilesInLevel(
    camera: {
        view: box2D;
        screenSize: vec2;
    },
    plane: CartesianPlane,
    orthoVal: number,
    tileSize: number,
    level: OmeZarrLevel,
) {
    const size = level.planeSizeInVoxels(plane);
    const realSize = level.sizeInUnits(plane);
    if (!size || !realSize) return [];
    const scale = Vec2.div(realSize, size);
    const vxlToReal = (vxl: box2D) => Box2D.scale(vxl, scale);
    const realToVxl = (real: box2D) => Box2D.scale(real, Vec2.div([1, 1], scale));
    const visibleTiles: PlanarVoxelTile[] = [];
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
export function getVisibleOmeZarrTiles(
    fileset: OmeZarrFileset,
    camera: {
        view: box2D;
        screenSize: vec2;
    },
    plane: CartesianPlane,
    planeLocation: number,
    tileSize: number,
): PlanarVoxelTile[] {
    // TODO (someday) open the array, look at its chunks, use that size for the size of the tiles I request!

    const level = fileset.pickBestScale(plane, camera.view, camera.screenSize);
    // figure out the index of the slice

    const sliceIndex = level.indexOfRelativeSlice(planeLocation, plane.ortho);
    return getVisibleTilesInLevel(camera, plane, sliceIndex, tileSize, level);
}
