import { type AsyncDataCache, beginLongRunningFrame, logger } from '@alleninstitute/vis-core';
import type REGL from 'regl';
import type { RenderCallback } from './types';

import { Box2D, CartesianPlane, Vec2, type vec2 } from '@alleninstitute/vis-geometry';
import { pickBestScale, sizeInUnits, sizeInVoxels } from '@alleninstitute/vis-omezarr';
import type { Camera } from '~/common/camera';
import type { AxisAlignedZarrSlice } from '../data-sources/ome-zarr/planar-slice';
import type { AxisAlignedZarrSliceGrid } from '../data-sources/ome-zarr/slice-grid';
import { applyOptionalTrn } from './utils';
import {
    type VoxelSliceRenderSettings,
    type VoxelTile,
    type buildVersaRenderer,
    cacheKeyFactory,
    getVisibleTiles,
    requestsForTile,
} from './versa-renderer';

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
        plane: CartesianPlane;
        orthoVal: number;
    },
) {
    const { plane, orthoVal } = location;
    const idealTiles = getVisibleTiles(camera, plane, orthoVal, grid.metadata, offset);
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
                orthoVal,
                grid.metadata,
                offset,
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
    settings: RenderSettings<C>,
) {
    const { cache, renderer, callback, regl } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;
    const { metadata, gamut, plane: aaPlane, slices } = grid;
    const plane = new CartesianPlane(aaPlane);
    const { axes } = metadata.attrs.multiscales[0];
    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 10;
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33;
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined;
    const rowSize = Math.floor(Math.sqrt(slices));
    const allItems: VoxelTile[] = [];
    const smokeAndMirrors: VoxelTile[] = [];
    const best = pickBestScale(metadata, plane, camera.view, camera.screen);

    const renderSettings = {
        metadata,
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

        const param = i / slices;
        const slice: AxisAlignedZarrSlice = {
            ...grid,
            plane: new CartesianPlane(grid.plane),
            type: 'AxisAlignedZarrSlice',
            planeParameter: param,
        };
        const curCam = {
            ...camera,
            view: applyOptionalTrn(camera.view, slice.toModelSpace, true),
        };
        const dim = sizeInVoxels(plane.ortho, axes, best);
        const realSize = sizeInUnits(plane, axes, best);

        if (!realSize) {
            logger.warn('no size for plane', plane, axes, best);
            continue;
        }

        const offset = Vec2.mul(gridIndex, realSize);
        // the bounds of this slice might not even be in view!
        // if we did this a bit different... we could know from the index, without having to conditionally test... TODO
        if (Box2D.intersection(curCam.view, Box2D.translate(Box2D.create([0, 0], realSize), offset))) {
            const orthoVal = Math.round(param * (dim ?? 0));
            const { fake, ideal } = preferCachedEntries(grid, renderSettings, offset, cache, curCam, {
                plane,
                orthoVal,
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
        cpuLimit,
    );
    return frame;
}

export function renderSlice<C extends CacheContentType | object>(
    target: REGL.Framebuffer2D | null,
    slice: AxisAlignedZarrSlice,
    settings: RenderSettings<C>,
) {
    const { cache, renderer, callback, regl } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;
    const { metadata, planeParameter, gamut, plane } = slice;
    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5;
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33;
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined;
    const desiredResolution = camera.screen;
    // convert planeParameter to planeIndex - which requires knowing the bounds of the appropriate dimension
    camera = {
        ...camera,
        view: applyOptionalTrn(camera.view, slice.toModelSpace, true),
    };
    const best = pickBestScale(metadata, plane, camera.view, desiredResolution);
    const axes = metadata.attrs.multiscales[0].axes;
    const dim = sizeInVoxels(plane.ortho, axes, best);
    const orthoVal = Math.round(planeParameter * (dim ?? 0));

    const items = getVisibleTiles({ ...camera, screen: desiredResolution }, plane, orthoVal, metadata);
    const frame = beginLongRunningFrame<CacheContentType | object, VoxelTile, VoxelSliceRenderSettings>(
        concurrentTasks,
        queueInterval,
        items.tiles,
        cache,
        {
            metadata,
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
        cpuLimit,
    );
    return frame;
}
