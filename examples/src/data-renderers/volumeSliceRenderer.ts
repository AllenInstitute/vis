import type REGL from 'regl';
import { beginLongRunningFrame, type AsyncDataCache } from '@alleninstitute/vis-scatterbrain';
import type { RenderCallback } from './types';

import { applyOptionalTrn } from './utils';
import { Box2D, Vec2, type vec2 } from '@alleninstitute/vis-geometry';
import type { AxisAlignedZarrSlice } from '../data-sources/ome-zarr/planar-slice';
import type { AxisAlignedZarrSliceGrid } from '../data-sources/ome-zarr/slice-grid';
import {
    pickBestScale,
    sizeInUnits,
    sizeInVoxels,
    sliceDimensionForPlane,
    uvForPlane,
} from '@alleninstitute/vis-omezarr';
import {
    cacheKeyFactory,
    getVisibleTiles,
    requestsForTile,
    type AxisAlignedPlane,
    type buildVersaRenderer,
    type VoxelSliceRenderSettings,
    type VoxelTile,
} from './versa-renderer';
import type { Camera } from '~/common/camera';

type Renderer = ReturnType<typeof buildVersaRenderer>;
type CacheContentType = { type: 'texture2D'; data: REGL.Texture2D };

export type RenderSettings<C> = {
    camera: Camera;
    cache: AsyncDataCache<string, string, C>;
    renderer: Renderer;
    callback: RenderCallback;
    regl: REGL.Regl;
    concurrentTasks?: number;
    queueInterval?: number;
    cpuLimit?: number;
};

function preferCachedEntries<C extends CacheContentType | object>(
    grid: AxisAlignedZarrSliceGrid,
    settings: VoxelSliceRenderSettings,
    offset: vec2,
    cache: AsyncDataCache<string, string, C>,
    camera: Camera,
    location: {
        plane: AxisAlignedPlane;
        planeIndex: number;
    }
) {
    const { plane, planeIndex } = location;
    const idealTiles = getVisibleTiles(camera, plane, planeIndex, grid.dataset, offset);
    const fakes: VoxelTile[] = [];

    for (const tile of idealTiles.tiles) {
        const isCached = (t: VoxelTile) => {
            const requests = requestsForTile(t, settings);
            const cacheKeys = Object.keys(requests).map((rq) => cacheKeyFactory(rq, t, settings));
            return cache.areKeysAllCached(cacheKeys);
        };
        if (!isCached(tile)) {
            // search a different layer for a stand-in in this area... feels pretty slow...
            // for now just stick with the most low-res layer...
            const lowerLOD = getVisibleTiles(
                { ...camera, view: tile.realBounds, screen: [1, 1] },
                plane,
                planeIndex,
                grid.dataset,
                offset
            );
            fakes.push(...lowerLOD.tiles);
        }
    }
    return { fake: fakes, ideal: idealTiles };
}
// todo: write a helper function that makes much smarter descisions about
// what (already cached) tiles to use for this frame, given the view, the dataset,
// and the cache (and the cache-key-factory...)

export function renderGrid<C extends CacheContentType | object>(
    target: REGL.Framebuffer2D | null,
    grid: AxisAlignedZarrSliceGrid,
    settings: RenderSettings<C>
) {
    const { cache, renderer, callback, regl } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;
    const { dataset, gamut, plane, slices } = grid;
    const { axes } = dataset.multiscales[0];
    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 10;
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33;
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined;
    const rowSize = Math.floor(Math.sqrt(slices));
    const allItems: VoxelTile[] = [];
    const smokeAndMirrors: VoxelTile[] = [];
    const best = pickBestScale(dataset, uvForPlane(plane), camera.view, camera.screen);

    const renderSettings = {
        dataset,
        gamut,
        regl,
        rotation: grid.rotation,
        target,
        view: camera.view,
        viewport: {
            x: 0,
            y: 0,
            width: camera.screen[0],
            height: camera.screen[1],
        },
    };

    for (let i = 0; i < slices; i++) {
        const gridIndex: vec2 = [i % rowSize, Math.floor(i / rowSize)];

        let param = i / slices;
        const slice: AxisAlignedZarrSlice = { ...grid, type: 'AxisAlignedZarrSlice', planeParameter: param };
        const curCam = { ...camera, view: applyOptionalTrn(camera.view, slice.toModelSpace, true) };
        const dim = sizeInVoxels(sliceDimensionForPlane(plane), axes, best);
        const realSize = sizeInUnits(plane, axes, best)!;
        const offset = Vec2.mul(gridIndex, realSize);
        // the bounds of this slice might not even be in view!
        // if we did this a bit different... we could know from the index, without having to conditionally test... TODO
        if (Box2D.intersection(curCam.view, Box2D.translate(Box2D.create([0, 0], realSize), offset))) {
            const planeIndex = Math.round(param * (dim ?? 0));
            const { fake, ideal } = preferCachedEntries(grid, renderSettings, offset, cache, curCam, {
                plane,
                planeIndex,
            });
            // get all the items for the lowest level of detail:
            smokeAndMirrors.push(...fake);
            allItems.push(...ideal.tiles);
        }
    }
    const frame = beginLongRunningFrame<CacheContentType | object, VoxelTile, VoxelSliceRenderSettings>(
        concurrentTasks,
        queueInterval,
        [...smokeAndMirrors, ...allItems],
        cache,
        renderSettings,
        requestsForTile,
        renderer,
        callback,
        cacheKeyFactory,
        cpuLimit
    );
    return frame;
}

export function renderSlice<C extends CacheContentType | object>(
    target: REGL.Framebuffer2D | null,
    slice: AxisAlignedZarrSlice,
    settings: RenderSettings<C>
) {
    const { cache, renderer, callback, regl } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;
    const { dataset, planeParameter, gamut, plane } = slice;
    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5;
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33;
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined;
    const desiredResolution = camera.screen;
    // convert planeParameter to planeIndex - which requires knowing the bounds of the appropriate dimension
    camera = { ...camera, view: applyOptionalTrn(camera.view, slice.toModelSpace, true) };
    const best = pickBestScale(dataset, uvForPlane(plane), camera.view, desiredResolution);
    const axes = dataset.multiscales[0].axes;
    const dim = sizeInVoxels(sliceDimensionForPlane(plane), axes, best);
    const planeIndex = Math.round(planeParameter * (dim ?? 0));

    const items = getVisibleTiles({ ...camera, screen: desiredResolution }, plane, planeIndex, dataset);
    const frame = beginLongRunningFrame<CacheContentType | object, VoxelTile, VoxelSliceRenderSettings>(
        concurrentTasks,
        queueInterval,
        items.tiles,
        cache,
        {
            dataset,
            gamut,
            regl,
            rotation: slice.rotation,
            target,
            view: items.view,
            viewport: {
                x: 0,
                y: 0,
                width: camera.screen[0],
                height: camera.screen[1],
            },
        },
        requestsForTile,
        renderer,
        callback,
        cacheKeyFactory,
        cpuLimit
    );
    return frame;
}
