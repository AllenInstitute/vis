// import { cacheKeyFactory, getVisibleTiles, requestsForTile, type VoxelTile, type buildVolumeSliceRenderer } from "../../../omezarr-viewer/src/slice-renderer";

import type REGL from "regl";
import { beginLongRunningFrame, type AsyncDataCache } from "@alleninstitute/vis-scatterbrain";
import type { AxisAlignedZarrSlice, Camera, OptionalTransform, RenderCallback } from "./types";
import { cacheKeyFactory, getVisibleTiles, requestsForTile, type buildVersaRenderer, type VoxelSliceRenderSettings, type VoxelTile } from "../../../omezarr-viewer/src/versa-renderer";
import { pickBestScale, sizeInUnits, sizeInVoxels, sliceDimensionForPlane, uvForPlane } from "~/loaders/ome-zarr/zarr-data";
import { applyOptionalTrn } from "./utils";
import { Vec2, type vec2 } from "@alleninstitute/vis-geometry";
import type { VolumeGridData } from "../types";

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

export function renderGrid<C extends (CacheContentType | object)>(target: REGL.Framebuffer2D | null, grid: VolumeGridData, settings: RenderSettings<C>) {
    const { cache, renderer, callback, regl } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;
    const { dataset, gamut, plane, slices } = grid
    const { axes } = dataset.multiscales[0];
    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined
    const halfRes = Vec2.scale(camera.screen, 0.5);
    const rowSize = Math.floor(Math.sqrt(slices));
    const allItems: VoxelTile[] = [];
    const smokeAndMirrors:VoxelTile[]=[]
    const best = pickBestScale(dataset, uvForPlane(plane), camera.view, halfRes);
    for (let i = 0; i < slices; i++) {
        const gridIndex: vec2 = [i % rowSize, Math.floor(i / rowSize)]

        let param = i / slices;
        const slice: AxisAlignedZarrSlice & OptionalTransform = { ...grid, planeParameter: param }
        const curCam = { ...camera, view: applyOptionalTrn(camera.view, slice.toModelSpace, true) }

        const dim = sizeInVoxels(sliceDimensionForPlane(plane), axes, best);
        const realSize = sizeInUnits(plane, axes, best)!;
        const offset = Vec2.mul(gridIndex, realSize)

        const planeIndex = Math.round(param * (dim ?? 0))
        // get all the items for the lowest level of detail:
        const lowResItems = getVisibleTiles({ ...curCam, screen: [1,1] }, plane, planeIndex, dataset, offset);
        smokeAndMirrors.push(...lowResItems.tiles)
        const items = getVisibleTiles({ ...curCam, screen: halfRes }, plane, planeIndex, dataset, offset);
        allItems.push(...items.tiles)
    }
    console.log(`start a frame on layer ${best.path} with ${allItems.length} tiles`)
    const frame = beginLongRunningFrame<CacheContentType | object, VoxelTile, VoxelSliceRenderSettings>(5, 33,
        [...smokeAndMirrors,...allItems], cache,
        {
            dataset,
            gamut,
            regl,
            rotation: grid.rotation,
            target,
            view: camera.view,
            viewport: {
                x: 0, y: 0,
                width: camera.screen[0],
                height: camera.screen[1]
            },
        }, requestsForTile, renderer, callback, cacheKeyFactory);
    return frame;
}

export function renderSlice<C extends (CacheContentType | object)>(target: REGL.Framebuffer2D | null, slice: AxisAlignedZarrSlice & OptionalTransform, settings: RenderSettings<C>) {
    const { cache, renderer, callback, regl } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;
    const { dataset, planeParameter, gamut, plane } = slice
    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined
    const halfRes = Vec2.scale(camera.screen, 0.5);
    // TODO: handle optional transform!
    // convert planeParameter to planeIndex - which requires knowing the bounds of the appropriate dimension
    camera = { ...camera, view: applyOptionalTrn(camera.view, slice.toModelSpace, true) }
    const best = pickBestScale(dataset, uvForPlane(plane), camera.view, halfRes);
    const axes = dataset.multiscales[0].axes;
    const dim = sizeInVoxels(sliceDimensionForPlane(plane), axes, best);
    const planeIndex = Math.round(planeParameter * (dim ?? 0))

    const items = getVisibleTiles({ ...camera, screen: halfRes }, plane, planeIndex, dataset);
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