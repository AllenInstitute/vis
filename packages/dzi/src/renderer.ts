import { Box2D, type box2D, type vec2 } from "@alleninstitute/vis-geometry"
import { beginLongRunningFrame, AsyncDataCache, type RenderFn, type RenderCallback } from '@alleninstitute/vis-scatterbrain';
import type REGL from 'regl';
import { type DziImage, type DziTile, getVisibleTiles } from "./loader";
import { buildTileRenderer } from "./tile-renderer";
import type { Framebuffer2D } from "regl";
type CacheContentType = { type: 'texture2D'; data: REGL.Texture2D };
type RenderSettings = {
    camera: {
        view: box2D;
        screenSize: vec2;
    },
    regl: REGL.Regl;
}
type WithCache = {
    callback: RenderCallback;
    cache: AsyncDataCache<string, string, CacheContentType>
}
function cacheKey(req: string, item: DziTile, settings: RenderSettings) {
    return item.url;
}
// let cnvs: HTMLCanvasElement | null = null;
// function getCtx(width: number, height: number) {
//     if (!cnvs) {
//         cnvs = document.createElement('canvas');
//     }
//     cnvs.width = width;
//     cnvs.height = height;
//     return cnvs.getContext('2d');
// }
// function decode(img: HTMLImageElement) {
//     const { width, height } = img;
//     const ctx = getCtx(width, height)
//     if (ctx) {
//         ctx?.drawImage(img, 0, 0);
//         const pixels = ctx.getImageData(0, 0, width, height);
//         return pixels.data;
//     }
//     return null;
// }


export function buildRenderer(regl: REGL.Regl): RenderFn<DziImage, RenderSettings & WithCache> {
    const render = buildTileRenderer(regl, { enable: false })
    const dziTileRenderer = (tile: DziTile, settings: RenderSettings & { target: Framebuffer2D | null }, columns: Record<string, CacheContentType | undefined>) => {
        const { pixels } = columns
        const { target, camera } = settings;
        if (pixels && pixels.type === 'texture2D') {
            render({
                depth: tile.layer / 1000,
                img: pixels.data,
                tile: Box2D.toFlatArray(tile.relativeLocation),
                view: Box2D.toFlatArray(camera.view),
                target
            })
        }
    }
    return function renderDziImage(target: REGL.Framebuffer2D | null, img: DziImage, settings: RenderSettings & WithCache) {
        const things = getVisibleTiles(img, settings.camera);
        return beginLongRunningFrame<CacheContentType, DziTile, RenderSettings & { target: Framebuffer2D | null }>(5, 33, things, settings.cache, { ...settings, target }, fetchDziTile, dziTileRenderer, settings.callback, cacheKey, 10)
    }
}


function fetchDziTile(tile: DziTile, settings: RenderSettings, _abort?: AbortSignal): Record<string, () => Promise<CacheContentType>> {
    return {
        pixels: () => {
            return new Promise<CacheContentType>((resolve, reject) => {
                try {
                    const img = new Image()
                    img.onload = (ev) => {
                        resolve({ type: 'texture2D', data: settings.regl.texture(img) })
                    }
                    img.src = tile.url;
                } catch (err) {
                    reject(err);
                }
            })
        }
    }
}
