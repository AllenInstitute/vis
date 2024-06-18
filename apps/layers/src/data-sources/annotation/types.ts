import type { vec4, box2D } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';

export type ClosedLoop = {
    start: number;
    length: number;
};
export type AnnotationPolygon = {
    color: vec4;
    loops: readonly ClosedLoop[];
    bounds: box2D;
    hoverText?: string;
};
export type Mesh = {
    points: Float32Array;
    // a 'polygons' in this case refers to how we're drawing closed polygons - with the triangle-fan pattern
    // the start is the index into the points array, where the fan-locus lives. length is then the number
    // of verts in the polygon - note that the second and final points are duplicates of each other:
    /*  a ----- b
        | \   /  \
        |  \ /    \
        |   x------c
        |  / \    /
        | /   \  /
        e ----- d
    */
    // the above polygon would be in memory in this order: [x a b c d e a ...many polygons may share a buffer...]
    closedPolygons: ReadonlyArray<AnnotationPolygon>;
    bounds: box2D;
};
export type AnnotationMesh = Mesh;

export type GPUAnnotationMesh = {
    points: REGL.Buffer;
    annotation: AnnotationMesh;
};
