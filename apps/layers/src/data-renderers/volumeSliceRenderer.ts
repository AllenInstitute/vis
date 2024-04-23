// import { cacheKeyFactory, getVisibleTiles, requestsForTile, type VoxelTile, type buildVolumeSliceRenderer } from "../../../omezarr-viewer/src/slice-renderer";

import type REGL from "regl";
import { beginLongRunningFrame, type AsyncDataCache } from "@alleninstitute/vis-scatterbrain";
import type { AxisAlignedZarrSlice, Camera, OptionalTransform, RenderCallback } from "./types";
import { cacheKeyFactory, getVisibleTiles, requestsForTile, type buildVersaRenderer, type VoxelSliceRenderSettings, type VoxelTile } from "../../../omezarr-viewer/src/versa-renderer";
import { pickBestScale, sizeInVoxels } from "~/loaders/ome-zarr/zarr-data";

type Renderer = ReturnType<typeof buildVersaRenderer>;
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
const uvTable = {
    xy: { u: "x", v: "y" },
    xz: { u: "x", v: "z" },
    yz: { u: "y", v: "z" },
} as const;
const sliceDimension = {
    xy: "z",
    xz: "y",
    yz: "x",
} as const;


export function renderSlice<C extends (CacheContentType | object)>(target: REGL.Framebuffer2D | null, slice: AxisAlignedZarrSlice & OptionalTransform, settings: RenderSettings<C>) {
    const { cache, camera, renderer, callback, regl } = settings;
    let { concurrentTasks, queueInterval, cpuLimit } = settings;
    const { dataset, planeParameter, gamut, plane } = slice
    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined

    // TODO: handle optional transform!
    // convert planeParameter to planeIndex - which requires knowing the bounds of the appropriate dimension

    const best = pickBestScale(dataset, uvTable[plane], camera.view, camera.screen);
    const axes = dataset.multiscales[0].axes;
    const dim = sizeInVoxels(sliceDimension[plane], axes, best);
    const planeIndex = Math.round(planeParameter * (dim ?? 0))

    const items = getVisibleTiles(camera, plane, planeIndex, dataset);
    const frame = beginLongRunningFrame<CacheContentType | object, VoxelTile, VoxelSliceRenderSettings>(5, 33,
        items.tiles, cache,
        {
            dataset,
            gamut,
            regl,
            rotation: slice.rotation,
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