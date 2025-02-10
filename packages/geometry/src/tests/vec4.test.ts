import { Vec4 } from '../vec4';
import { describe, expect, test } from 'vitest';
describe('Vec4', () => {
	test('add', () => {
		const result = Vec4.add([2, 3, 4, 5], [4, 5, 6, 7]);
		expect(result).toStrictEqual([6, 8, 10, 12]);
	});

	test('sub', () => {
		const result = Vec4.sub([2, 3, 4, 5], [4, 5, 6, 7]);
		expect(result).toStrictEqual([-2, -2, -2, -2]);
	});

	test('mul', () => {
		const result = Vec4.mul([2, 3, 4, 5], [4, 5, 6, 7]);
		expect(result).toStrictEqual([8, 15, 24, 35]);
	});

	test('div', () => {
		const result = Vec4.div([2, 3, 4, 5], [4, 5, 6, 10]);
		expect(result).toStrictEqual([0.5, 0.6, 0.6666666666666666, 0.5]);
	});

	test('min', () => {
		const result = Vec4.min([2, 8, 13, 22], [4, 5, 11, 21]);
		expect(result).toStrictEqual([2, 5, 11, 21]);
	});

	test('max', () => {
		const result = Vec4.max([2, 8, 13, 22], [4, 5, 11, 21]);
		expect(result).toStrictEqual([4, 8, 13, 22]);
	});

	test('scale', () => {
		const result = Vec4.scale([2, 3, 4, 5], 2);
		expect(result).toStrictEqual([4, 6, 8, 10]);
	});
	test('floor', () => {
		expect(Vec4.floor([33.999, -21.00001, 1, 0])).toStrictEqual([33, -22, 1, 0]);
	});
	test('ceil', () => {
		expect(Vec4.ceil([2, 33.999, 0.001, -21.00001])).toStrictEqual([2, 34, 1, -21]);
	});
	test('sum', () => {
		const result = Vec4.sum([2, 3, 4, 5]);
		expect(result).toBe(14);
	});

	test('minComponent', () => {
		const result = Vec4.minComponent([2, 3, 4, 5]);
		expect(result).toBe(2);
	});

	test('maxComponent', () => {
		const result = Vec4.maxComponent([2, 3, 4, 5]);
		expect(result).toBe(5);
	});
	test('map', () => {
		expect(Vec4.map([0, 0, 33, -2], (v, i) => (i === 2 ? v : i))).toStrictEqual([0, 1, 33, 3]);
	});
	test('dot', () => {
		const result = Vec4.dot([2, 3, 4, 5], [4, 5, 6, 5]);
		expect(result).toBe(72);

		const resultWithNegatives = Vec4.dot([-2, 3, 4, -3], [2, -4, 5, 1]);
		expect(resultWithNegatives).toBe(1);
	});

	test('length', () => {
		const result = Vec4.length([2, 3, 4, 5]);
		const length = Math.sqrt(2 * 2 + 3 * 3 + 4 * 4 + 5 * 5);

		expect(result).toBe(length);
	});

	test('normalize', () => {
		const result = Vec4.normalize([2, 3, 4, 5]);
		const length = Math.sqrt(2 * 2 + 3 * 3 + 4 * 4 + 5 * 5);
		expect(result).toStrictEqual([2 / length, 3 / length, 4 / length, 5 / length]);

		const noLength = Vec4.normalize([0, 0, 0, 0]);
		expect(noLength).toStrictEqual([NaN, NaN, NaN, NaN]);
	});

	test('finite', () => {
		const result = Vec4.finite([2, 3, 4, 6]);
		expect(result).toBeTruthy();

		const infinityResult = Vec4.finite([Infinity, 2, 3, 4]);
		expect(infinityResult).toBeFalsy();

		const nanResult = Vec4.finite([NaN, 2, 3, 4]);
		expect(nanResult).toBeFalsy();
	});

	test('any', () => {
		const result = Vec4.any([2, 3, 4, 5], (num) => num % 2 === 0);
		expect(result).toBeTruthy();
	});

	test('all', () => {
		const result = Vec4.all([2, 3, 4, 5], (num) => num % 2 === 0);
		expect(result).toBeFalsy();

		const result2 = Vec4.all([2, 4, 6, 8], (num) => num % 2 === 0);
		expect(result2).toBeTruthy();
	});
	test('swizzle', () => {
		expect(Vec4.swizzle([111, 222, 33, 4], [3, 2, 1, 0])).toStrictEqual([4, 33, 222, 111]);
		expect(Vec4.swizzle([111, 222, 33, 4], [0, 1, 3, 3])).toStrictEqual([111, 222, 4, 4]);
		// dangerous cases:
		expect(Vec4.swizzle([111, 222, 33, 4], [2, 1, 3, 4])).toStrictEqual([33, 222, 4, undefined]);
	});
	test('exactlyEqual', () => {
		const result = Vec4.exactlyEqual([2, 3, 4, 5], [4, 5, 6, 7]);
		expect(result).toBeFalsy();

		const result2 = Vec4.exactlyEqual([2, 3, 4, 5], [2, 3, 4, 5]);
		expect(result2).toBeTruthy();
	});
});
