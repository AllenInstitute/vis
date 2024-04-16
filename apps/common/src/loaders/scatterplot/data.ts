
// todo rename this file

import { Box2D, visitBFS, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { fetchColumn, type ColumnarTree, type SlideViewDataset, type loadDataset } from "./scatterbrain-loader";
import REGL from 'regl'
export type Dataset = ReturnType<typeof loadDataset>
export type RenderSettings = {
    dataset: Dataset;
    view: box2D;
    target: REGL.Framebuffer2D | null;
}
function isVisible(view: box2D, sizeLimit: number, tree: ColumnarTree<vec2>) {
    const { bounds } = tree.content;
    return Box2D.size(bounds)[0] > sizeLimit && !!Box2D.intersection(view, tree.content.bounds);
}
export function getVisibleItems(dataset: Dataset, view: box2D, sizeLimit: number) {
    const hits: ColumnarTree<vec2>[] = []
    let tree = 'slides' in dataset ? Object.values(dataset.slides)[0].tree : dataset.tree;
    visitBFS(tree,
        (t: ColumnarTree<vec2>) => t.children,
        (tree) => { hits.push(tree) },
        (tree) => isVisible(view, sizeLimit, tree));
    return hits;
}
export function getVisibleItemsInSlide(dataset: SlideViewDataset, slide: string, view: box2D, sizeLimit: number){
    const theSlide =  dataset.slides[slide];
    if(!theSlide){
        console.log('nope', Object.keys(dataset.slides))
        return []
    } 

    const hits: ColumnarTree<vec2>[] = []
    const tree = theSlide.tree;
    visitBFS(tree,
        (t: ColumnarTree<vec2>) => t.children,
        (tree) => { hits.push(tree) },
        (tree) => isVisible(view, sizeLimit, tree));
    return hits;
}
export function fetchItem(item: ColumnarTree<vec2>, settings: RenderSettings, signal?: AbortSignal) {
    const { dataset } = settings;
    const position = () => fetchColumn(item.content, settings.dataset, {
        name: dataset.spatialColumn,
        type: 'METADATA',
    }, signal);
    const color = () => fetchColumn(item.content, settings.dataset, {
        type: 'QUANTITATIVE',
        name: '442'
    }, signal);
    return {
        position,
        color
    }
}

