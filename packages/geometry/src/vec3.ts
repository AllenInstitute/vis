import { VectorLibFactory } from './vector';

export type vec3 = readonly [number, number, number];
// add things that vec3 has that vec2 does not have!
const xy = (xyz: vec3) => [xyz[0], xyz[1]] as readonly [number, number];
const isVec3 = (v: ReadonlyArray<number>): v is vec3 => v.length === 3;
export const Vec3 = { ...VectorLibFactory<vec3>(), xy, isVec3 };
