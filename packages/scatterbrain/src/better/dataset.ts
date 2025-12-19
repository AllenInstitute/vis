import { Box2D, type box2D, type box3D, Box3D, Vec2, type vec2, type vec3, Vec3 } from "@alleninstitute/vis-geometry";
import type { ScatterbrainDataset, SlideviewScatterbrainDataset, TreeNode, volumeBound } from "./types";
import { reduce } from "lodash";

type Dataset = ScatterbrainDataset | SlideviewScatterbrainDataset
// figure out that path through the tree, given a TreeNode name
// these names are structured data - so it should always be possible
type NodeWithBounds = { node: TreeNode, bounds: box2D }

// adapted from Potree createChildAABB
// note that if you do not do indexing in precisely the same order
// as potree octrees, this will not work correctly at all
function getChildBoundsUsingPotreeIndexing(parentBounds: box3D, index: number) {
    const min = parentBounds.minCorner;
    const size = Vec3.scale(Box3D.size(parentBounds), 0.5);
    const offset: vec3 = [
        (index & 0b0100) > 0 ? size[0] : 0,
        (index & 0b0010) > 0 ? size[1] : 0,
        (index & 0b0001) > 0 ? size[2] : 0,
    ];
    const newMin = Vec3.add(min, offset);
    return {
        minCorner: newMin,
        maxCorner: Vec3.add(newMin, size),
    };
}
function children(node: TreeNode) {
    return node.children ?? []
}
function sanitizeName(fileName: string) {
    return fileName.replace('.bin', '');
}
function bounds(rootBounds: box3D, path: string) {
    // path is a name like r01373 - indicating a path through the tree, each character is a child index
    let bounds = rootBounds
    for (let i = 1; i < path.length; i++) {
        const ci = Number(path[i]);
        bounds = getChildBoundsUsingPotreeIndexing(bounds, ci);
    }
    return bounds;
}
function dropZ(box: box3D) {
    return {
        minCorner: Vec3.xy(box.minCorner),
        maxCorner: Vec3.xy(box.maxCorner),
    };
}
// todo move me to vis-geometry
export function visitBFSMaybe<Tree>(
    tree: Tree,
    children: (t: Tree) => ReadonlyArray<Tree>,
    visitor: (tree: Tree) => boolean,
): void {
    const frontier: Tree[] = [tree];
    while (frontier.length > 0) {
        const cur = frontier.shift();
        if (cur === undefined) {
            // TODO: Consider logging a warning or error here, as this should never happen,
            // but this package doesn't depend on the package where our logger lives
            continue;
        }
        if (visitor(cur)) {
            for (const c of children(cur)) {
                frontier.push(c);
            }
        }

    }
}

function getVisibleItemsInTree(dataset: { root: TreeNode, boundingBox: volumeBound }, camera: { view: box2D, screenResolution: vec2 }, limit: number) {
    const { root, boundingBox } = dataset
    const hits: { node: TreeNode, bounds: box2D }[] = []
    const rootBounds = Box3D.create([boundingBox.lx, boundingBox.ly, boundingBox.lz], [boundingBox.ux, boundingBox.uy, boundingBox.uz]);
    visitBFSMaybe<TreeNode>(root, children, (t) => {
        const B = dropZ(bounds(rootBounds, sanitizeName(t.file)))
        if (Box2D.intersection(B, camera.view) && Box2D.size(B)[0] > limit) {
            // this node is big enough to render - that means we should check its children as well
            hits.push({ node: t, bounds: B })
            return true;
        }
        return false;
    })
    return hits;
}

export function getVisibleItems(dataset: SlideviewScatterbrainDataset | ScatterbrainDataset, camera: { view: box2D, screenResolution: vec2, layout?: Record<string, vec2> }) {
    if (dataset.type === 'normal') {
        return getVisibleItemsInTree(dataset.metadata, camera, 5);
    }
    // by default, if we pass NO layout info
    const size: vec2 = [dataset.metadata.spatialUnit.maxX - dataset.metadata.spatialUnit.minX, dataset.metadata.spatialUnit.maxY - dataset.metadata.spatialUnit.minY]
    // then it means we want to draw all the slides on top of each other
    const defaultVisibility = camera.layout === undefined
    const hits: NodeWithBounds[] = []
    for (const slide of dataset.metadata.slides) {
        if (!defaultVisibility && camera.layout?.[slide.featureTypeValueReferenceId] === undefined) {
            // the camera has a layout, but this slide isn't in it - dont draw it
            continue;
        }
        const grid = camera.layout?.[slide.featureTypeValueReferenceId] ?? [0, 0]

        const offset = Vec2.mul(grid, size)
        // offset the camera by the opposite of the offset
        hits.push(...getVisibleItemsInTree(slide.tree, { ...camera, view: Box2D.translate(camera.view, offset) }, 5))
    }
    return hits;

}

export function loadDataset(raw: any): SlideviewScatterbrainDataset | ScatterbrainDataset | undefined {
    // index point attrs by name - its an array
    // TODO zod validation first!
    if (raw['pointAttributes']) {
        raw = { ...raw, pointAttributes: reduce(raw.pointAttributes as { name: string }[], (acc, attr) => ({ ...acc, [attr.name]: attr }), {}) }
    }
    if (raw['slides']) {
        return { type: 'slideview', metadata: raw }
    } else {
        return { type: 'normal', metadata: raw }
    }
}