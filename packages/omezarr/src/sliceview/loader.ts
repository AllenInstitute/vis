import { Box2D, Vec2, box2D, vec2 } from "@alleninstitute/vis-geometry";
import { AxisAlignedPlane, ZarrDataset, getSlice, pickBestScale, planeSizeInVoxels, sizeInUnits, uvForPlane } from "../zarr-data";

export type VoxelTile = {
    plane: AxisAlignedPlane; // the plane in which the tile sits
    realBounds: box2D; // in the space given by the axis descriptions of the omezarr dataset
    bounds: box2D; // in voxels, in the plane
    planeIndex: number; // the index of this slice along the axis being sliced (orthoganal to plane)
    layerIndex: number; // the index in the resolution pyramid of the omezarr dataset
}

function getAllTiles(idealTilePx: vec2, layerSize: vec2) {
    // return the set of all our "tiles" of this layer, given the tilePx size
    const tiles: box2D[] = [];
    for (let x = 0; x < layerSize[0]; x += idealTilePx[0]) {
        for (let y = 0; y < layerSize[1]; y += idealTilePx[1]) {
            const xy: vec2 = [x, y];
            tiles.push(Box2D.create(xy, Vec2.min(Vec2.add(xy, idealTilePx), layerSize)));
        }
    }
    return tiles;
}
export function getVisibleTiles(
    camera: {
        view: box2D,
        screenSize: vec2,
    },
    plane: AxisAlignedPlane,
    planeIndex: number,
    dataset: ZarrDataset,
    tileSize: number
): VoxelTile[] {
    const uv = uvForPlane(plane);
    const layer = pickBestScale(dataset, uv, camera.view, camera.screenSize);
    // TODO: open the array, look at its chunks, use that size for the size of the tiles I request!
    const layerIndex = dataset.multiscales[0].datasets.indexOf(layer);

    const size = planeSizeInVoxels(uv, dataset.multiscales[0].axes, layer);
    const realSize = sizeInUnits(uv, dataset.multiscales[0].axes, layer);
    if (!size || !realSize) return [];
    const scale = Vec2.div(realSize, size);
    // to go from a voxel-box to a real-box:
    const vxlToReal = (vxl: box2D) => Box2D.translate(Box2D.scale(vxl, scale), [0, 0]);

    // find the tiles, in voxels, to request...
    const allTiles = getAllTiles([tileSize, tileSize], size);
    // TODO: this is a pretty slow, and also somewhat flickery way to do this
    const inView = allTiles.filter((tile) => !!Box2D.intersection(camera.view, vxlToReal(tile)));

    return inView.map((uv) => ({
        plane,
        realBounds: vxlToReal(uv),
        bounds: uv,
        planeIndex,
        layerIndex,
    }))
}

export const defaultDecoder = getSlice