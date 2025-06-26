import {
    buildAsyncRenderer,
    type CachedVertexBuffer,
    type QueueOptions,
    type Renderer,
} from '@alleninstitute/vis-core';
import type REGL from 'regl';
import {
    type AnnotationInfo,
    chunkSizeInXY,
    dimensionScaleXYZ,
    extractPoint,
    getAnnotations,
    visitChunksInLayer,
} from '../loader/annotations';
import { Box3D, type box3D, type vec2, Vec2, type vec3, Vec3 } from '@alleninstitute/vis-geometry';
import { buildPointRenderer } from './pointAnnotationRenderer';

export type AnnotationChunk = {
    layerIndex: number;
    layerKey: string;
    chunk_file: string;
    cell: readonly number[];
    numAnnotations: number;
};
type Settings = {
    camera: {
        view: box3D;
        screenSize: vec2;
    };
    lodThreshold: number; // a chunk must be bigger than this value, in screen pixels, to be drawn
    // NG precomputed annotations have arbitrary dimensionality - xyz maps any 3 dimensions [foo,bar,baz] to [x,y,z]
    xyz: readonly [string, string, string];
    color: vec3;
    outlineColor: vec3;
};
type PointAnnotationData = {
    positions: CachedVertexBuffer;
};
type PointAnnotationInfo = AnnotationInfo<'point'> & { url: string };

function getVisibleItems(data: PointAnnotationInfo, settings: Settings) {
    // find all chunks that intersect our given view
    // so long as each chunk's xy-projected width and height is greater than
    // lodThreshold
    const items: AnnotationChunk[] = [];
    const { camera, xyz, lodThreshold } = settings;
    const vSize = Vec3.xy(Box3D.size(camera.view));
    const pxPerUnit = Vec2.div(camera.screenSize, vSize);

    for (let i = 0; i < data.spatial.length; i++) {
        //check if the layer is above the LOD floor:
        const cSize = chunkSizeInXY(data, i, [xyz[0], xyz[1]]);
        // lSize is in data-units.
        const cPxSize = Vec2.mul(pxPerUnit, cSize);
        // cPxSize is the size a chunk would appear to occupy, in screen px
        if (cPxSize[0] > lodThreshold || cPxSize[1] > lodThreshold) {
            visitChunksInLayer(data, i, camera.view, xyz, (dataset, cell, l) => {
                items.push({
                    layerIndex: i,
                    layerKey: data.spatial[i].key,
                    chunk_file: cell.join('_'),
                    cell,
                    numAnnotations: Number(data.spatial[i].limit),
                });
            });
        } else {
            // abort the loop over all layers early - this layer's chunks
            // are too small to see, and that will be even more the case
            // as we proceed.
            break;
        }
    }
    return items;
}

export function buildNGPointAnnotationRenderer(
    regl: REGL.Regl,
): Renderer<PointAnnotationInfo, AnnotationChunk, Settings, PointAnnotationData> {
    const cmd = buildPointRenderer(regl);
    return {
        destroy: () => {},
        getVisibleItems,
        isPrepared: (cacheData): cacheData is PointAnnotationData => {
            return 'positions' in cacheData && cacheData.positions?.type === 'buffer';
        },
        cacheKey(item, requestKey, data, settings) {
            const { xyz } = settings;
            return `${data.url}${item.layerKey}/${item.chunk_file}(${xyz.join('|')})`;
        },
        fetchItemContent(item, dataset, settings, signal) {
            return {
                positions: async () => {
                    const scale = dimensionScaleXYZ(dataset, settings.xyz);
                    const { stream, numAnnotations } = await getAnnotations(
                        dataset.url,
                        dataset,
                        { level: item.layerIndex, cell: item.cell },
                        extractPoint,
                    );

                    // TODO: we could... upload the whole buffer to GPU
                    // and use vertex binding strides to get at the data...
                    // however the buffer is way bigger than we need (ids...)
                    // and there are annoying byte alignment issues to consider - lets try this for now, maybe it will be fast enough
                    const xyzs = new Float32Array(Number(numAnnotations) * 3);
                    let i = 0;

                    for (const v of stream) {
                        xyzs[i * 3] = scale[0] * (v.point[settings.xyz[0]] ?? 0);
                        xyzs[i * 3 + 1] = scale[1] * (v.point[settings.xyz[1]] ?? 0);
                        xyzs[i * 3 + 2] = scale[2] * (v.point[settings.xyz[2]] ?? 0);
                        i += 1;
                    }
                    return {
                        buffer: regl.buffer(xyzs),
                        bytes: xyzs.byteLength,
                        type: 'buffer',
                    };
                },
            };
        },
        renderItem(target: REGL.Framebuffer2D | null, item, dataset, settings, points) {
            const { color, outlineColor, camera } = settings;
            const { view } = camera;
            cmd({
                color,
                outlineColor,
                positions: points.positions.buffer,
                pointSize: 8,
                target,
                view,
                count: item.numAnnotations,
            });
        },
    };
}

export function buildAsyncNGPointRenderer(regl: REGL.Regl, options?: QueueOptions) {
    return buildAsyncRenderer(buildNGPointAnnotationRenderer(regl), options);
}
