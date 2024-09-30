import { Box2D, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import {
    type Renderer,
    type ReglCacheEntry,
    type CachedTexture,
    buildAsyncRenderer,
} from '@alleninstitute/vis-scatterbrain';
import type REGL from 'regl';
import { type DziImage, type DziTile, getVisibleTiles } from './loader';
import { buildTileRenderer } from './tile-renderer';

export type RenderSettings = {
    camera: {
        view: box2D;
        screenSize: vec2;
    };
};

type GpuProps = {
    pixels: CachedTexture;
};
export function buildDziRenderer(regl: REGL.Regl): Renderer<DziImage, DziTile, RenderSettings, GpuProps> {
    const renderCmd = buildTileRenderer(regl, { enable: false });
    const fetchDziTile = (
        tile: DziTile,
        _img: DziImage,
        _settings: RenderSettings,
        _abort?: AbortSignal
    ): Record<string, () => Promise<ReglCacheEntry>> => {
        return {
            pixels: () => {
                return new Promise<ReglCacheEntry>((resolve, reject) => {
                    try {
                        const img = new Image();
                        img.crossOrigin = 'anonymous';
                        img.onload = (ev) => {
                            resolve({ type: 'texture', texture: regl.texture(img), bytes: img.width * img.height * 4 }); // close enough
                        };
                        img.src = tile.url;
                    } catch (err) {
                        reject(err);
                    }
                });
            },
        };
    };
    return {
        destroy: () => { }, // no private resources to destroy
        cacheKey: (item, _requestKey, _data, _settings) => `${item.url}`,
        fetchItemContent: fetchDziTile,
        getVisibleItems: (dzi, settings) => {
            return getVisibleTiles(dzi, settings.camera);
        },
        isPrepared: (cacheData): cacheData is GpuProps => {
            const pixels = cacheData['pixels'];
            return !!pixels && pixels.type === 'texture';
        },
        renderItem: (target, tile, _dzi, settings, gpuData) => {
            const { pixels } = gpuData;
            const { camera } = settings;
            renderCmd({
                target,
                depth: -tile.layer / 1000,
                img: pixels.texture,
                tile: Box2D.toFlatArray(tile.relativeLocation),
                view: Box2D.toFlatArray(camera.view),
            });
        },
    };
}

export function buildAsyncDziRenderer(regl: REGL.Regl) {
    return buildAsyncRenderer(buildDziRenderer(regl));
}
