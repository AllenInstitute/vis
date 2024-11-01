import REGL from 'regl'
import { Box2D, type Interval, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import {
    type Renderer,
    type ReglCacheEntry,
    type CachedTexture,
    buildAsyncRenderer,
} from '@alleninstitute/vis-scatterbrain';
import type { AxisAlignedPlane, ZarrDataset, ZarrRequest } from '../zarr-data';
import { buildTileRenderer } from './tile-renderer';
import { type VoxelTile, getVisibleTiles } from './loader';

type RenderSettings = {
    camera: {
        view: box2D;
        screenSize: vec2;
    };
    planeIndex: number,
    tileSize: number,
    plane: AxisAlignedPlane,
    gamut: Record<'R' | 'G' | 'B', { gamut: Interval; index: number }>;
}
export type OmeZarrDataset = ZarrDataset

// represent a 2D slice of a volume

// a slice of a volume (as voxels suitable for display)
export type VoxelTileImage = {
    data: Float32Array;
    shape: number[];
};
type GpuData = {
    R: CachedTexture,
    G: CachedTexture,
    B: CachedTexture,
};
function toZarrRequest(tile: VoxelTile, channel: number): ZarrRequest {
    const { plane, planeIndex, bounds } = tile;
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
                z: planeIndex,
            };
        case 'xz':
            return {
                x: u,
                z: v,
                t: 0,
                c: channel,
                y: planeIndex,
            };
        case 'yz':
            return {
                y: u,
                z: v,
                t: 0,
                c: channel,
                x: planeIndex,
            };
    }
}
function isPrepared(cacheData: Record<string, ReglCacheEntry | undefined>): cacheData is GpuData {
    return 'R' in stuff && 'G' in stuff && 'B' in stuff &&
        stuff.R?.type === 'texture' && stuff.G?.type === 'texture' && stuff.B?.type === 'texture'
}
const intervalToVec2 = (i: Interval): vec2 => [i.min, i.max]

type Decoder = (dataset: OmeZarrDataset, req: ZarrRequest, layerIndex: number) => Promise<VoxelTileImage>
export function buildOmeZarrSliceRenderer(regl: REGL.Regl, decoder: Decoder): Renderer<OmeZarrDataset, VoxelTile, RenderSettings, GpuData> {

    function sliceAsTexture(slice: VoxelTileImage): CachedTexture {
        const { data, shape } = slice;
        return {
            bytes: data.byteLength,
            texture: regl.texture({ data: data, width: shape[1], height: shape[0], format: 'luminance' }),
            type: 'texture'
        }
    }
    const cmd = buildTileRenderer(regl);
    return {
        cacheKey: (item, requestKey, dataset, settings) => {
            const col = requestKey as keyof RenderSettings['gamut']
            const index = settings.gamut[col]?.index ?? 0;
            return `${dataset.url}_${JSON.stringify(item)}_ch=${index.toFixed(0)}`
        },
        destroy: () => { },
        getVisibleItems: (dataset, settings) => {
            const { camera, plane, planeIndex, tileSize } = settings;
            return getVisibleTiles(camera, plane, planeIndex, dataset, tileSize)
        },
        fetchItemContent: (item, dataset, settings, signal) => {
            return {
                R: () => decoder(dataset, toZarrRequest(item, settings.gamut.R.index), item.layerIndex).then(sliceAsTexture),
                G: () => decoder(dataset, toZarrRequest(item, settings.gamut.G.index), item.layerIndex).then(sliceAsTexture),
                B: () => decoder(dataset, toZarrRequest(item, settings.gamut.B.index), item.layerIndex).then(sliceAsTexture),
            }
        },
        isPrepared,
        renderItem: (target, item, dataset, settings, gpuData) => {
            const { R, G, B } = gpuData;
            const { camera } = settings;
            const Rgamut = intervalToVec2(settings.gamut.R.gamut)
            const Ggamut = intervalToVec2(settings.gamut.G.gamut)
            const Bgamut = intervalToVec2(settings.gamut.B.gamut)
            cmd({
                R: R.texture,
                G: G.texture,
                B: B.texture,
                Rgamut,
                Ggamut,
                Bgamut,
                rotation: 0,
                target,
                tile: Box2D.toFlatArray(item.realBounds),
                view: Box2D.toFlatArray(camera.view),
            })
        },
    }
}
export function buildAsyncOmezarrRenderer(regl: REGL.Regl, decoder: Decoder) {
    return buildAsyncRenderer(buildOmeZarrSliceRenderer(regl, decoder))
}