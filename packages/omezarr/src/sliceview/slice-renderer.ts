import {
    Box2D,
    type CartesianPlane,
    type Interval,
    type box2D,
    type vec2,
    type vec3,
    intervalToVec2,
} from '@alleninstitute/vis-geometry';
import {
    type CachedTexture,
    type QueueOptions,
    type ReglCacheEntry,
    type Renderer,
    buildAsyncRenderer,
    logger,
} from '@alleninstitute/vis-core';
import type REGL from 'regl';
import type { ZarrRequest } from '../zarr/loading';
import { type VoxelTile, getVisibleTiles } from './loader';
import { buildTileRenderer } from './tile-renderer';
import type { OmeZarrMetadata, OmeZarrShapedDataset } from '../zarr/types';

export type RenderSettingsChannel = {
    index: number;
    gamut: Interval;
    rgb: vec3;
};

export type RenderSettingsChannels = {
    [key: string]: RenderSettingsChannel;
};
export type RenderSettings = {
    camera: {
        view: box2D;
        screenSize: vec2;
    };
    planeLocation: number;
    tileSize: number;
    plane: CartesianPlane;
    channels: RenderSettingsChannels;
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
    const keys = Object.keys(cacheData);
    if (keys.length < 1) {
        return false;
    }
    return keys.every((key) => cacheData[key]?.type === 'texture');
}

type Decoder = (
    dataset: OmeZarrMetadata,
    req: ZarrRequest,
    level: OmeZarrShapedDataset,
    signal?: AbortSignal,
) => Promise<VoxelTileImage>;

export type OmeZarrSliceRendererOptions = {
    numChannels?: number;
    queueOptions?: QueueOptions;
};

const DEFAULT_NUM_CHANNELS = 3;

export function buildOmeZarrSliceRenderer(
    regl: REGL.Regl,
    decoder: Decoder,
    options?: OmeZarrSliceRendererOptions | undefined,
): Renderer<OmeZarrMetadata, VoxelTile, RenderSettings, ImageChannels> {
    const numChannels = options?.numChannels ?? DEFAULT_NUM_CHANNELS;
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
    const cmd = buildTileRenderer(regl, numChannels);
    return {
        cacheKey: (item, requestKey, dataset, settings) => {
            const channelKeys = Object.keys(settings.channels);
            if (!channelKeys.includes(requestKey)) {
                const message = `cannot retrieve cache key: unrecognized requestKey [${requestKey}]`;
                logger.error(message);
                throw new Error(message);
            }
            return `${dataset.url}_${JSON.stringify(item)}_ch=${requestKey}`;
        },
        destroy: () => {},
        getVisibleItems: (dataset, settings) => {
            const { camera, plane, planeLocation, tileSize } = settings;
            return getVisibleTiles(camera, plane, planeLocation, dataset, tileSize);
        },
        fetchItemContent: (item, dataset, settings): Record<string, (sig: AbortSignal) => Promise<CachedTexture>> => {
            const contents: Record<string, (signal: AbortSignal) => Promise<CachedTexture>> = {};
            for (const key in settings.channels) {
                contents[key] = (signal) =>
                    decoder(dataset, toZarrRequest(item, settings.channels[key].index), item.level, signal).then(
                        sliceAsTexture,
                    );
            }
            return contents;
        },
        isPrepared,
        renderItem: (target, item, dataset, settings, gpuData) => {
            const channels = Object.keys(gpuData).map((key) => ({
                tex: gpuData[key].texture,
                gamut: intervalToVec2(settings.channels[key].gamut),
                rgb: settings.channels[key].rgb,
            }));
            const layers = dataset.getNumLayers();
            // per the spec, the highest resolution layer should be first
            // we want that layer most in front, so:
            const depth = item.level.datasetIndex / layers;
            const { camera } = settings;
            cmd({
                channels,
                target,
                depth,
                tile: Box2D.toFlatArray(item.realBounds),
                view: Box2D.toFlatArray(camera.view),
            });
        },
    };
}

export function buildAsyncOmezarrRenderer(regl: REGL.Regl, decoder: Decoder, options?: OmeZarrSliceRendererOptions) {
    return buildAsyncRenderer(buildOmeZarrSliceRenderer(regl, decoder, options), options?.queueOptions);
}
