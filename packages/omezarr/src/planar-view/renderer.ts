import {
    buildAsyncRenderer,
    type CachedTexture,
    logger,
    type ReglCacheEntry,
    type Renderer,
} from '@alleninstitute/vis-core';
import { Box2D, type Interval, intervalToVec2, type OrthogonalCartesianAxes } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';
import { buildTileRenderCommand } from '../rendering/tile-rendering';
import type { OmeZarrDataContext, OmeZarrFileset, ZarrDataRequest, ZarrSlice } from '../zarr/omezarr-fileset';
import { getVisibleTiles } from './calculations';
import type { PlanarRenderSettings, PlanarRendererOptions, PlanarVoxelTile, PlanarVoxelTileImage } from './types';

type ImageChannels = {
    [channelKey: string]: CachedTexture;
};

function toZarrSlice(
    plane: OrthogonalCartesianAxes,
    u: Interval,
    v: Interval,
    channel: number,
    orthoVal: number,
): ZarrSlice {
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

function toZarrDataRequest(tile: PlanarVoxelTile, channel: number): ZarrDataRequest {
    const { plane, orthoVal, bounds } = tile;
    const { minCorner: min, maxCorner: max } = bounds;
    const u = { min: min[0], max: max[0] };
    const v = { min: min[1], max: max[1] };
    return {
        dataset: tile.dataContext.dataset.path,
        multiscale: tile.dataContext.multiscale.name,
        slice: toZarrSlice(plane, u, v, channel, orthoVal),
    };
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

export type OmeZarrVoxelTileImageDecoder = (
    fileset: OmeZarrFileset,
    req: ZarrDataRequest,
    dataContext: OmeZarrDataContext,
    signal?: AbortSignal,
) => Promise<PlanarVoxelTileImage>;

const DEFAULT_NUM_CHANNELS = 3;

export function buildOmeZarrPlanarRenderer(
    regl: REGL.Regl,
    decoder: OmeZarrVoxelTileImageDecoder,
    options?: PlanarRendererOptions | undefined,
): Renderer<OmeZarrFileset, PlanarVoxelTile, PlanarRenderSettings, ImageChannels> {
    const numChannels = options?.numChannels ?? DEFAULT_NUM_CHANNELS;
    function sliceAsTexture(slice: PlanarVoxelTileImage): CachedTexture {
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
    const cmd = buildTileRenderCommand(regl, numChannels);
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
                    decoder(
                        dataset,
                        toZarrDataRequest(item, settings.channels[key].index),
                        item.dataContext,
                        signal,
                    ).then(sliceAsTexture);
            }
            return contents;
        },
        isPrepared,
        renderItem: (target, item, _fileset, settings, gpuData) => {
            const channels = Object.keys(gpuData).map((key) => ({
                tex: gpuData[key].texture,
                gamut: intervalToVec2(settings.channels[key].gamut),
                rgb: settings.channels[key].rgb,
            }));
            const numLayers = item.dataContext.multiscale.datasets.length;
            // per the spec, the highest resolution layer should be first
            // we want that layer most in front, so:
            const depth = item.dataContext.datasetIndex / numLayers;
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

export function buildAsyncOmeZarrPlanarRenderer(
    regl: REGL.Regl,
    decoder: OmeZarrVoxelTileImageDecoder,
    options?: PlanarRendererOptions,
) {
    return buildAsyncRenderer(buildOmeZarrPlanarRenderer(regl, decoder, options), options?.queueOptions);
}
