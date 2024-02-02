import REGL from "regl";
import { ZarrDataset, ZarrRequest, getSlice, pickBestScale, sizeInVoxels } from "./zarr-data";
import { Box2D, Interval, Vec2, box2D, vec2, vec4 } from "@aibs-vis/geometry";
import { omit } from "lodash";
import { Camera } from "./camera";
import { NestedArray, TypedArray } from "zarr";

type Props = { tile: vec4; view: vec4; gamut: vec2; viewport: REGL.BoundingBox; R: REGL.Texture2D; G: REGL.Texture2D; B: REGL.Texture2D; };
export function buildVersaRenderer(regl: REGL.Regl) {
    const cmd = regl<
        { view: vec4; tile: vec4; R: REGL.Texture2D; G: REGL.Texture2D; B: REGL.Texture2D; gamut: vec2; },
        { pos: REGL.BufferData },
        Props
    >({
        vert: ` precision highp float;
    attribute vec2 pos;
        
        uniform vec4 view;
        uniform vec4 tile;
        varying vec2 texCoord;

        void main(){
           vec2 tileSize = tile.zw-tile.xy;
           texCoord = pos;
           vec2 obj = (pos.xy*tileSize+tile.xy);
            vec2 p = (obj-view.xy)/(view.zw-view.xy);
            // now, to clip space
            p = (p*2.0)-1.0;
            gl_Position = vec4(p.x,p.y,0.0,1.0);
        }`,
        frag: `
    precision highp float;
    uniform sampler2D R;
    uniform sampler2D G;
    uniform sampler2D B; // for reasons which are pretty annoying
    // its more direct to do 3 separate channels...
    uniform vec2 gamut;
    varying vec2 texCoord;
    void main(){
            float span = gamut.y-gamut.x;
            vec3 lum = vec3(
                texture2D(R, texCoord).r,
                texture2D(G, texCoord).r,
                texture2D(B, texCoord).r
            )/span-gamut.x;
            gl_FragColor = vec4(lum, 1.0);
        }`,
        attributes: {
            pos: [0, 0, 1, 0, 1, 1, 0, 1],
        },
        uniforms: {
            tile: regl.prop<Props, "tile">("tile"),
            view: regl.prop<Props, "view">("view"),
            R: regl.prop<Props, "R">("R"),
            G: regl.prop<Props, "G">("G"),
            B: regl.prop<Props, "B">("B"),
            gamut: regl.prop<Props, "gamut">("gamut"),
        },
        count: 4,
        // viewport: regl.prop<Props, "viewport">("viewport"),
        primitive: "triangle fan",
        // ... more!
    });

    return (item: VoxelTile, settings: VoxelSliceRenderSettings, channels: Record<string, Bfr | undefined>) => {
        const { view, viewport, gamut } = settings;
        const { bounds } = item;
        const { R, G, B } = channels;
        if (!R || !G || !B) return; // we cant render if the data for the positions is missing!
        cmd({
            view: [...view.minCorner, ...view.maxCorner],
            tile: [...bounds.minCorner, ...bounds.maxCorner],
            R, G, B,
            // viewport,
            gamut: [gamut.min, gamut.max],

        });
    };
}
type Bfr = REGL.Texture2D;

type Tile = { bounds: box2D };
export type VoxelSliceRenderSettings = {
    regl: REGL.Regl;
    dataset: ZarrDataset;
    view: box2D;
    gamut: Interval;
    viewport: REGL.BoundingBox;
};
export type AxisAlignedPlane = "xy" | "yz" | "xz";
export type VoxelTile = {
    plane: AxisAlignedPlane;
    bounds: box2D; // in voxels, in the plane
    planeIndex: number;
    layerIndex: number;
    // time and channel are always = 0, for now
};

function toZarrRequest(tile: VoxelTile, channel: number): ZarrRequest {
    const { plane, planeIndex, bounds } = tile;
    const { minCorner: min, maxCorner: max } = bounds;
    const u = { min: min[0], max: max[0] };
    const v = { min: min[1], max: max[1] };
    // in this type of data, we only support xy slices!
    return {
        x: u,
        y: v,
        t: 0,
        c: channel,
        z: planeIndex,
    };
}
export function cacheKeyFactory(col: string, item: VoxelTile, settings: VoxelSliceRenderSettings) {
    return `${settings.dataset.url}_${JSON.stringify(omit(item, "desiredResolution"))}_${col}`;
}
const LUMINANCE = "luminance";
export function requestsForTile(tile: VoxelTile, settings: VoxelSliceRenderSettings, signal?: AbortSignal) {
    const { dataset, regl } = settings;
    const handleResponse = (vxl: Awaited<ReturnType<typeof getSlice>>) => {
        const { shape, buffer } = vxl;
        const R = buffer.flatten();//(buffer.get([0, null, null]) as NestedArray<TypedArray>).flatten();
        const r = regl.texture({
            data: R, // new Float32Array(buffer),
            width: shape[1],
            height: shape[0], // TODO this swap is sus
            format: LUMINANCE,
        });
        return r;
    }
    // lets hope the browser caches our 3x repeat calls to teh same data...
    return {
        R: async () => {
            const vxl = await getSlice(dataset, toZarrRequest(tile, 0), tile.layerIndex);
            return handleResponse(vxl);
        },
        G: async () => {
            const vxl = await getSlice(dataset, toZarrRequest(tile, 1), tile.layerIndex);
            return handleResponse(vxl);
        },
        B: async () => {
            const vxl = await getSlice(dataset, toZarrRequest(tile, 2), tile.layerIndex);
            return handleResponse(vxl);
        },
    };
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
const uvTable = {
    xy: { u: "x", v: "y" },
    xz: { u: "x", v: "z" },
    yz: { u: "y", v: "z" },
} as const;

export function getVisibleTiles(
    camera: Camera,
    plane: AxisAlignedPlane,
    planeIndex: number,
    dataset: ZarrDataset,
): { view: box2D, tiles: VoxelTile[] } {
    const thingy = pickBestScale(dataset, uvTable[plane], camera.view, camera.screen);
    const layerIndex = dataset.multiscales[0].datasets.indexOf(thingy);

    const size = sizeInVoxels(uvTable[plane], dataset.multiscales[0].axes, thingy);
    if (!size) return { view: camera.view, tiles: [] };

    // camera.view is in a made up dataspace, where 1=height of the current dataset
    // thus, we have to convert it into a voxel-space camera for intersections
    const voxelView = Box2D.scale(camera.view, size);
    return {
        view: voxelView,
        tiles: getAllTiles([256, 256], size)
            .filter((tile) => !!Box2D.intersection(voxelView, tile))
            .map((uv) => ({
                plane,
                bounds: uv,
                planeIndex,
                layerIndex,
            }))
    }
}
