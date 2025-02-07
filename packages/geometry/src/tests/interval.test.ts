import { describe, expect, it, test } from "vitest";
import {
	type Interval,
	fixOrder,
	intersection,
	isValid,
	limit,
	size,
	within,
} from "../interval";
function I(a: number, b: number): Interval {
	return { min: a, max: b };
}
describe("basic interval math", () => {
	describe("validity", () => {
		it("intervals with zero or negative size are invalid", () => {
			expect(isValid(I(3, 3.00001), 0.00002)).toBe(false);
		});
		it("intevals with non-finite values are invalid", () => {
			expect(isValid(I(3, Number.NaN), 0)).toBeFalsy();
			expect(isValid(I(Number.NEGATIVE_INFINITY, 3), 0)).toBeFalsy();
			expect(
				isValid(I(Number.NEGATIVE_INFINITY, Number.POSITIVE_INFINITY), 0),
			).toBeFalsy();
			expect(isValid(I(Number.NEGATIVE_INFINITY, 3), 0)).toBeFalsy();
			expect(isValid(I(0, 1), 0)).toBeTruthy();
		});
	});
	describe("size", () => {
		it("size is the signed distance between min and max", () => {
			expect(size(I(1, 3))).toBe(2);
			expect(size(I(11, -3))).toBe(-14);
			expect(size(I(1, 1))).toBe(0);
		});
	});
	describe("within", () => {
		it("within is inclusive on either side", () => {
			expect(within(I(10, 30), 10)).toBeTruthy();
			expect(within(I(10, 30), 30)).toBeTruthy();
			expect(within(I(10, 30), 30.0000001)).toBeFalsy();
			// invalid: should always return false
			expect(within(I(30, 10), 15)).toBeFalsy();
			expect(within(I(10, 30), 15)).toBeTruthy();
		});
	});
	describe("fixOrder", () => {
		it("fixOrder always returns a valid interval if its given interval was finite", () => {
			expect(fixOrder(I(3, 1))).toEqual(I(1, 3));
			expect(fixOrder(I(1, 3))).toEqual(I(1, 3));
			// garbo in garbo out
			expect(fixOrder(I(Number.NaN, 3))).toEqual(I(Number.NaN, Number.NaN));
		});
	});
	describe("intersection", () => {
		it("intersection is the overlap of two intervals, if they are valid", () => {
			expect(intersection(I(1, 4), I(3, 5))).toEqual(I(3, 4));
			expect(intersection(I(4, 1), I(3, 5))).toEqual(undefined);
			expect(intersection(I(-1, 2), I(3, 5))).toEqual(undefined);
		});
	});
	describe("limit", () => {
		it("clamp a value into an interval, if the interval is valid", () => {
			expect(limit(I(1, 4), 0)).toEqual(1);
			expect(limit(I(1, 4), 50)).toEqual(4);
			// given interval is invalid, so dont mess with x
			expect(limit(I(4, 1), 200)).toEqual(200);
			expect(limit(I(1, 4), 2)).toEqual(2);
		});
	});
});
