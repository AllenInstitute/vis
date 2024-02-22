
// todo rename this file

import { Box2D, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { fetchColumn, type ColumnarTree, type loadDataset, type ColumnData } from "./scatterbrain-loader";
import { visitBFS } from "./tree";
import { size } from "lodash";

type Dataset = ReturnType<typeof loadDataset>
export type RenderSettings = {
    dataset: Dataset;
    view: box2D;
    color: string;
}
function isVisible(view: box2D, sizeLimit: number, tree: ColumnarTree<vec2>) {
    const { bounds } = tree.content;
    return Box2D.size(bounds)[0] > sizeLimit && !!Box2D.intersection(view, tree.content.bounds);
}
export function getVisibleItems(dataset: Dataset, view: box2D, sizeLimit: number) {
    const hits: ColumnarTree<vec2>[] = []
    visitBFS(dataset.tree,
        (t: ColumnarTree<vec2>) => t.children,
        (tree) => { hits.push(tree) },
        (tree) => isVisible(view, sizeLimit, tree));
    return hits;
}
export function fetchItem(item: ColumnarTree<vec2>, settings: RenderSettings, signal: AbortSignal) {
    const { dataset } = settings;
    const position = () => fetchColumn(item.content, settings.dataset, {
        name: dataset.spatialColumn,
        type: 'METADATA',
    }, signal);
    const color = () => fetchColumn(item.content, settings.dataset, {
        type: 'QUANTITATIVE',
        name: '443'
    }, signal);
    return {
        position,
        color
    }
}

