import { Vec3, type box, type vec2, type vec3 } from "@alleninstitute/vis-geometry";
import { Box3D, type box3D } from "@alleninstitute/vis-geometry/lib/box3D";
import { MakeTaggedBufferView, type TaggedTypedArray, type WebGLSafeBasicType } from "./typed-array";

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
// the schema for the json object for a given {todo thingy}
// see example here: https://bkp-visualizations-pd.s3.us-west-2.amazonaws.com/MERSCOPE/ScatterBrain.json
export type ColumnarMetatdata = {
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
type VectorConstraint = ReadonlyArray<number>
export type ColumnarNode<V extends VectorConstraint> = {
    url: string;
    name: string;
    bounds: box<V>;
    count: number;
    depth: number;
    geneUrl: string; // TODO: geneUrl here reflects a gene-specific aspect of the API - rename when a more-general name is decided on
};
type ColumnarTree<V extends VectorConstraint> = {
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
function convertTree3D(
    n: DatasetTreeNode,
    bounds: box3D,
    depth: number,
    metadataPath: string,
    genePath: string
): ColumnarTree<vec3> {
    const safeName = sanitizeName(n.file);
    return {
        content: {
            bounds,
            count: n.numSpecimens,
            depth,
            url: metadataPath,
            geneUrl: genePath,
            name: safeName,
        },
        children:
            n.children !== undefined && n.children.length > 0
                ? n.children.map((c) =>
                    convertTree3D(
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
export function loadDataset(metadata: ColumnarMetatdata, datasetUrl: string) {
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
    const dimensionPicker =
        columnInfo[spatialDimName].elements === 3
            ? { dimensions: 3 as const, converter: convertTree3D, bounds: rootBounds }
            : { dimensions: 2 as const, converter: convertTree2D, bounds: dropZ(rootBounds) };
    return {
        dimensions: dimensionPicker.dimensions,
        visualizationReferenceId: metadata.visualizationReferenceId,
        bounds: dimensionPicker.bounds,
        url: datasetUrl,
        geneUrl: metadata.geneFileEndpoint,
        columnInfo,
        spatialColumn: metadata.spatialColumn,
        tree: dimensionPicker.converter(
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
export type ColumnData = TaggedTypedArray & {
    elements: number; // per vector entry - for example 'xy' would have elements: 2
};

export async function fetchColumn(
    node: ColumnarNode<ReadonlyArray<number>>,
    dataset: ReturnType<typeof loadDataset>,
    column: ColumnRequest,
    signal: AbortSignal
): Promise<ColumnData> {
    const referenceIdForEmbedding = dataset.visualizationReferenceId;
    const getColumnUrl = (columnName: string) => `${node.url}${columnName}/${referenceIdForEmbedding}/${node.name}.bin`;
    const getGeneUrl = (columnName: string) =>
        `${dataset.geneUrl}${columnName}/${referenceIdForEmbedding}/${node.name}.bin`;
    if (column.type === 'QUANTITATIVE') {
        const buff = await fetch(getGeneUrl(column.name), { signal }).then((resp) => resp.arrayBuffer());
        return { ...MakeTaggedBufferView('float', buff), elements: 1 };
    }
    const info = dataset.columnInfo[column.name];
    const buff = await fetch(getColumnUrl(column.name), { signal }).then((resp) => resp.arrayBuffer());

    return { ...MakeTaggedBufferView(info.type, buff), elements: info.elements };
}