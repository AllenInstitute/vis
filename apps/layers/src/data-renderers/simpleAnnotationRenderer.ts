
import type REGL from "regl";
import { beginLongRunningFrame, type AsyncDataCache } from "@alleninstitute/vis-scatterbrain";
import type { RenderCallback } from "./types";
import type { ColumnData } from "Common/loaders/scatterplot/scatterbrain-loader";
import { Box2D, type box2D } from "@alleninstitute/vis-geometry";
import type { Path, buildPathRenderer } from "./lineRenderer";
import { flatten } from "lodash";
import type { OptionalTransform } from "../data-sources/types";
import type { Camera } from "../../../omezarr-viewer/src/camera";

type Renderer = ReturnType<typeof buildPathRenderer>;

export type SimpleAnnotation = {
    paths: Array<Path>
} & OptionalTransform
export type RenderSettings = {
    camera: Camera;
    cache: AsyncDataCache<string, string, ColumnData | object>;
    renderer: Renderer,
    callback: RenderCallback,
    regl: REGL.Regl,
    concurrentTasks?: number,
    queueInterval?: number,
    cpuLimit?: number,
}
function getVisibleStrokes(camera: Camera, layer: SimpleAnnotation) {
    return layer.paths.filter((p) => !!Box2D.intersection(camera.view, p.bounds))
}

function requestsForPath(p: Path) {
    return {
        'position': () => Promise.resolve({
            type: 'float',
            data: new Float32Array(flatten(p.points))
        })
    }
}
export function renderAnnotationLayer(
    target: REGL.Framebuffer2D | null,
    layer: SimpleAnnotation & OptionalTransform,
    settings: RenderSettings
) {
    const { camera, cache, renderer, callback } = settings;
    const items = getVisibleStrokes(camera, layer)
    return beginLongRunningFrame<ColumnData | object, Path, { view: box2D, target: REGL.Framebuffer2D | null }>(
        5, 33,
        items, cache,
        {
            view: camera.view,
            target
        },
        requestsForPath,
        renderer,
        callback,
        (rq: string, path: Path) => `${rq}_${path.id}_${path.points.length}`
    )
}