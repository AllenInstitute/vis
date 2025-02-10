import { VectorLibFactory } from './vector';

export type vec3 = readonly [number, number, number];
// add things that vec3 has that vec2 does not have!
const xy = (xyz: vec3) => [xyz[0], xyz[1]] as readonly [number, number];
const isVec3 = (v: ReadonlyArray<number>): v is vec3 => v.length === 3;
const cross = (a: vec3, b: vec3): vec3 => {
    const x = (a[1] * b[2]) - (a[2] * b[1])
    const y = (a[2] * b[0]) - (a[0] * b[2])
    const z = (a[0] * b[1]) - (a[1] * b[0])
    return [x, y, z]
}
export const Vec3 = { ...VectorLibFactory<vec3>(), xy, isVec3, cross };
