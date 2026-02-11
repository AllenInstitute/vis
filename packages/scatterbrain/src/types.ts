/// Types describing the metadata that gets loaded from scatterbrain.json files ///
// there are 2 variants, slideview and regular - they are distinguished at runtime
// by checking the parsed metadata for the 'slides' field
export type WebGLSafeBasicType = 'uint8' | 'uint16' | 'int8' | 'int16' | 'uint32' | 'int32' | 'float';

export type volumeBound = {
    lx: number;
    ly: number;
    lz: number;
    ux: number;
    uy: number;
    uz: number;
};
export type PointAttribute = {
    name: string;
    size: number; // elements * elementSize - todo ask Peter to remove
    elements: number; // values per point (so a vector xy would have 2)
    elementSize: number; // size of an element, given in bytes (for example float would have 4)
    type: WebGLSafeBasicType;
    description: string;
};
export type TreeNode = {
    file: string;
    numSpecimens: number;
    children: undefined | TreeNode[];
};

type MetadataColumn = {
    type: 'METADATA';
    name: string;
};
type QuantitativeColumn = {
    type: 'QUANTITATIVE';
    name: string;
};
export type ColumnRequest = MetadataColumn | QuantitativeColumn;
type CommonMetadata = {
    geneFileEndpoint: string;
    metadataFileEndpoint: string;
    visualizationReferenceId: string;
    spatialColumn: string;
    pointAttributes: Record<string, PointAttribute>;
};
// scatterbrain distinguishes 2 kinds of datasets - those arranged at the topmost level into slides
// and 'regular' - which is just a simple, 2D point cloud
export type ScatterbrainMetadata = CommonMetadata & {
    points: number;
    boundingBox: volumeBound;
    tightBoundingBox: volumeBound;
    root: TreeNode;
};

// slideview variant:
type Slide = {
    featureTypeValueReferenceId: string;
    tree: {
        root: TreeNode;
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

export type SlideviewMetadata = CommonMetadata & {
    slides: Slide[];
    spatialUnit: SpatialReferenceFrame;
};

/// Types related to the rendering of scatterbrain datasets ///

// a Dataset is the top level entity
// an Item is a chunk of that dataset - esentially a singular, loadable, thing

export type SlideviewScatterbrainDataset = { type: 'slideview'; metadata: SlideviewMetadata };
export type ScatterbrainDataset = { type: 'normal'; metadata: ScatterbrainMetadata };
