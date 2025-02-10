import { Box2D, Vec2, type vec2 } from '@alleninstitute/vis-geometry';
import { type AsyncDataCache, beginLongRunningFrame } from '@alleninstitute/vis-scatterbrain';
import type REGL from 'regl';
import type { Camera } from '~/common/camera';
import { fetchItem, getVisibleItemsInSlide } from '~/common/loaders/scatterplot/data';
import type { ColumnRequest, ColumnarTree } from '~/common/loaders/scatterplot/scatterbrain-loader';
import type { DynamicGrid, DynamicGridSlide } from '../data-sources/scatterplot/dynamic-grid';
import type { buildRenderer as buildScatterplotRenderer } from './scatterplot';
import type { RenderCallback } from './types';
import { applyOptionalTrn } from './utils';
type CacheContentType = {
    type: 'vbo';
    data: REGL.Buffer;
};

type Renderer = ReturnType<typeof buildScatterplotRenderer>;
export type RenderSettings<C> = {
    camera: Camera;
    cache: AsyncDataCache<string, string, C>;
    renderer: Renderer;
    regl: REGL.Regl;
    callback: RenderCallback;
    concurrentTasks?: number;
    queueInterval?: number;
    cpuLimit?: number;
};
const cacheKey = (reqKey: string, item: ColumnarTree<vec2>, settings: { colorBy: ColumnRequest }) =>
    `${reqKey}:${item.content.name}:${settings.colorBy.name}|${settings.colorBy.type}`;
export function renderSlide<C extends CacheContentType | object>(
    target: REGL.Framebuffer2D | null,
    slide: DynamicGridSlide,
    settings: RenderSettings<C>,
) {
    const {
        cache,
        camera: { view, screen },
        renderer,
        callback,
        regl,
    } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;

    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5;
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33;
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined;

    const { dataset, colorBy, pointSize } = slide;
    const unitsPerPixel = Vec2.div(Box2D.size(view), screen);

    camera = {
        ...camera,
        view: applyOptionalTrn(camera.view, slide.toModelSpace, true),
    };
    // camera = camera.projection === 'webImage' ? flipY(camera) : camera;
    const items = getVisibleItemsInSlide(slide.dataset, slide.slideId, settings.camera.view, 10 * unitsPerPixel[0]);
    // make the frame, return some junk
    return beginLongRunningFrame(
        concurrentTasks,
        queueInterval,
        items,
        cache,
        { view, dataset, target, colorBy, regl, pointSize },
        fetchItem,
        renderer,
        callback,
        cacheKey,
        cpuLimit,
    );
}

export function renderDynamicGrid<C extends CacheContentType | object>(
    target: REGL.Framebuffer2D | null,
    grid: DynamicGrid,
    settings: RenderSettings<C>,
) {
    const {
        cache,
        camera: { view, screen },
        renderer,
        callback,
        regl,
    } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;

    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5;
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33;
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined;
    const items: ColumnarTree<vec2>[] = [];
    const { dataset, pointSize } = grid;
    const unitsPerPixel = Vec2.div(Box2D.size(view), screen);
    const rowSize = Math.floor(Math.sqrt(Object.keys(dataset.slides).length));
    camera = {
        ...camera,
        view: applyOptionalTrn(camera.view, grid.toModelSpace, true),
    };
    Object.keys(dataset.slides).forEach((slideId, i) => {
        const slide = dataset.slides[slideId];
        const gridIndex: vec2 = [i % rowSize, Math.floor(i / rowSize)];
        const { bounds } = dataset;
        const offset = Vec2.mul(gridIndex, Box2D.size(bounds));
        const realBounds = Box2D.translate(bounds, offset);
        if (Box2D.intersection(view, realBounds)) {
            items.push(
                ...getVisibleItemsInSlide(grid.dataset, slide.id, settings.camera.view, 10 * unitsPerPixel[0]).map(
                    (t) => ({ ...t, offset }),
                ),
            );
        }
    });
    const { colorBy } = grid;
    // make the frame, return some junk
    return beginLongRunningFrame(
        concurrentTasks,
        queueInterval,
        items,
        cache,
        { view, dataset, target, colorBy, regl, pointSize },
        fetchItem,
        renderer,
        callback,
        cacheKey,
        cpuLimit,
    );
}
