import { VectorLibFactory } from './vector';

export type vec4 = readonly [number, number, number, number];

export const Vec4 = VectorLibFactory<vec4>();
