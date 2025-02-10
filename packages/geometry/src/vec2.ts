import { VectorLibFactory } from "./vector";

export type vec2 = readonly [number, number];
const isVec2 = (v: ReadonlyArray<number>): v is vec2 => v.length === 2;

// Determinants are difficult to support in a generic fashion. We only support 2D vectors for now because that's all we need
function det([a, b]: vec2, [c, d]: vec2): number {
	return a * d - c * b;
}

export const Vec2 = { isVec2, det, ...VectorLibFactory<vec2>() };
