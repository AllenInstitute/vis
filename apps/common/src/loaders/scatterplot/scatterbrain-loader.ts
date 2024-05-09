import { Box2D, Box3D, Vec3, type box, type box3D, type vec2, type vec3 } from "@alleninstitute/vis-geometry";
import { MakeTaggedBufferView, type TaggedTypedArray, type WebGLSafeBasicType } from "../../typed-array";
import type REGL from "regl";

type volumeBound = {
    lx: number;
    ly: number;
    lz: number;
    ux: number;
    uy: number;
    uz: number;
};

type PointAttribute = {
    name: string;
    size: number; // elements * elementSize - todo ask Peter to remove
    elements: number; // values per point (so a vector xy would have 2)
    elementSize: number; // size of an element, given in bytes (for example float would have 4)
    type: WebGLSafeBasicType;
    description: string;
};
export type DatasetTreeNode = {
    file: string;
    numSpecimens: number;
    children: undefined | DatasetTreeNode[];
};
type SlideId = string;
export type SlideTree = {
    tree: ColumnarTree<vec2>;
    id: SlideId;
};
// the schema for the json object for a given {todo thingy}
// see example here: https://bkp-visualizations-pd.s3.us-west-2.amazonaws.com/MERSCOPE/ScatterBrain.json
export type ColumnarMetadata = {
    geneFileEndpoint: string;
    metadataFileEndpoint: string;
    visualizationReferenceId: string;
    spatialColumn: string;
    points: number;
    boundingBox: volumeBound;
    tightBoundingBox: volumeBound;
    pointAttributes: PointAttribute[];
    root: DatasetTreeNode;
};
export type ColumnMetadata = {
    type: WebGLSafeBasicType;
    elements: number;
};
type Slide = {
    featureTypeValueReferenceId: string;
    tree: {
        root: DatasetTreeNode;
        points: number;
        boundingBox: volumeBound;
        tightBoundingBox: volumeBound;
    };
};
type SpatialReferenceFrame = {
    anatomicalOrigin: string;
    direction: string;
    unit: string;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};
export type SlideColumnarMetadata = Omit<ColumnarMetadata, 'root' | 'points' | 'boundingBox' | 'tightBoundingBox'> & {
    slides: Slide[];
    spatialUnit: SpatialReferenceFrame;
};
type VectorConstraint = ReadonlyArray<number>
export type ColumnarNode<V extends VectorConstraint> = {
    url: string;
    name: string;
    bounds: box<V>;
    count: number;
    depth: number;
    geneUrl: string; // TODO: geneUrl here reflects a gene-specific aspect of the API - rename when a more-general name is decided on
};
export type ColumnarTree<V extends VectorConstraint> = {
    content: ColumnarNode<V>;
    children: ReadonlyArray<ColumnarTree<V>>
}

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
function dropZ(box: box3D) {
    return {
        minCorner: Vec3.xy(box.minCorner),
        maxCorner: Vec3.xy(box.maxCorner),
    };
}
const getRelativeIndex = (parent: string, childName: string) => {
    if (childName.startsWith(parent)) {
        const sub = childName.substring(parent.length, parent.length + 1);
        return Number.parseInt(sub, 10);
    }
    return 0;
};
function sanitizeName(fileName: string) {
    return fileName.replace('.bin', '');
}
function convertTree2D(
    n: DatasetTreeNode,
    bounds: box3D,
    depth: number,
    metadataPath: string,
    genePath: string
): ColumnarTree<vec2> {
    const safeName = sanitizeName(n.file);
    return {
        content: {
            bounds: dropZ(bounds),
            count: n.numSpecimens,
            depth,
            url: metadataPath,
            geneUrl: genePath,
            name: safeName,
        },
        children:
            n.children !== undefined && n.children.length > 0
                ? n.children.map((c) =>
                    convertTree2D(
                        c,
                        getChildBoundsUsingPotreeIndexing(bounds, getRelativeIndex(safeName, sanitizeName(c.file))),
                        depth + 1,
                        metadataPath,
                        genePath
                    )
                )
                : [],
    };
}
function mapBy<K extends string, T extends Record<K, string>>(items: readonly T[], k: K): Record<string, T> {
    const dictionary: Record<string, T> = {};
    items.forEach((item) => {
        dictionary[item[k]] = item;
    });
    return dictionary;
}
export function isSlideViewData(data: ColumnarMetadata | SlideColumnarMetadata): data is SlideColumnarMetadata {
    return 'slides' in data && 'spatialUnit' in data;
}
function loadSlideViewDataset(metadata: SlideColumnarMetadata, _datasetUrl: string) {
    const {
        geneFileEndpoint,
        spatialColumn,
        spatialUnit,
        metadataFileEndpoint,
        visualizationReferenceId,
        pointAttributes,
        slides,
    } = metadata;
    const { minX, minY, maxX, maxY } = spatialUnit;
    const bounds = Box2D.create([Number(minX), Number(minY)], [Number(maxX), Number(maxY)]);

    const columnInfo = pointAttributes.reduce(
        (dictionary, attr) => ({
            ...dictionary,
            [attr.name]: {
                elements: attr.elements,
                type: attr.type,
            } as const,
        }),
        {} as Record<string, ColumnMetadata>
    );

    const slideTrees: SlideTree[] = slides.map((slide) => {
        const box = slide.tree.boundingBox;
        const slideBounds = Box3D.create([box.lx, box.ly, box.lz], [box.ux, box.uy, box.uz]);
        return {
            tree: convertTree2D(slide.tree.root, slideBounds, 0, metadataFileEndpoint, geneFileEndpoint),
            id: (slide.featureTypeValueReferenceId),
        };
    });
    return {
        bounds,
        columnInfo,
        dimensions: 2,
        geneUrl: geneFileEndpoint,
        spatialColumn,
        url: metadataFileEndpoint,
        slides: mapBy(slideTrees, 'id') as Record<SlideId, SlideTree>,
        visualizationReferenceId,
    };
}
export type SlideViewDataset = ReturnType<typeof loadSlideViewDataset>;

