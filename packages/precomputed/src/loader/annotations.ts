import { Box3D, type box3D, Vec2, type vec2, type vec3, Vec3 } from '@alleninstitute/vis-geometry';
import { match } from 'ts-pattern';
import { z } from 'zod';
// a simple reader for NG precomputed annotation data-sources
// see https://github.com/google/neuroglancer/blob/master/src/datasource/precomputed/annotations.md
// for details
type Ints = 'uint' | 'int';
type Floats = 'float32';
type Bits = '8' | '16' | '32';
type ScalarProperties = `${Ints}${Bits}` | Floats;
type PropertyTypes = ScalarProperties | 'rgb' | 'rgba';
type NGUnit = 'm' | 's' | ''; // TODO go find the complete set
type Dimension = { name: string; scale: number; unit: NGUnit };
type AnnotationType = 'point' | 'line' | 'axis_aligned_bounding_box' | 'ellipsoid';
type SpatialIndexLevel = {
    key: string;
    sharding?: boolean | undefined,
    grid_shape: readonly number[];
    chunk_size: readonly number[];
    limit: number;
};
type Relation = {
    id: string;
    key: string;
    sharding?: boolean | undefined; // todo the spec has a broken link on what this is...
};
type NGAnnotationProperty = Readonly<{
    id: string;
    type: PropertyTypes;
    description: string;
    enum_values?: undefined | readonly number[];
    enum_labels?: undefined | readonly string[];
}>;
// this is a type corresponding to the contents of the annotation info file:
// see https://github.com/google/neuroglancer/blob/master/src/datasource/precomputed/annotations.md
// note that a few liberties have been taken for clarity
// note also that order matters in this structure: the values in the bounding box for example,
// line up with the order of the dimensions,
// and the ordering in the properties array is used when extracting a property value from the
// binary encoded payload: https://github.com/google/neuroglancer/blob/master/src/datasource/precomputed/annotations.md#single-annotation-encoding
export type AnnotationInfo<K extends AnnotationType> = {
    type: 'neuroglancer_annotations_v1';
    dimensions: readonly Dimension[];
    lower_bound: readonly number[];
    upper_bound: readonly number[];
    annotation_type: K;
    properties: readonly NGAnnotationProperty[]; // coarse to fine (notably the opposite of ome-zarr convention)
    relationships: readonly Relation[];
    by_id: {
        key: string;
        sharding?: boolean | undefined; // at the time of writing, this is a 404: https://github.com/google/neuroglancer/blob/master/src/datasource/precomputed/sharding.md#sharding-specification
    };
    spatial: readonly SpatialIndexLevel[];
};
type UnknownAnnotationInfo = AnnotationInfo<AnnotationType>;
// return the size, in bytes, of each annotation in the encoded file
// for example, a point annotation, in 3 dimensions, with a single rgb property, would be
// 4*3 + 3 (4bytes per float, 3 floats per point) + (one byte (uint8) each for red,blue and gree) = 15, plus one byte for padding out to 4-byte alignment = 16
const vertexPerAnnotation: Record<AnnotationType, number> = {
    axis_aligned_bounding_box: 2, // min/max corners
    ellipsoid: 2, // center/size
    line: 2, // start/end
    point: 1, // itself
};
const bytesPerProp: Record<PropertyTypes, number> = {
    float32: 4,
    int16: 2,
    int32: 4,
    int8: 1,
    rgb: 3,
    rgba: 4,
    uint16: 2,
    uint32: 4,
    uint8: 1,
};
export function computeStride(info: UnknownAnnotationInfo) {
    const rank = info.dimensions.length;
    const shapeDataFloats = rank * vertexPerAnnotation[info.annotation_type];
    const shapeDataBytes = 4 * shapeDataFloats;
    const propBytes = computePropertyStride(info);
    const unAligned = shapeDataBytes + propBytes;
    // ok now add padding until bytes%4==0
    const aligned = unAligned % 4 === 0 ? unAligned : unAligned + (4 - (unAligned % 4));
    return aligned;
}
function computePropertyStride(info: UnknownAnnotationInfo) {
    return info.properties.reduce((bytes, prop) => {
        return bytes + bytesPerProp[prop.type];
    }, 0);
}
type GenericVector = Record<string, number>;
type RGB = { r: number; g: number; b: number };
type RGBA = RGB & { a: number };
type rgbaProp = { type: 'rgba'; value: RGBA };
type rgbProp = { type: 'rgb'; value: RGB };
type scalarProp = { type: ScalarProperties; value: number };
type withProps = { properties: Record<string, rgbProp | rgbaProp | scalarProp> };
type Point = { point: GenericVector } & withProps;
type Ellipse = { center: GenericVector; radius: GenericVector } & withProps;
type Box = { min: GenericVector; max: GenericVector } & withProps;
type Line = { start: GenericVector; end: GenericVector } & withProps;

