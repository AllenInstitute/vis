
import {
    type Renderer,
    type ReglCacheEntry,
    type CachedTexture,
    buildAsyncRenderer,
    type CachedVertexBuffer,
} from '@alleninstitute/vis-scatterbrain';
// lets see if we can use the simple renderer in a more complex case - constellations have multiple passes and pre-allocated (weird) data
// also, they're animated, and not really spatially indexed...

import type REGL from "regl";
import { buildConstellationBuffers, exampleTaxonomy, type TaxonomyFeatures } from './loader';
import { fetchColumn, type ColumnRequest, type ColumnarTree, type ColumnarNode, type ScatterplotDataset, type ColumnData } from '~/common/loaders/scatterplot/scatterbrain-loader';
import { Box2D, Vec2, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import { buildTaxonomyRenderer, type TaxonomyGpuBuffers, type TaxonomyRenderSettings, } from './taxonomy-renderer';
import { getVisibleItems } from '~/common/loaders/scatterplot/data';
import { buildEdgeRenderer } from './edge-renderer';

type Constellation = ScatterplotDataset & TaxonomyFeatures
type ConstellationChunk = ColumnarTree<vec2>

export type ConstellationRenderSettings = Omit<TaxonomyRenderSettings, 'taxonomyPositions' | 'taxonomySize' | 'target'>


function isPrepared(cacheData: Record<string, ReglCacheEntry | undefined>): cacheData is TaxonomyGpuBuffers {
    return 'position' in cacheData &&
        'Class' in cacheData &&
        'SubClass' in cacheData &&
        'SuperType' in cacheData &&
        'Cluster' in cacheData &&
        cacheData['position']?.type === 'buffer' &&
        cacheData['Class']?.type === 'buffer' &&
        cacheData['SubClass']?.type === 'buffer' &&
        cacheData['SuperType']?.type === 'buffer' &&
        cacheData['Cluster']?.type === 'buffer';

}

export async function buildConstellationRenderer(regl: REGL.Regl) {

    const { texture, edgesByLevel, size } = await buildConstellationBuffers(exampleTaxonomy);
    const taxonomyData = regl.texture({ data: texture, width: size[0], height: size[1], format: 'rgba', type: 'float' })
    const edgeBuffers = edgesByLevel.map((lvl) => {
        if (lvl) {
            return { start: regl.buffer(lvl.start), end: regl.buffer(lvl.end), pStart: regl.buffer(lvl.pStart), pEnd: regl.buffer(lvl.pEnd), count: lvl.count }
        }
        return null;
    });
    // we just created some static resources that our renderer will use over and over.
    // when we delete that renderer, we should clean up!
    const destroy = () => {
        taxonomyData.destroy();
        edgeBuffers.map(layer => {
            layer?.pEnd.destroy();
            layer?.pStart.destroy();
            layer?.start.destroy();
            layer?.end.destroy();
        });
    }
    const dotRenderCmd = buildTaxonomyRenderer(regl);
    const edgeRenderCmd = buildEdgeRenderer(regl);
    const dotRenderer: Renderer<Constellation, ConstellationChunk, ConstellationRenderSettings, TaxonomyGpuBuffers> = {
        destroy,
        cacheKey: (item, rqKey, dataset, settings) => cacheKey(item, rqKey, settings),
        fetchItemContent: (item, dataset, settings, signal) => {
            const { Class, SubClass, SuperType, Cluster } = dataset;
            const fetchSettings = { dataset, regl };
            const position = () =>
                fetchAndUpload(fetchSettings, item.content, { type: 'METADATA', name: dataset.spatialColumn }, signal);
            const cls = () => fetchAndUpload(fetchSettings, item.content, Class, signal);
            const sub = () => fetchAndUpload(fetchSettings, item.content, SubClass, signal);
            const spr = () => fetchAndUpload(fetchSettings, item.content, SuperType, signal);
            const clstr = () => fetchAndUpload(fetchSettings, item.content, Cluster, signal);
            return {
                position,
                Class: cls,
                SubClass: sub,
                SuperType: spr,
                Cluster: clstr,
            } as const;
        },
        getVisibleItems: (dataset, settings) => {
            // because we move points around with our taxonomy shader, we cant rely on the positions in the quad-tree to 
            // let us cut down the points we request... for now just get all of them!
            const { view, screen } = settings.camera;
            const unitsPerPixel = Vec2.div(Box2D.size(view), screen);
            return getVisibleItems(dataset, dataset.bounds, 200 * unitsPerPixel[0])
        },
        isPrepared,
        renderItem: (target, item, dataset, settings, gpuData) => {
            dotRenderCmd(item, { ...settings, target, taxonomyPositions: taxonomyData, taxonomySize: size, }, gpuData);
            // is here the right place to render the edges? maybe!
        },
    }

    const edgeRenderer = (props: {
        anmParam: number,
        anmGoal: number,
        view: box2D,
        focus: vec2
        target: REGL.Framebuffer2D | null,
    }) => {
        const { anmGoal, view, anmParam, target, focus } = props;
        const stable = anmGoal == anmParam;
        const animationDirection = stable ? (n: number) => n - Math.floor(n) : (n: number) => 1.0 - (n - Math.floor(n))
        const edges = edgeBuffers[Math.ceil(anmParam)];
        const parentEdges = edgeBuffers[Math.floor(anmParam)]
        if (edges) {
            edgeRenderCmd({
                anmParam: animationDirection(anmParam),
                color: [1, 1, 1, 1], // TODO remove unused
                start: edges.start,
                end: edges.end,
                focus,
                instances: edges.count,
                pStart: edges.pStart,
                pEnd: edges.pEnd,
                target,
                taxonLayer: Math.ceil(anmParam),
                taxonomyPositions: taxonomyData,
                taxonomySize: size,
                view: Box2D.toFlatArray(view)
            })
        }
        if (!stable && parentEdges) {
            edgeRenderCmd({
                color: [0.4, 0.45, 0.5, 0.8],
                anmParam: 1.0 - animationDirection(anmParam),
                taxonomyPositions: taxonomyData,
                taxonomySize: size,
                start: parentEdges.start,
                end: parentEdges.end,
                pStart: parentEdges.pStart,
                pEnd: parentEdges.pEnd,
                instances: parentEdges.count,
                target,
                taxonLayer: Math.floor(anmParam),
                focus,
                view: Box2D.toFlatArray(view)
            })
        }
    }

    return {
        dotRenderer,
        edgeRenderer
    }

}
export async function buildAsyncConstellationRenderer(regl: REGL.Regl) {
    const { dotRenderer, edgeRenderer } = await buildConstellationRenderer(regl);
    return { dotRenderer: buildAsyncRenderer(dotRenderer), edgeRenderer }
}

// WARNING: this cache key is ok because this is a demo - 
// make sure to carefully consider cache behavior here when following this example
const cacheKey = (item: ColumnarTree<vec2>, reqKey: string, settings: ConstellationRenderSettings) =>
    `${reqKey}:${item.content.name}`;

function toReglBuffer(c: ColumnData, regl: REGL.Regl): CachedVertexBuffer {
    return {
        buffer: regl.buffer(c),
        bytes: c.data.byteLength,
        type: 'buffer'
    }
}
function fetchAndUpload(
    settings: { dataset: ScatterplotDataset; regl: REGL.Regl },
    node: ColumnarNode<vec2>,
    req: ColumnRequest,
    signal?: AbortSignal | undefined
) {
    const { dataset, regl } = settings;
    return fetchColumn(node, dataset, req, signal).then((cd) => toReglBuffer(cd, regl));
}