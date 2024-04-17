import { beginLongRunningFrame, type AsyncDataCache, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
import type REGL from "regl";
import { buildRenderer as buildScatterplotRenderer } from "../../../scatterplot/src/renderer";
import { Box2D, Vec2, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { fetchItem, getVisibleItemsInSlide } from "~/loaders/scatterplot/data";
import type { ColumnData } from "~/loaders/scatterplot/scatterbrain-loader";
import type { Camera, DynamicGridSlide, OptionalTransform, RenderCallback } from "./types";
type CacheContentType = ColumnData

type Renderer = ReturnType<typeof buildScatterplotRenderer>
export type RenderSettings<C> = {
    camera: Camera;
    target: REGL.Framebuffer2D
    cache: AsyncDataCache<string, string, C>;
    renderer: Renderer,
    callback: RenderCallback,
    concurrentTasks?: number,
    queueInterval?: number,
    cpuLimit?: number,
}
export function renderSlide<C extends (CacheContentType | object)>(slide: DynamicGridSlide & OptionalTransform, settings: RenderSettings<C>) {
    const { cache, target, camera: { view, screen }, renderer, callback } = settings;
    let { concurrentTasks, queueInterval, cpuLimit } = settings;

    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined

    const { dataset } = slide;
    const unitsPerPixel = Vec2.div(Box2D.size(view), screen);
    // get the items
    // TODO: apply the optionalTransform, otherwise this will all be wrong!
    const items = getVisibleItemsInSlide(slide.dataset, slide.slideId, settings.camera.view, 10 * unitsPerPixel[0])
    // make the frame, return some junk
    return beginLongRunningFrame(concurrentTasks, queueInterval, items, cache,
        { view, dataset, target }, fetchItem, renderer, callback,
        (reqKey, item, _settings) => `${reqKey}:${item.content.name}`,
        cpuLimit);
}