import { cacheKeyFactory, getVisibleTiles, requestsForTile, type VoxelSliceRenderSettings, type VoxelTile, type buildVolumeSliceRenderer } from "../../../omezarr-viewer/src/slice-renderer";

import type REGL from "regl";
import { beginLongRunningFrame, type AsyncDataCache } from "@alleninstitute/vis-scatterbrain";
import type { AxisAlignedZarrSlice, Camera, OptionalTransform, RenderCallback } from "./types";

type Renderer = ReturnType<typeof buildVolumeSliceRenderer>;
type CacheContentType = { type: 'texture2D', data: REGL.Texture2D };

export type RenderSettings<C> = {
    camera: Camera;
    cache: AsyncDataCache<string, string, C>;
    renderer: Renderer,
    callback: RenderCallback,
    regl: REGL.Regl,
    concurrentTasks?: number,
    queueInterval?: number,
    cpuLimit?: number,
}
export function renderSlice<C extends (CacheContentType | object)>(target: REGL.Framebuffer2D|null, slice: AxisAlignedZarrSlice & OptionalTransform, settings: RenderSettings<C>) {
    const { cache, camera, renderer, callback, regl } = settings;
    let { concurrentTasks, queueInterval, cpuLimit } = settings;
    const { dataset, planeParameter, gamut,plane } = slice
    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined

    // TODO: handle optional transform!

    const items = getVisibleTiles(camera, plane, planeParameter, dataset);
    const frame = beginLongRunningFrame<CacheContentType | object, VoxelTile, VoxelSliceRenderSettings>(5, 33,
        items.tiles, cache,
        {
            dataset,
            gamut: gamut[0] ?? { min: 0, max: 500 },
            regl,
            rotation: (3 * Math.PI) / 2,
            target,
            view: items.view,
            viewport: {
                x: 0, y: 0,
                width: camera.screen[0],
                height: camera.screen[1]
            },
        }, requestsForTile, renderer, callback, cacheKeyFactory);
    return frame;
}