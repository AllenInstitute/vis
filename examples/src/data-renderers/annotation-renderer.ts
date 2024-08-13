import type REGL from 'regl';
import type { RenderCallback } from './types';
import { Box2D, Vec2, type box2D, type vec2, type vec4 } from '@alleninstitute/vis-geometry';
import type { AnnotationMesh, GPUAnnotationMesh } from '~/data-sources/annotation/types';
import type { buildLoopRenderer, buildMeshRenderer } from './mesh-renderer';
import type { OptionalTransform } from '~/data-sources/types';
import { AsyncDataCache, beginLongRunningFrame, type FrameLifecycle } from '@alleninstitute/vis-scatterbrain';
import { fetchAnnotation } from '~/data-sources/annotation/fetch-annotation';
import { MeshFromAnnotation } from '~/data-sources/annotation/annotation-to-mesh';
import type { AnnotationGrid } from '~/data-sources/annotation/annotation-grid';
import type { Camera } from '~/common/camera';

type SlideId = string;

type SlideAnnotations = {
    annotationBaseUrl: string;
    levelFeature: string;
    gridFeature: SlideId;
    bounds: box2D;
} & OptionalTransform;

export type LoopRenderer = ReturnType<typeof buildLoopRenderer>;
export type MeshRenderer = ReturnType<typeof buildMeshRenderer>;
export type CacheContentType = { type: 'mesh'; data: GPUAnnotationMesh };
type Settings = {
    regl: REGL.Regl;
    loopRenderer: LoopRenderer;
    meshRenderer: MeshRenderer;
    stencilMeshRenderer: MeshRenderer;
    camera: Camera;
    viewport: REGL.BoundingBox;
    target: REGL.Framebuffer | null;
    stroke: {
        width: number;
        overrideColor?: vec4;
        opacity: number; // set to zero to disable stroke-rendering
    };
    fill: {
        overrideColor?: vec4;
        opacity: number; // set to zero to disable fill-rendering
    };
};

function isMesh(obj: object | undefined): obj is CacheContentType {
    return !!(obj && 'type' in obj && obj.type === 'mesh');
}
function fetchAnnotationsForSlide(
    item: SlideAnnotations,
    settings: Settings,
    _abort: AbortSignal | undefined
): Record<string, () => Promise<CacheContentType | undefined>> {
    const { regl } = settings;
    const toCacheEntry = (m: AnnotationMesh | undefined): CacheContentType | undefined =>
        m
            ? {
                  type: 'mesh',
                  data: {
                      points: regl.buffer(m.points),
                      annotation: m,
                  },
              }
            : undefined;
    const getMesh = () => {
        return fetchAnnotation(item)
            .then((anno) => (anno ? MeshFromAnnotation(anno) : undefined))
            .then(toCacheEntry);
    };
    return { mesh: getMesh };
}

type RProps = Parameters<ReturnType<typeof buildLoopRenderer>>[0];

function renderSlideAnnotations(
    item: SlideAnnotations,
    settings: Settings,
    columns: Record<string, GPUAnnotationMesh | object | undefined>
) {
    const { camera, viewport, target, regl, loopRenderer, meshRenderer, stencilMeshRenderer } = settings;
    // const { view } = camera.projection === 'webImage' ? flipY(camera) : camera
    const { view } = camera;
    const offset = item.toModelSpace?.offset ?? [0, 0];
    const flatView = Box2D.toFlatArray(view);
    // gather all the props into an array for batching
    const { mesh } = columns;
    if (!mesh || !isMesh(mesh)) return;

    if (mesh.data.annotation.closedPolygons.length < 1) return;
    const { annotation, points } = mesh.data;
    const { closedPolygons: polygons } = annotation;
    const fadedColor = (clr: vec4, opacity: number) => [clr[0], clr[1], clr[2], opacity] as vec4;
    if (settings.fill.opacity > 0.0) {
        polygons.forEach((polygon) => {
            const color = settings.fill.overrideColor
                ? fadedColor(settings.fill.overrideColor, settings.fill.opacity)
                : fadedColor(polygon.color, settings.fill.opacity);
            if (polygon.loops.length > 0) {
                regl.clear({ stencil: 0, framebuffer: target });
                const stencilBatch = polygon.loops.map((fan) => ({
                    target,
                    viewport,
                    view: flatView,
                    count: fan.length,
                    position: { buffer: points, offset: fan.start * 8 },
                    color,
                    offset,
                }));
                stencilMeshRenderer(...stencilBatch);
                meshRenderer(...stencilBatch);
            }
        });
    }

    if (settings.stroke.opacity > 0.0) {
        const batched: RProps = [];
        for (const polygon of polygons) {
            for (const loop of polygon.loops) {
                const color = settings.stroke.overrideColor
                    ? fadedColor(settings.stroke.overrideColor, settings.stroke.opacity)
                    : fadedColor(polygon.color, settings.stroke.opacity);
                batched.push({
                    color,
                    count: loop.length - 1,
                    offset,
                    position: { buffer: points, offset: loop.start * 8 },
                    target,
                    view: flatView,
                    viewport,
                });
            }
        }
        loopRenderer(batched);
    }
}

export type RenderSettings<C> = {
    camera: Camera;
    regl: REGL.Regl;
    cache: AsyncDataCache<string, string, C>;
    renderers: {
        loopRenderer: LoopRenderer;
        meshRenderer: MeshRenderer;
        stencilMeshRenderer: MeshRenderer;
    };
    callback: RenderCallback;
    concurrentTasks?: number;
    queueInterval?: number;
    cpuLimit?: number;
};

export function renderAnnotationGrid(
    target: REGL.Framebuffer2D | null,
    grid: AnnotationGrid,
    settings: RenderSettings<CacheContentType | object | undefined>
): FrameLifecycle {
    const { dataset, annotationBaseUrl, levelFeature, stroke, fill } = grid;
    const {
        regl,
        cache,
        camera: { view, screen },
        renderers: { loopRenderer, meshRenderer, stencilMeshRenderer },
        callback,
    } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;

    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5;
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33;
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined;
    const items: SlideAnnotations[] = [];
    const rowSize = Math.floor(Math.sqrt(Object.keys(dataset.slides).length));

    Object.keys(dataset.slides).forEach((slideId, i) => {
        const gridIndex: vec2 = [i % rowSize, Math.floor(i / rowSize)];
        const { bounds } = dataset;
        const offset = Vec2.mul(gridIndex, Box2D.size(bounds));
        const realBounds = Box2D.translate(bounds, offset);
        if (Box2D.intersection(view, realBounds)) {
            items.push({
                annotationBaseUrl,
                gridFeature: slideId,
                levelFeature,
                bounds,
                toModelSpace: {
                    offset,
                    scale: [1, 1],
                },
            });
        }
    });
    const frame = beginLongRunningFrame<CacheContentType | object | undefined, SlideAnnotations, Settings>(
        concurrentTasks,
        queueInterval,
        items,
        cache,
        {
            ...settings,
            loopRenderer,
            meshRenderer,
            stencilMeshRenderer,
            regl,
            stroke,
            fill,
            target,
            viewport: {
                x: 0,
                y: 0,
                width: screen[0],
                height: screen[1],
            },
            camera,
        },
        fetchAnnotationsForSlide,
        renderSlideAnnotations,
        callback,
        (rq: string, item: SlideAnnotations, _settings: Settings) => `${rq}_${item.gridFeature}_${item.levelFeature}`,
        cpuLimit
    );
    return frame;
}