// not very elegant, but there are only 4 kinds so this is fine I think.
type ExtractorResult<K extends AnnotationType> = K extends 'line'
    ? Line
    : K extends 'point'
    ? Point
    : K extends 'axis_aligned_bounding_box'
    ? Box
    : Ellipse;

function extractVec(
    view: DataView,
    info: UnknownAnnotationInfo,
    offset: number,
): { offset: number; vec: GenericVector } {
    const vec: GenericVector = {};
    let off = offset;
    for (const dim of info.dimensions) {
        vec[dim.name] = view.getFloat32(off, true);
        off += 4;
    }
    return { offset: off, vec };
}
function extractOnePropSet(
    view: DataView,
    info: UnknownAnnotationInfo,
    offset: number,
): { offset: number } & withProps {
    const props: Record<string, rgbProp | rgbaProp | scalarProp> = {};
    let off = offset;
    for (const prop of info.properties) {
        props[prop.id] = match(prop.type)
            .with(
                'rgb',
                () =>
                    ({
                        type: 'rgb',
                        value: { r: view.getUint8(off), g: view.getUint8(off + 1), b: view.getUint8(off + 2) },
                    }) as const,
            )
            .with(
                'rgba',
                () =>
                    ({
                        type: 'rgba',
                        value: {
                            r: view.getUint8(off),
                            g: view.getUint8(off + 1),
                            b: view.getUint8(off + 2),
                            a: view.getUint8(off + 3),
                        },
                    }) as const,
            )
            .with('uint8', () => ({ type: 'uint8', value: view.getUint8(off) }) as const)
            .with('uint16', () => ({ type: 'uint16', value: view.getUint16(off, true) }) as const)
            .with('uint32', () => ({ type: 'uint32', value: view.getUint32(off, true) }) as const)
            .with('int8', () => ({ type: 'int8', value: view.getInt8(off) }) as const)
            .with('int16', () => ({ type: 'int16', value: view.getInt16(off, true) }) as const)
            .with('int32', () => ({ type: 'int32', value: view.getInt32(off, true) }) as const)
            .with('float32', () => ({ type: 'float32', value: view.getFloat32(off, true) }) as const)
            .exhaustive();
        // now update off based on how much we read...
        off += bytesPerProp[prop.type];
    }
    return { properties: props, offset: off };
}
function extractTwo(
    view: DataView,
    info: UnknownAnnotationInfo,
    offset: number,
): { A: GenericVector; B: GenericVector; offset: number } & withProps {
    const A = extractVec(view, info, offset);
    const B = extractVec(view, info, A.offset);
    const props = extractOnePropSet(view, info, B.offset);
    return {
        A: A.vec,
        B: B.vec,
        properties: props.properties,
        offset: props.offset,
    };
}

