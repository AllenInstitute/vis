import { Box2D, Vec2, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import type { AxisAlignedPlane, ZarrDataset, ZarrRequest } from '../zarr-data';
import { getSlice, pickBestScale, planeSizeInVoxels, sizeInUnits, uvForPlane } from '../zarr-data';
import type { VoxelTileImage } from './slice-renderer';
import type { Chunk } from 'zarrita';

export type VoxelTile = {
    plane: AxisAlignedPlane; // the plane in which the tile sits
    realBounds: box2D; // in the space given by the axis descriptions of the omezarr dataset
    bounds: box2D; // in voxels, in the plane
    planeIndex: number; // the index of this slice along the axis being sliced (orthoganal to plane)
    layerIndex: number; // the index in the resolution pyramid of the omezarr dataset
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
    plane: AxisAlignedPlane,
    planeIndex: number,
    dataset: ZarrDataset,
    tileSize: number,
    layerIndex: number
) {
    const uv = uvForPlane(plane);
    const layer = dataset.multiscales[0].datasets[layerIndex];
    if (!layer) return [];
    const size = planeSizeInVoxels(uv, dataset.multiscales[0].axes, layer);
    const realSize = sizeInUnits(uv, dataset.multiscales[0].axes, layer);
    if (!size || !realSize) return [];
    const scale = Vec2.div(realSize, size);
    const vxlToReal = (vxl: box2D) => Box2D.scale(vxl, scale);
    const realToVxl = (real: box2D) => Box2D.scale(real, Vec2.div([1, 1], scale));
    const visibleTiles: VoxelTile[] = [];
    visitTilesWithin([tileSize, tileSize], size, realToVxl(camera.view), (uv) => {
        visibleTiles.push({
            plane,
            realBounds: vxlToReal(uv),
            bounds: uv,
            planeIndex,
            layerIndex,
        });
    });
    return visibleTiles;
}
export function getVisibleTiles(
    camera: {
        view: box2D;
        screenSize: vec2;
    },
    plane: AxisAlignedPlane,
    planeIndex: number,
    dataset: ZarrDataset,
    tileSize: number
): VoxelTile[] {
    const uv = uvForPlane(plane);
    // TODO (someday) open the array, look at its chunks, use that size for the size of the tiles I request!

    const layer = pickBestScale(dataset, uv, camera.view, camera.screenSize);
    // using [1,1] here is asking for the best LOD to fill a single pixel - aka
    // the lowest LOD - this is safer than just assuming that layer will be
    // the first or last in the list.
    const baseLayer = pickBestScale(dataset, uv, camera.view, [1, 1]);
    const layerIndex = dataset.multiscales[0].datasets.indexOf(layer);
    const baselayerIndex = dataset.multiscales[0].datasets.indexOf(baseLayer);
    if (layer.path !== baseLayer.path) {
        // if the layer we want to draw is not the lowest-level of detail,
        // then we inject the low-level of detail tiles into the returned result - the idea
        // is that we draw the low LOD data underneath the desired LOD as a fallback to prevent flickering.
        return [
            ...getVisibleTilesInLayer(camera, plane, planeIndex, dataset, tileSize, baselayerIndex),
            ...getVisibleTilesInLayer(camera, plane, planeIndex, dataset, tileSize, layerIndex),
        ];
    }
    return getVisibleTilesInLayer(camera, plane, planeIndex, dataset, tileSize, layerIndex);
}

export const defaultDecoder = (metadata: ZarrDataset, r: ZarrRequest, layerIndex: number): Promise<VoxelTileImage> => {
    return getSlice(metadata, r, layerIndex).then((result: { shape: number[]; buffer: Chunk<'float32'> }) => {
        const { shape, buffer } = result;
        return { shape, data: new Float32Array(buffer.data) };
    });
};
