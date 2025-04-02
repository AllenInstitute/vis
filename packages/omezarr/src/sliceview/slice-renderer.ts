import { Box2D, type CartesianPlane, type Interval, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import { type CachedTexture, type ReglCacheEntry, type Renderer, buildAsyncRenderer } from '@alleninstitute/vis-core';
import type REGL from 'regl';
import type { ZarrRequest } from '../zarr/loading';
import { type VoxelTile, getVisibleTiles } from './loader';
import { buildTileRenderer } from './tile-renderer';
import type { OmeZarrMetadata, OmeZarrShapedDataset } from '../zarr/types';

type RenderSettings = {
    camera: {
        view: box2D;
        screenSize: vec2;
    };
    orthoVal: number; // the value of the orthogonal axis, e.g. Z value relative to an XY plane
    tileSize: number;
    plane: CartesianPlane;
    gamut: Record<'R' | 'G' | 'B', { gamut: Interval; index: number }>;
};

// represent a 2D slice of a volume

// a slice of a volume (as voxels suitable for display)
export type VoxelTileImage = {
    data: Float32Array;
    shape: number[];
};
type ImageChannels = {
    R: CachedTexture;
    G: CachedTexture;
    B: CachedTexture;
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
    return (
        'R' in cacheData &&
        'G' in cacheData &&
        'B' in cacheData &&
        cacheData.R?.type === 'texture' &&
        cacheData.G?.type === 'texture' &&
        cacheData.B?.type === 'texture'
    );
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
    const cmd = buildTileRenderer(regl);
    return {
        cacheKey: (item, requestKey, dataset, settings) => {
            const col = requestKey as keyof RenderSettings['gamut'];
            const index = settings.gamut[col]?.index ?? 0;
            return `${dataset.url}_${JSON.stringify(item)}_ch=${index.toFixed(0)}`;
        },
        destroy: () => {},
        getVisibleItems: (dataset, settings) => {
            const { camera, plane, orthoVal, tileSize } = settings;
            return getVisibleTiles(camera, plane, orthoVal, dataset, tileSize);
        },
        fetchItemContent: (item, dataset, settings, signal) => {
            return {
                R: () => decoder(dataset, toZarrRequest(item, settings.gamut.R.index), item.level).then(sliceAsTexture),
                G: () => decoder(dataset, toZarrRequest(item, settings.gamut.G.index), item.level).then(sliceAsTexture),
                B: () => decoder(dataset, toZarrRequest(item, settings.gamut.B.index), item.level).then(sliceAsTexture),
            };
        },
        isPrepared,
        renderItem: (target, item, _, settings, gpuData) => {
            const { R, G, B } = gpuData;
            const { camera } = settings;
            const Rgamut = intervalToVec2(settings.gamut.R.gamut);
            const Ggamut = intervalToVec2(settings.gamut.G.gamut);
            const Bgamut = intervalToVec2(settings.gamut.B.gamut);
            cmd({
                R: R.texture,
                G: G.texture,
                B: B.texture,
                Rgamut,
                Ggamut,
                Bgamut,
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