export function loadDataset(metadata: ColumnarMetadata, datasetUrl: string) {
    if (isSlideViewData(metadata)) {
        return loadSlideViewDataset(metadata, datasetUrl);
    }
    const box = metadata.boundingBox;
    const spatialDimName = metadata.spatialColumn;
    const rootBounds = Box3D.create([box.lx, box.ly, box.lz], [box.ux, box.uy, box.uz]);
    const columnInfo = metadata.pointAttributes.reduce(
        (dictionary, attr) => ({
            ...dictionary,
            [attr.name]: {
                elements: attr.elements,
                type: attr.type,
            } as const,
        }),
        {} as Record<string, ColumnMetadata>
    );
    return {
        dimensions: 2,
        visualizationReferenceId: metadata.visualizationReferenceId,
        bounds: dropZ(rootBounds),
        url: datasetUrl,
        geneUrl: metadata.geneFileEndpoint,
        columnInfo,
        spatialColumn: metadata.spatialColumn,
        tree: convertTree2D(
            metadata.root,
            rootBounds,
            0,
            metadata.metadataFileEndpoint,
            metadata.geneFileEndpoint
        ),
    };
}

type MetadataColumn = {
    type: 'METADATA';
    name: string;
};
type QuantitativeColumn = {
    type: 'QUANTITATIVE';
    name: string;
};
export type ColumnRequest = MetadataColumn | QuantitativeColumn;
export type ColumnBuffer = {
    type: 'vbo',
    data: REGL.Buffer
}
export type ColumnData = TaggedTypedArray & {
    elements: number; // per vector entry - for example 'xy' would have elements: 2
};
export async function loadScatterbrainJson(url: string) {
    // obviously, we should check or something
    return fetch(url).then(stuff => stuff.json() as unknown as ColumnarMetadata)
}

export async function fetchColumn(
    node: ColumnarNode<ReadonlyArray<number>>,
    dataset: ReturnType<typeof loadDataset>,
    column: ColumnRequest,
    signal?: AbortSignal
): Promise<ColumnData> {
    const referenceIdForEmbedding = dataset.visualizationReferenceId;
    const getColumnUrl = (columnName: string) => `${node.url}${columnName}/${referenceIdForEmbedding}/${node.name}.bin`;
    const getGeneUrl = (columnName: string) =>
        `${dataset.geneUrl}${columnName}/${referenceIdForEmbedding}/${node.name}.bin`;
    if (column.type === 'QUANTITATIVE') {
        const buff = await fetch(getGeneUrl(column.name), { signal: signal ?? null }).then((resp) => resp.arrayBuffer());
        return { ...MakeTaggedBufferView('float', buff), elements: 1 };
    }
    const info = dataset.columnInfo[column.name];
    const buff = await fetch(getColumnUrl(column.name), { signal: signal ?? null }).then((resp) => resp.arrayBuffer());

    return { ...MakeTaggedBufferView(info.type, buff), elements: info.elements };
}