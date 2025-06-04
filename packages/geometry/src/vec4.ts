import type { vec3 } from './vec3';
import { VectorLibFactory } from './vector';

export type vec4 = readonly [number, number, number, number];
const xyz = (v: vec4): vec3 => [v[0], v[1], v[2]];
export const Vec4 = { ...VectorLibFactory<vec4>(), xyz };
