import { match, P } from 'ts-pattern'
import { z } from 'zod'
// a simple reader for NG precomputed annotation data-sources
// see https://github.com/google/neuroglancer/blob/master/src/datasource/precomputed/annotations.md
// for details
type Ints = 'uint' | 'int'
type Floats = 'float32'
type Bits = '8' | '16' | '32'
type ScalarProperties = `${Ints}${Bits}` | Floats
type PropertyTypes = ScalarProperties | 'rgb' | 'rgba'
type NGUnit = 'm' | 's' | '' // TODO go find the complete set
type Dimension = { name: string, scale: number, unit: NGUnit }
type AnnotationType = 'POINT' | 'LINE' | 'AXIS_ALIGNED_BOUNDING_BOX' | 'ELLIPSOID'
type SpatialIndexLevel = {
    key: string,
    sharding?: boolean,
    grid_shape: readonly number[],
    chunk_size: readonly number[],
    limit: number
}
type Relation = {
    id: string,
    key: string,
    sharding?: boolean, // todo the spec has a broken link on what this is...

}
type NGAnnotationProperty = Readonly<{
    id: string,
    type: PropertyTypes,
    description: string,
    enum_values?: readonly number[],
    enum_labels?: readonly string[],
}>
// this is a type corresponding to the contents of the annotation info file:
// see https://github.com/google/neuroglancer/blob/master/src/datasource/precomputed/annotations.md
// note that a few liberties have been taken for clarity
// note also that order matters in this structure: the values in the bounding box for example,
// line up with the order of the dimensions,
// and the ordering in the properties array is used when extracting a property value from the
// binary encoded payload: https://github.com/google/neuroglancer/blob/master/src/datasource/precomputed/annotations.md#single-annotation-encoding
export type AnnotationInfo = {
    type: 'neuroglancer_annotations_v1',
    dimensions: readonly Dimension[],
    lower_bound: readonly number[],
    upper_bound: readonly number[],
    annotation_type: AnnotationType,
    properties: readonly NGAnnotationProperty[], // coarse to fine (notably the opposite of ome-zarr convention)
    relationships: readonly Relation[],
    by_id: {
        key: string,
        sharding?: boolean, // at the time of writing, this is a 404: https://github.com/google/neuroglancer/blob/master/src/datasource/precomputed/sharding.md#sharding-specification
    },
    spatial: readonly SpatialIndexLevel[]
}
// return the size, in bytes, of each annotation in the encoded file
// for example, a point annotation, in 3 dimensions, with a single rgb property, would be
// 4*3 + 3 (4bytes per float, 3 floats per point) + (one byte (uint8) each for red,blue and gree) = 15, plus one byte for padding out to 4-byte alignment = 16
const vertexPerAnnotation: Record<AnnotationType, number> = {
    AXIS_ALIGNED_BOUNDING_BOX: 2, // min/max corners
    ELLIPSOID: 2,    // center/size
    LINE: 2,         // start/end
    POINT: 1         // itself
}
const bytesPerProp: Record<PropertyTypes, number> = {
    float32: 4,
    int16: 2,
    int32: 4,
    int8: 1,
    rgb: 3,
    rgba: 4,
    uint16: 2,
    uint32: 4,
    uint8: 1
}
export function computeStride(info: AnnotationInfo) {
    const rank = info.dimensions.length;
    const shapeDataFloats = rank * vertexPerAnnotation[info.annotation_type];
    const shapeDataBytes = 4 * shapeDataFloats;
    const propBytes = computePropertyStride(info);
    const unAligned = shapeDataBytes + propBytes;
    // ok now add padding until bytes%4==0
    const aligned = unAligned % 4 === 0 ? unAligned : unAligned + (4 - (unAligned % 4));
    return aligned;
}
function computePropertyStride(info: AnnotationInfo) {
    return info.properties.reduce((bytes, prop) => {
        return bytes + bytesPerProp[prop.type]
    }, 0)
}
type GenericVector = Record<string, number>
type RGB = { r: number, g: number, b: number }
type RGBA = RGB & { a: number }
type rgbaProp = { type: 'rgba', value: RGBA }
type rgbProp = { type: 'rgb', value: RGB }
type scalarProp = { type: ScalarProperties, value: number }
type withProps = { properties: Record<string, rgbProp | rgbaProp | scalarProp> }
type Point = { point: GenericVector } & withProps
type Ellipse = { center: GenericVector, radius: GenericVector } & withProps
type Box = { min: GenericVector, max: GenericVector } & withProps
type Line = { start: GenericVector, end: GenericVector } & withProps

