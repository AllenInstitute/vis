import { cacheKeyFactory, getVisibleTiles, requestsForTile, type VoxelSliceRenderSettings, type VoxelTile, type buildVolumeSliceRenderer } from "../../../omezarr-viewer/src/slice-renderer";

import type REGL from "regl";
import { beginLongRunningFrame, type AsyncDataCache } from "@alleninstitute/vis-scatterbrain";
import type {Camera, OptionalTransform, RenderCallback } from "./types";
import type { ColumnData } from "~/loaders/scatterplot/scatterbrain-loader";
import { Box2D, type box2D, type vec2, type vec4 } from "@alleninstitute/vis-geometry";
import type { Path, buildLineRenderer, buildPathRenderer } from "./lineRenderer";
import type { TaggedFloat32Array } from "~/typed-array";
import { flatten } from "lodash";

type Renderer = ReturnType<typeof buildPathRenderer>;

export type SimpleAnnotation = {
    paths: Array<Path>
}
export type RenderSettings = {
    camera: Camera;
    cache: AsyncDataCache<string, string, ColumnData|object>;
    renderer: Renderer,
    callback: RenderCallback,
    regl: REGL.Regl,
    concurrentTasks?: number,
    queueInterval?: number,
    cpuLimit?: number,
}
function getVisibleStrokes(camera:Camera,layer:SimpleAnnotation&OptionalTransform){
    return layer.paths.filter((p)=>!!Box2D.intersection(camera.view,p.bounds))
}

function requestsForPath(p:Path){
    return {
        'position':()=>Promise.resolve({
            type:'float',
            data:new Float32Array(flatten(p.points))
        })
    }
}
export function renderAnnotationLayer(
    target:REGL.Framebuffer2D|null,
    layer:SimpleAnnotation&OptionalTransform,
    settings: RenderSettings
){
    const {camera,cache,renderer,callback} =settings;
    const items = getVisibleStrokes(camera,layer)
    return beginLongRunningFrame<ColumnData|object,Path,{view:box2D,target:REGL.Framebuffer2D|null}>(
        5,33,
        items,cache,
        {
            view:camera.view,
            target
        },
        requestsForPath,
        renderer,
        callback,
        (rq:string,path:Path)=>`${rq}_${path.id}`
    )
}