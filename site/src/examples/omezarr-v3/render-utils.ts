import type { SharedPriorityCache, CachedTexture, Cacheable } from '@alleninstitute/vis-core';
import type { vec2 } from '@alleninstitute/vis-geometry';
import {
    buildOmeZarrPlanarRenderer,
    type OmeZarrFileset,
    type PlanarRenderSettings,
    type PlanarVoxelTile,
    type OmeZarrVoxelTileImageDecoder,
} from '@alleninstitute/vis-omezarr';
import type REGL from 'regl';

class Tex implements Cacheable {
    texture: CachedTexture;
    constructor(tx: CachedTexture) {
        this.texture = tx;
    }
    destroy() {
        this.texture.texture.destroy();
    }
    sizeInBytes() {
        return this.texture.bytes;
    }
}

type Thing = {
    tile: PlanarVoxelTile;
    dataset: OmeZarrFileset;
    settings: PlanarRenderSettings;
};

function mapValues<T extends Record<string, V>, V, R>(obj: T, fn: (v: V) => R): { [k in keyof T]: R } {
    return (Object.keys(obj) as (keyof T)[]).reduce(
        // typecast is annoyingly necessary in this case to avoid a linting warning
        (acc, k) => {
            acc[k] = fn(obj[k]);
            return acc;
        },
        {} as { [k in keyof T]: R },
    );
}

export function buildConnectedRenderer(
    regl: REGL.Regl,
    screenSize: vec2,
    cache: SharedPriorityCache,
    decoder: OmeZarrVoxelTileImageDecoder,
    onData: () => void,
) {
    //@ts-expect-error
    const renderer = buildOmeZarrPlanarRenderer(regl, decoder);
    const client = cache.registerClient<Thing, Record<string, Tex>>({
        cacheKeys: (item) => {
            const channelKeys = Object.keys(item.settings.channels);
            return channelKeys.reduce<Record<string, string>>((chans, key) => {
                chans[key] = renderer.cacheKey(item.tile, key, item.dataset, item.settings);
                return chans;
            }, {});
        },
        fetch: (item) => {
            // the Renderer<...> type obscures the fact that these are always cached textures... TODO  fix that?
            // for now, this typecast is legit
            const channels = renderer.fetchItemContent(item.tile, item.dataset, item.settings) as Record<
                string,
                (sig: AbortSignal) => Promise<CachedTexture>
            >;
            return mapValues(channels, (v: (sig: AbortSignal) => Promise<CachedTexture>) => {
                return (sig: AbortSignal) => v(sig).then((tex) => new Tex(tex));
            });
        },
        isValue: (v): v is Record<string, Tex> =>
            renderer.isPrepared(
                mapValues(v, (tx: Cacheable | undefined) => (tx && tx instanceof Tex ? tx.texture : undefined)),
            ),
        onDataArrived: onData,
    });

    const [width, height] = screenSize;
    const target: REGL.Framebuffer2D = regl.framebuffer({ width, height });
    return {
        copyPixels: (canvas: CanvasRenderingContext2D) => {
            const copyBuffer = regl.read({
                framebuffer: target,
                x: 0,
                y: 0,
                width,
                height,
                data: new Uint8Array(width * height * 4),
            });
            // read and copy?
            const img = new ImageData(new Uint8ClampedArray(copyBuffer), width, height);
            canvas.putImageData(img, 0, 0);
        },
        render: (dataset: OmeZarrFileset, settings: PlanarRenderSettings) => {
            const items = renderer.getVisibleItems(dataset, settings);
            const baselayer = renderer.getVisibleItems(dataset, {
                ...settings,
                camera: { ...settings.camera, screenSize: [1, 1] },
            });
            client.setPriorities(
                new Set(items.map((tile) => ({ tile, dataset, settings }))),
                new Set(baselayer.map((tile) => ({ tile, dataset, settings }))),
            );

            regl.clear({ framebuffer: target, color: [0, 0, 0, 1], depth: 1 });
            for (const tile of [...baselayer, ...items]) {
                const drawme = client.get({ tile, dataset, settings });

                if (drawme !== undefined) {
                    renderer.renderItem(
                        target,
                        tile,
                        dataset,
                        settings,
                        // { ...settings, camera: { ...settings.camera, view: upsideDown } },
                        mapValues(drawme, (d: Tex) => d.texture),
                    );
                }
            }
        },
        destroy: () => {
            target.destroy();
            client.unsubscribeFromCache();
        },
    };
}
