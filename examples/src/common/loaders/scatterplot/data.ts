// todo rename this file

import { Box2D, type box2D, type vec2, visitBFS } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';
import {
    type ColumnData,
    type ColumnRequest,
    type ColumnarNode,
    type ColumnarTree,
    type SlideViewDataset,
    fetchColumn,
    type loadDataset,
} from './scatterbrain-loader';
export type Dataset = ReturnType<typeof loadDataset>;
export type RenderSettings = {
    dataset: Dataset;
    view: box2D;
    colorBy: ColumnRequest;
    pointSize: number;
    target: REGL.Framebuffer2D | null;
    regl: REGL.Regl;
};

function isVisible(view: box2D, sizeLimit: number, tree: ColumnarTree<vec2>) {
    const { bounds } = tree.content;
    return Box2D.size(bounds)[0] > sizeLimit && !!Box2D.intersection(view, tree.content.bounds);
}
export function getVisibleItems(dataset: Dataset, view: box2D, sizeLimit: number) {
    const hits: ColumnarTree<vec2>[] = [];
    const tree = 'slides' in dataset ? Object.values(dataset.slides)[0].tree : dataset.tree;
    visitBFS(
        tree,
        (t: ColumnarTree<vec2>) => t.children,
        (tree) => {
            hits.push(tree);
        },
        (tree) => isVisible(view, sizeLimit, tree),
    );
    return hits;
}
export function getVisibleItemsInSlide(dataset: SlideViewDataset, slide: string, view: box2D, sizeLimit: number) {
    const theSlide = dataset.slides[slide];
    if (!theSlide) {
        console.log('nope', Object.keys(dataset.slides));
        return [];
    }

    const hits: ColumnarTree<vec2>[] = [];
    const tree = theSlide.tree;
    visitBFS(
        tree,
        (t: ColumnarTree<vec2>) => t.children,
        (tree) => {
            hits.push(tree);
        },
        (tree) => isVisible(view, sizeLimit, tree),
    );
    return hits;
}
function toReglBuffer(c: ColumnData, regl: REGL.Regl) {
    return {
        type: 'vbo',
        data: regl.buffer(c),
    } as const;
}
function fetchAndUpload(
    settings: { dataset: Dataset; regl: REGL.Regl },
    node: ColumnarNode<vec2>,
    req: ColumnRequest,
    signal?: AbortSignal | undefined,
) {
    const { dataset, regl } = settings;
    return fetchColumn(node, dataset, req, signal).then((cd) => toReglBuffer(cd, regl));
}
export function fetchItem(item: ColumnarTree<vec2>, settings: RenderSettings, signal?: AbortSignal) {
    const { dataset, colorBy } = settings;
    const position = () =>
        fetchAndUpload(settings, item.content, { type: 'METADATA', name: dataset.spatialColumn }, signal);
    const color = () => fetchAndUpload(settings, item.content, colorBy, signal);
    return {
        position,
        color,
    } as const;
}
