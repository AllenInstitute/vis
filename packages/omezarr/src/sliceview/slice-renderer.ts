import { Box2D, type CartesianPlane, type Interval, type box2D, type vec2, type vec3 } from '@alleninstitute/vis-geometry';
import {
    type CachedTexture,
    type ReglCacheEntry,
    type Renderer,
    buildAsyncRenderer,
} from '@alleninstitute/vis-scatterbrain';
import type REGL from 'regl';
import type { ZarrRequest } from '../zarr/loading';
import { type VoxelTile, getVisibleTiles } from './loader';
import { buildGenericTileRenderer, buildTileRenderer } from './tile-renderer';
import type { OmeZarrMetadata, OmeZarrShapedDataset } from '../zarr/types';

const keysOf = function(obj: any) {
    return Object.getOwnPropertyNames(obj);
};

type RenderSettings = {
    camera: {
        view: box2D;
        screenSize: vec2;
    };
    orthoVal: number; // the value of the orthogonal axis, e.g. Z value relative to an XY plane
    tileSize: number;
    plane: CartesianPlane;
    channels: {
        [key: string]: {
            index: number,
            gamut: Interval,
            color: vec3
        }
    };
};

// represent a 2D slice of a volume

// a slice of a volume (as voxels suitable for display)
export type VoxelTileImage = {
    data: Float32Array;
    shape: number[];
};
type ImageChannels = {
    [channelKey: string]: CachedTexture;
};
function toZarrRequest(tile: VoxelTile, channel: number): ZarrRequest {
    const { plane, orthoVal, bounds } = tile;
    const { minCorner: min, maxCorner: max } = bounds;
    const u = { min: min[0], max: max[0] };
    const v = { min: min[1], max: max[1] };
    switch (plane) {
        case 'xy':
            return {
                x: u,
                y: v,
                t: 0,
                c: channel,
                z: orthoVal,
            };
        case 'xz':
            return {
                x: u,
                z: v,
                t: 0,
                c: channel,
                y: orthoVal,
            };
        case 'yz':
            return {
                y: u,
                z: v,
                t: 0,
                c: channel,
                x: orthoVal,
            };
    }
}
function isPrepared(cacheData: Record<string, ReglCacheEntry | undefined>): cacheData is ImageChannels {
    if (!cacheData) {
        return false;
    }
    const keys = keysOf(cacheData);
    if (keys.length < 1) {
        return false;
    }
    return keys.every((key) => cacheData[key]?.type === 'texture');
}
const intervalToVec2 = (i: Interval): vec2 => [i.min, i.max];

type Decoder = (dataset: OmeZarrMetadata, req: ZarrRequest, level: OmeZarrShapedDataset) => Promise<VoxelTileImage>;

export function buildOmeZarrSliceRenderer(
    regl: REGL.Regl,
    decoder: Decoder,
): Renderer<OmeZarrMetadata, VoxelTile, RenderSettings, ImageChannels> {
    function sliceAsTexture(slice: VoxelTileImage): CachedTexture {
        const { data, shape } = slice;
        return {
            bytes: data.byteLength,
            texture: regl.texture({
                data: data,
                width: shape[1],
                height: shape[0],
                format: 'luminance',
            }),
            type: 'texture',
        };
    }
    const cmd = buildGenericTileRenderer(regl, 3);
    return {
        cacheKey: (item, requestKey, dataset, settings) => {
            return `${dataset.url}_${JSON.stringify(item)}_ch=${requestKey}`;
        },
        destroy: () => {},
        getVisibleItems: (dataset, settings) => {
            const { camera, plane, orthoVal, tileSize } = settings;
            return getVisibleTiles(camera, plane, orthoVal, dataset, tileSize);
        },
        fetchItemContent: (item, dataset, settings, signal) => {
            const keys = keysOf(settings.channels);
            const result = keys.map(
                (key) => ({ [key]: () => decoder(dataset, toZarrRequest(item, settings.channels[key].index), item.level).then(sliceAsTexture) })
            ).reduce(
                (prev, curr) => ({ ...prev, ...curr }), 
                {}
            );
            return result;
        },
        isPrepared,
        renderItem: (target, item, _, settings, gpuData) => {
            const channels = keysOf(gpuData).map((key) => (
                { 
                    tex: gpuData[key].texture, 
                    gamut: intervalToVec2(settings.channels[key].gamut), 
                    color: settings.channels[key].color 
                }
            ));
        
            const { camera } = settings;
            
            cmd({
                channels,
                target,
                tile: Box2D.toFlatArray(item.realBounds),
                view: Box2D.toFlatArray(camera.view),
            });
        },
    };
}
export function buildAsyncOmezarrRenderer(regl: REGL.Regl, decoder: Decoder) {
    return buildAsyncRenderer(buildOmeZarrSliceRenderer(regl, decoder));
}