export function extractPoint(
    view: DataView,
    info: AnnotationInfo<'point'>,
    offset: number,
): { annotation: Point; offset: number } {
    const pnt = extractVec(view, info, offset);
    const props = extractOnePropSet(view, info, pnt.offset);
    return {
        annotation: {
            point: pnt.vec,
            properties: props.properties,
        },
        offset: props.offset,
    };
}
export function extractBox(
    view: DataView,
    info: AnnotationInfo<'axis_aligned_bounding_box'>,
    offset: number,
): { annotation: Box; offset: number } {
    const { A, B, offset: off, properties } = extractTwo(view, info, offset);
    return {
        annotation: {
            min: A,
            max: B,
            properties,
        },
        offset: off,
    };
}
export function extractEllipse(
    view: DataView,
    info: AnnotationInfo<'ellipsoid'>,
    offset: number,
): { annotation: Ellipse; offset: number } {
    const { A, B, offset: off, properties } = extractTwo(view, info, offset);
    return {
        annotation: {
            center: A,
            radius: B,
            properties,
        },
        offset: off,
    };
}
export function extractLine(
    view: DataView,
    info: AnnotationInfo<'line'>,
    offset: number,
): { annotation: Line; offset: number } {
    const { A, B, offset: off, properties } = extractTwo(view, info, offset);
    return {
        annotation: {
            start: A,
            end: B,
            properties,
        },
        offset: off,
    };
}
export function* AnnoStream<K extends AnnotationType>(
    info: AnnotationInfo<K>,
    extractor: (
        view: DataView,
        info: AnnotationInfo<K>,
        offset: number,
    ) => { annotation: ExtractorResult<K>; offset: number },
    view: DataView,
    count: bigint,
) {
    const stride = computeStride(info);
    // if you had a buffer that actually needed a bigint to index it... I think that might be very implausible!
    const lilCount = Number(count);
    const idStart = lilCount * stride;
    let offset = 0;
    for (let i = 0n; i < count; i++) {
        const result = extractor(view, info, offset);
        const bigID = view.getBigUint64(idStart + Number(i) * 8, true);
        offset += stride;
        yield { ...result.annotation, id: bigID };
    }
    return null;
}
export async function getAnnotationBuffer(
    baseurl: string, // the url at which the info.json file was found
    info: UnknownAnnotationInfo,
    spatial: {
        level: number;
        cell: readonly number[];
    },
) {
    const { level, cell } = spatial;
    const lvl = info.spatial[level];
    // go fetch the file to start...
    const name = `${baseurl}${lvl.key}/${cell.join('_')}`;
    const raw = await (await fetch(name)).arrayBuffer();
    // first, get the count. its a 64bit value, and its first
    const first = new DataView(raw);
    const numAnnotations = first.getBigUint64(0, true);
    const view = new DataView(raw, 8);
    return { view, numAnnotations };
}
export async function getAnnotations<K extends AnnotationType>(
    baseurl: string, // the url at which the info.json file was found
    info: AnnotationInfo<K>,
    spatial: {
        level: number;
        cell: readonly number[];
    },
    extractor: (
        view: DataView,
        info: AnnotationInfo<K>,
        offset: number,
    ) => { annotation: ExtractorResult<K>; offset: number },
) {
    const { level, cell } = spatial;
    const lvl = info.spatial[level];
    // go fetch the file to start...
    const name = `${baseurl}${lvl.key}/${cell.join('_')}`;
    const raw = await (await fetch(name)).arrayBuffer();
    // first, get the count. its a 64bit value, and its first
    const first = new DataView(raw);
    const numAnnotations = first.getBigUint64(0, true);
    const view = new DataView(raw, 8);

    // TODO: consider if we want the ids (probably yes?)
    return { stream: AnnoStream(info, extractor, view, numAnnotations), numAnnotations };
}
type wtf = PropertyTypes
const propSchema = z.object({
    id: z.string(),
    type: z.union([z.literal('rgb'), z.literal('rgba'),
    z.literal('uint8'), z.literal('uint16'), z.literal('uint32'),
    z.literal('int8'), z.literal('int16'), z.literal('int32'),
    z.literal('float32')
    ]),
    description: z.string(),
    enum_values: z.optional(z.array(z.number())),
    enum_labels: z.optional(z.array(z.string())),
});
const relSchema = z.object({
    id: z.string(),
    key: z.string(),
    sharding: z.optional(z.boolean()), // ????
});
const spatialSchema = z.object({
    key: z.string(),
    sharding: z.optional(z.boolean()),
    grid_shape: z.array(z.number()),
    chunk_size: z.array(z.number()),
    limit: z.number(),
});
const ng_annotations_v1_schema = z.object({
    '@type': z.literal('neuroglancer_annotations_v1'),
    dimensions: z.record(z.tuple([z.number().positive(), z.string()])),
    lower_bound: z.array(z.number()),
    upper_bound: z.array(z.number()),
    annotation_type: z.union([
        z.literal('point'),
        z.literal('line'),
        z.literal('axis_aligned_bounding_box'),
        z.literal('ellipsoid'),
    ]),
    properties: z.array(propSchema),
    relationships: z.array(relSchema),
    by_id: z.object({ key: z.string(), sharding: z.optional(z.boolean()) }),
    spatial: z.array(spatialSchema),
});
export function parseInfoFromJson(json: unknown): UnknownAnnotationInfo | undefined {
    const { data } = ng_annotations_v1_schema.safeParse(json);
    if (data) {
        // the idea here is that 🤞 object.keys respects the order in which the properties were listed in the json body itself...
        const dims = Object.keys(data.dimensions).map((key, i) => ({
            name: key,
            unit: data.dimensions[key][1] as NGUnit,
            scale: data.dimensions[key][0],
        }));
        // TODO this is gross - but not quite as gross as it looks - make the schema nicer!
        return {
            annotation_type: data.annotation_type,
            type: data['@type'],
            by_id: data.by_id,
            dimensions: dims,
            lower_bound: data.lower_bound,
            upper_bound: data.upper_bound,
            properties: data.properties,
            relationships: data.relationships,
            spatial: data.spatial,
        };
    }
}
export function isPointAnnotation(a: UnknownAnnotationInfo): a is AnnotationInfo<'point'> {
    return a.annotation_type === 'point';
}
export function isBoxAnnotation(a: UnknownAnnotationInfo): a is AnnotationInfo<'axis_aligned_bounding_box'> {
    return a.annotation_type === 'axis_aligned_bounding_box';
}
export function isEllipsoidAnnotation(a: UnknownAnnotationInfo): a is AnnotationInfo<'ellipsoid'> {
    return a.annotation_type === 'ellipsoid';
}
export function isLineAnnotation(a: UnknownAnnotationInfo): a is AnnotationInfo<'line'> {
    return a.annotation_type === 'line';
}