type Annotation = (Line | Box | Ellipse | Point)

async function selectShapeFromAnnotations<T extends AnnotationType>(
    baseurl: string, // the url at which the info.json file was found
    info: AnnotationInfo,
    expectedType: T,
    spatial: {
        level: number, cell: readonly number[]
    },
) {
    const { level, cell } = spatial
    const lvl = info.spatial[level];
    // go fetch the file to start...
    const raw = await (await fetch(`${baseurl}/spatial${level.toFixed(0)}/${cell.join('_')}`)).arrayBuffer();
    // first, get the count. its a 64bit value, and its first
    const first = new DataView(raw)
    const numAnnotations = first.getBigUint64(0, true);
    const view = new DataView(raw, 8)
    // what is the stride, in bytes, of an annotation in this file?
    const stride = computeStride(info);
}
function extractVec(view: DataView, info: AnnotationInfo, offset: number): { offset: number, vec: GenericVector } {
    const vec: GenericVector = {}
    let off = offset;
    for (const dim of info.dimensions) {
        vec[dim.name] = view.getFloat32(off, true)
        off += 4;
    }
    return { offset: off, vec }
}
function extractOnePropSet(view: DataView, info: AnnotationInfo, offset: number): { offset: number } & withProps {
    const props: Record<string, rgbProp | rgbaProp | scalarProp> = {}
    let off = offset;
    for (const prop of info.properties) {
        props[prop.id] = match(prop.type)
            .with('rgb', () => ({ type: 'rgb', value: { r: view.getUint8(off), g: view.getUint8(off + 1), b: view.getUint8(off + 2) } } as const))
            .with('rgba', () => ({ type: 'rgba', value: { r: view.getUint8(off), g: view.getUint8(off + 1), b: view.getUint8(off + 2), a: view.getUint8(off + 3) } } as const))
            .with('uint8', () => ({ type: 'uint8', value: view.getUint8(off) } as const))
            .with('uint16', () => ({ type: 'uint16', value: view.getUint16(off, true) } as const))
            .with('uint32', () => ({ type: 'uint32', value: view.getUint32(off, true) } as const))
            .with('int8', () => ({ type: 'int8', value: view.getInt8(off) } as const))
            .with('int16', () => ({ type: 'int16', value: view.getInt16(off, true) } as const))
            .with('int32', () => ({ type: 'int32', value: view.getInt32(off, true) } as const))
            .with('float32', () => ({ type: 'float32', value: view.getFloat32(off, true) } as const))
            .exhaustive()
        // now update off based on how much we read...
        off += bytesPerProp[prop.type]
    }
    return { properties: props, offset: off };
}
export function extractPoint(view: DataView, info: AnnotationInfo, offset: number): { annotation: Point, offset: number } {
    const pnt = extractVec(view, info, offset)
    const props = extractOnePropSet(view, info, pnt.offset)
    return {
        annotation: {
            point: pnt.vec,
            properties: props.properties,
        },
        offset: props.offset
    }
}
function extractTwo(view: DataView, info: AnnotationInfo, offset: number): { A: GenericVector, B: GenericVector, offset: number } & withProps {
    const A = extractVec(view, info, offset)
    const B = extractVec(view, info, A.offset)
    const props = extractOnePropSet(view, info, B.offset)
    return {
        A: A.vec,
        B: B.vec,
        properties: props.properties,
        offset: props.offset
    }
}
export function extractBox(view: DataView, info: AnnotationInfo, offset: number): { annotation: Box, offset: number } {
    const { A, B, offset: off, properties } = extractTwo(view, info, offset)
    return {
        annotation: {
            min: A,
            max: B,
            properties,
        },
        offset: off
    }
}
export function extractEllipse(view: DataView, info: AnnotationInfo, offset: number): { annotation: Ellipse, offset: number } {
    const { A, B, offset: off, properties } = extractTwo(view, info, offset)
    return {
        annotation: {
            center: A,
            radius: B,
            properties,
        },
        offset: off
    }
}
export function extractLine(view: DataView, info: AnnotationInfo, offset: number): { annotation: Line, offset: number } {
    const { A, B, offset: off, properties } = extractTwo(view, info, offset)
    return {
        annotation: {
            start: A,
            end: B,
            properties,
        },
        offset: off
    }
}
export function* AnnoStream<T extends Annotation>(
    info: AnnotationInfo,
    extractor: (view: DataView, info: AnnotationInfo, offset: number) => { annotation: T, offset: number },
    view: DataView,
    count: bigint,
) {
    const stride = computeStride(info);
    // if you had a buffer that actually needed a bigint to index it... I think that might be very implausible!
    const lilCount = Number(count);
    const idStart = lilCount * stride
    let offset = 0;
    for (let i = 0n; i < count; i++) {
        const what = extractor(view, info, offset)
        const bigID = view.getBigUint64(idStart + (Number(i) * 8), true)
        offset += stride;
        yield { ...what.annotation, id: bigID };
    }
    return null;
}
export async function getAnnotationBuffer(
    baseurl: string, // the url at which the info.json file was found
    info: AnnotationInfo,
    spatial: {
        level: number, cell: readonly number[]
    }) {
    const { level, cell } = spatial
    const lvl = info.spatial[level];
    // go fetch the file to start...
    const name = `${baseurl}${lvl.key}/${cell.join('_')}`
    const raw = await (await fetch(name)).arrayBuffer();
    // first, get the count. its a 64bit value, and its first
    const first = new DataView(raw)
    const numAnnotations = first.getBigUint64(0, true);
    const view = new DataView(raw, 8)
    return { view, numAnnotations }
}
export async function getAnnotations<T extends Annotation>(baseurl: string, // the url at which the info.json file was found
    info: AnnotationInfo,
    spatial: {
        level: number, cell: readonly number[]
    },
    extractor: (view: DataView, info: AnnotationInfo, offset: number) => { annotation: T, offset: number }) {
    const { level, cell } = spatial
    const lvl = info.spatial[level];
    // go fetch the file to start...
    const name = `${baseurl}${lvl.key}/${cell.join('_')}`
    const raw = await (await fetch(name)).arrayBuffer();
    // first, get the count. its a 64bit value, and its first
    const first = new DataView(raw)
    const numAnnotations = first.getBigUint64(0, true);
    const view = new DataView(raw, 8)

    // TODO: consider if we want the ids (probably yes?)
    return AnnoStream(info, extractor, view, numAnnotations)
}
// NG annotation files support arbitrary dimensionality in any order
// during extraction, we want to pull out the whole shape,
// and potentially 
const propSchema = z.object({
    id: z.string(),
    type: z.string(),
    description: z.string(),
    enum_values: z.optional(z.array(z.number())),
    enum_labels: z.optional(z.array(z.string())),
})
const relSchema = z.object({
    id: z.string(),
    key: z.string(),
    sharding: z.optional(z.boolean()) // ????
})
const spatialSchema = z.object({
    key: z.string(),
    sharding: z.optional(z.boolean()),
    grid_shape: z.array(z.number()),
    chunk_size: z.array(z.number()),
    limit: z.number()
})
const wtf = z.object({
    "@type": z.literal('neuroglancer_annotations_v1'),
    dimensions: z.record(z.tuple([z.number().positive(), z.string()])),
    lower_bound: z.array(z.number()),
    upper_bound: z.array(z.number()),
    annotation_type: z.union([z.literal('point'), z.literal('line'), z.literal('axis_aligned_bounding_box'), z.literal('ellipsoid')]),
    properties: z.array(propSchema),
    relationships: z.array(relSchema),
    by_id: z.object({ key: z.string(), sharding: z.optional(z.boolean()) }),
    spatial: z.array(spatialSchema)
})
export function parseInfoFromJson(json: any): AnnotationInfo | undefined {
    const { data } = wtf.safeParse(json)
    if (data) {
        // the idea here is that 🤞 object.keys respects the order in which the properties were listed in the json body itself...
        const dims = Object.keys(data.dimensions).map((key, i) => ({ name: key, unit: data.dimensions[key][1] as NGUnit, scale: data.dimensions[key][0] }))
        // TODO this is gross - but not quite as gross as it looks - make the schema nicer!
        return {
            annotation_type: data.annotation_type.toUpperCase() as any,
            type: data['@type'],
            by_id: data.by_id as any,
            dimensions: dims,
            lower_bound: data.lower_bound,
            upper_bound: data.upper_bound,
            properties: data.properties as any,
            relationships: data.relationships as any,
            spatial: data.spatial as any,

        }
    }
}