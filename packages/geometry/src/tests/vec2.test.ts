import { Vec2 } from '../vec2';
import { describe, expect, test } from 'vitest'
describe('vec2', () => {
    test('add', () => {
        const result = Vec2.add([2, 3], [4, 5]);
        expect(result).toStrictEqual([6, 8]);
    });

    test('sub', () => {
        const result = Vec2.sub([2, 3], [4, 5]);
        expect(result).toStrictEqual([-2, -2]);
    });

    test('mul', () => {
        const result = Vec2.mul([2, 3], [4, 5]);
        expect(result).toStrictEqual([8, 15]);
    });

    test('div', () => {
        const result = Vec2.div([2, 3], [4, 5]);
        expect(result).toStrictEqual([0.5, 0.6]);
    });
    test('floor', () => {
        expect(Vec2.floor([33.999, -21.00001])).toStrictEqual([33, -22]);
    });
    test('ceil', () => {
        expect(Vec2.ceil([33.999, -21.00001])).toStrictEqual([34, -21]);
    });

    test('min', () => {
        const result = Vec2.min([2, 8], [4, 5]);
        expect(result).toStrictEqual([2, 5]);
    });

    test('max', () => {
        const result = Vec2.max([2, 8], [4, 5]);
        expect(result).toStrictEqual([4, 8]);
    });

    test('scale', () => {
        const result = Vec2.scale([2, 3], 2);
        expect(result).toStrictEqual([4, 6]);
    });

    test('sum', () => {
        const result = Vec2.sum([2, 3]);
        expect(result).toBe(5);
    });

    test('minComponent', () => {
        const result = Vec2.minComponent([2, 3]);
        expect(result).toBe(2);
    });

    test('maxComponent', () => {
        const result = Vec2.maxComponent([2, 3]);
        expect(result).toBe(3);
    });
    test('map', () => {
        expect(Vec2.map([0, 0], (_v, i) => i)).toStrictEqual([0, 1]);
    });

    test('dot', () => {
        const result = Vec2.dot([2, 3], [4, 5]);
        expect(result).toBe(23);

        const resultWithNegatives = Vec2.dot([-2, 3], [2, -4]);
        expect(resultWithNegatives).toBe(-16);
    });

    test('length', () => {
        const result = Vec2.length([2, 3]);
        const length = Math.sqrt(2 * 2 + 3 * 3);

        expect(result).toBe(length);
    });

    test('normalize', () => {
        const result = Vec2.normalize([2, 3]);
        const length = Math.sqrt(2 * 2 + 3 * 3);
        expect(result).toStrictEqual([2 / length, 3 / length]);

        const noLength = Vec2.normalize([0, 0]);
        expect(noLength).toStrictEqual([NaN, NaN]);
    });

    test('finite', () => {
        const result = Vec2.finite([2, 3]);
        expect(result).toBeTruthy();

        const infinityResult = Vec2.finite([Infinity, 2]);
        expect(infinityResult).toBeFalsy();

        const nanResult = Vec2.finite([NaN, 2]);
        expect(nanResult).toBeFalsy();
    });

    test('any', () => {
        const result = Vec2.any([2, 3], (num) => num % 2 === 0);
        expect(result).toBeTruthy();
    });

    test('all', () => {
        const result = Vec2.all([2, 3], (num) => num % 2 === 0);
        expect(result).toBeFalsy();

        const result2 = Vec2.all([2, 4], (num) => num % 2 === 0);
        expect(result2).toBeTruthy();
    });

    test('exactlyEqual', () => {
        const result = Vec2.exactlyEqual([2, 3], [4, 5]);
        expect(result).toBeFalsy();

        const result2 = Vec2.exactlyEqual([2, 3], [2, 3]);
        expect(result2).toBeTruthy();
    });
    test('swizzle', () => {
        expect(Vec2.swizzle([111, 222], [1, 1])).toStrictEqual([222, 222]);
        expect(Vec2.swizzle([111, 222], [0, 1])).toStrictEqual([111, 222]);
        // dangerous cases:
        expect(Vec2.swizzle([111, 222], [2, 1])).toStrictEqual([undefined, 222]);
    });
    test('isVec2', () => {
        const result = Vec2.isVec2([2, 3]);
        expect(result).toBeTruthy();

        const nonVec2 = Vec2.isVec2([1, 2, 3]);
        expect(nonVec2).toBeFalsy();
    });
    test('det', () => {
        const result = Vec2.det([2, 3], [4, 5]);
        expect(result).toBe(-2);
    });
});