function projectXYZ<T>(
    info: UnknownAnnotationInfo,
    orderedAsInfo: readonly T[],
    xyz: readonly [string, string, string],
): undefined | readonly [T, T, T] {
    const [x, y, z] = xyz;
    const X = info.dimensions.findIndex((d) => d.name === x);
    const Y = info.dimensions.findIndex((d) => d.name === y);
    const Z = info.dimensions.findIndex((d) => d.name === z);
    if (X === -1 || Y === -1 || Z === -1) {
        return undefined;
    }
    return [orderedAsInfo[X], orderedAsInfo[Y], orderedAsInfo[Z]];
}
function projectXY<T>(
    info: UnknownAnnotationInfo,
    orderedAsInfo: readonly T[],
    xy: readonly [string, string],
): undefined | readonly [T, T] {
    const [x, y] = xy;
    const X = info.dimensions.findIndex((d) => d.name === x);
    const Y = info.dimensions.findIndex((d) => d.name === y);
    if (X === -1 || Y === -1) {
        return undefined;
    }
    return [orderedAsInfo[X], orderedAsInfo[Y]];
}
// our grids are of arbitrary high dimensionality -
// we want to traverse an N dimensional grid -
// normally, when you know the dimension up front (e.g 3D grid) you can use nested loops,
// here we have to use a more abstract approach:

// precondition: cell and shape are the same length, cell is an index within the N-dim grid
// described by shape, indexing starting at 0
function nextGridCell(cell: readonly number[], shape: readonly number[]): null | readonly number[] {
    // add 1 to the right-most value in cell[] - if it would overflow, set it to zero instead,
    // and recursively bubble the one forward
    const { leftover, v } = bubbleAdd(0, cell, shape);
    if (leftover) {
        return null;
    }
    return v;
}
function bubbleAdd(
    dim: number,
    cell: readonly number[],
    shape: readonly number[],
): { v: readonly number[]; leftover: boolean } {
    const rank = cell.length;
    if (dim === rank - 1) {
        if (cell[dim] + 1 >= shape[dim]) {
            // we have to bubble-up!
            return { v: [0], leftover: true };
        }
        return { v: [cell[dim] + 1], leftover: false };
    }
    const { v, leftover } = bubbleAdd(dim + 1, cell, shape);
    if (leftover) {
        if (cell[dim] + 1 >= shape[dim]) {
            // keep bubbling!
            return { leftover: true, v: [0, ...v] };
        }
        return { v: [cell[dim] + 1, ...v], leftover: false };
    }
    return { v: [cell[dim], ...v], leftover: false };
}

export function visitChunksInLayer(
    data: UnknownAnnotationInfo,
    layer: number,
    queryXYZ: box3D,
    xyz: readonly [string, string, string],
    visitor: (dataset: UnknownAnnotationInfo, cell: readonly number[], layer: number) => void,
) {
    const L = data.spatial[layer];
    let cell: null | readonly number[] = data.dimensions.map((d) => 0);
    if (L) {
        const cellSize = projectXYZ(data, L.chunk_size, xyz);
        if (!cellSize) {
            return; // invalid dimensions!
        }
        while (cell !== null) {
            // is cell within the bounds of our query?
            const gridIndexXYZ = projectXYZ(data, cell, xyz);
            if (!gridIndexXYZ) return;

            const cellBoundsXYZ = Box3D.create(
                Vec3.mul(gridIndexXYZ, cellSize),
                Vec3.mul(Vec3.add(gridIndexXYZ, [1, 1, 1]), cellSize),
            );
            if (Box3D.intersection(queryXYZ, cellBoundsXYZ)) {
                visitor(data, cell, layer);
            }
            cell = nextGridCell(cell, L.grid_shape);
        }
    }
}
export function dimensionScaleXYZ(data: UnknownAnnotationInfo, xyz: readonly [string, string, string]) {
    return ((projectXYZ(data, data.dimensions, xyz)?.map((d) => d.scale) as unknown) ?? [1, 1, 1]) as vec3;
}
export function layerSizeInXY(data: UnknownAnnotationInfo, layer: number, xy: readonly [string, string]): vec2 {
    const L = data.spatial[layer];
    if (L) {
        const shape = projectXY(data, L.grid_shape, xy);
        const size = projectXY(data, L.chunk_size, xy);
        if (shape && size) {
            return Vec2.mul(shape, size);
        }
    }
    return [0, 0];
}
export function chunkSizeInXY(data: UnknownAnnotationInfo, layer: number, xy: readonly [string, string]): vec2 {
    const L = data.spatial[layer];
    if (L) {
        return projectXY(data, L.chunk_size, xy) ?? [0, 0];
    }
    return [0, 0];
}
