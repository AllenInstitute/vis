import {
	getMinimumBoundingBox,
	rectangle2D,
	scaleFromPoint,
} from "../Rectangle2D";
import { Box2D, box2D } from "../box2D";
import { Vec2, vec2 } from "../vec2";
import { describe, expect, it, test } from "vitest";

function nearlyEqual(a: vec2, b: vec2, epsilon: number) {
	return Vec2.maxComponent(Vec2.map(Vec2.sub(a, b), Math.abs)) < epsilon;
}
function boxesVeryClose(a: box2D, b: box2D, epsilon: number) {
	return (
		nearlyEqual(a.minCorner, b.minCorner, epsilon) &&
		nearlyEqual(a.maxCorner, b.maxCorner, epsilon)
	);
}
describe("scaleFromPoint", () => {
	it("scaling from the center does not move the center!", () => {
		const scaled = scaleFromPoint(
			{
				center: [5, 5],
				size: [1, 1],
			},
			100,
			[5, 5],
		);
		expect(scaled.center).toEqual([5, 5]);
		expect(scaled.size).toEqual([100, 100]);
	});
	it("scaling from the bottom left corner does not move that corner", () => {
		const start: rectangle2D = {
			center: [3, 3],
			size: [2, 2],
		}; // my bottom left corner is 2,2
		const getBottomLeftCornerOfUnrotatedRectangle = (r: rectangle2D) =>
			Vec2.sub(r.center, Vec2.scale(r.size, 0.5));
		const bottomLeft = getBottomLeftCornerOfUnrotatedRectangle(start); // note: this is only correct because rotation is zero
		const scaled = scaleFromPoint(start, 100, bottomLeft);
		expect(getBottomLeftCornerOfUnrotatedRectangle(scaled)).toEqual(bottomLeft);
		expect(scaled.size).toEqual([200, 200]);
	});
});
describe("getMinimumBoundingBox", () => {
	test("that we can get the axis aligned bounding box of a rectangle", () => {
		const view: rectangle2D = {
			center: [2, 3],
			size: [4, 6],
		};
		const boundingBox = getMinimumBoundingBox(view);
		expect(boundingBox).toStrictEqual(Box2D.create([0, 0], [4, 6]));
	});
});
