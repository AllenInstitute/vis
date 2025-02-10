import { Vec3 } from '../vec3';
import { describe, expect, test } from 'vitest';
describe('Vec3', () => {
    test('add', () => {
        const result = Vec3.add([2, 3, 4], [4, 5, 6]);
        expect(result).toStrictEqual([6, 8, 10]);
    });

    test('sub', () => {
        const result = Vec3.sub([2, 3, 4], [4, 5, 6]);
        expect(result).toStrictEqual([-2, -2, -2]);
    });

    test('mul', () => {
        const result = Vec3.mul([2, 3, 4], [4, 5, 6]);
        expect(result).toStrictEqual([8, 15, 24]);
    });

    test('div', () => {
        const result = Vec3.div([2, 3, 4], [4, 5, 6]);
        expect(result).toStrictEqual([0.5, 0.6, 0.6666666666666666]);
    });

    test('min', () => {
        const result = Vec3.min([2, 8, 13], [4, 5, 11]);
        expect(result).toStrictEqual([2, 5, 11]);
    });

    test('max', () => {
        const result = Vec3.max([2, 8, 13], [4, 5, 11]);
        expect(result).toStrictEqual([4, 8, 13]);
    });
    test('floor', () => {
        expect(Vec3.floor([33.999, -21.00001, 1])).toStrictEqual([33, -22, 1]);
    });
    test('ceil', () => {
        expect(Vec3.ceil([2, 33.999, -21.00001])).toStrictEqual([2, 34, -21]);
    });
    test('scale', () => {
        const result = Vec3.scale([2, 3, 4], 2);
        expect(result).toStrictEqual([4, 6, 8]);
    });

    test('sum', () => {
        const result = Vec3.sum([2, 3, 4]);
        expect(result).toBe(9);
    });

    test('minComponent', () => {
        const result = Vec3.minComponent([2, 3, 4]);
        expect(result).toBe(2);
    });

    test('maxComponent', () => {
        const result = Vec3.maxComponent([2, 3, 4]);
        expect(result).toBe(4);
    });
    test('map', () => {
        expect(Vec3.map([0, 0, 33], (_v, i) => i)).toStrictEqual([0, 1, 2]);
    });
    test('dot', () => {
        const result = Vec3.dot([2, 3, 4], [4, 5, 6]);
        expect(result).toBe(47);

        const resultWithNegatives = Vec3.dot([-2, 3, 4], [2, -4, 5]);
        expect(resultWithNegatives).toBe(4);
    });

    test('length', () => {
        const result = Vec3.length([2, 3, 4]);
        const length = Math.sqrt(2 * 2 + 3 * 3 + 4 * 4);

        expect(result).toBe(length);
    });

    test('normalize', () => {
        const result = Vec3.normalize([2, 3, 4]);
        const length = Math.sqrt(2 * 2 + 3 * 3 + 4 * 4);
        expect(result).toStrictEqual([2 / length, 3 / length, 4 / length]);

        const noLength = Vec3.normalize([0, 0, 0]);
        expect(noLength).toStrictEqual([NaN, NaN, NaN]);
    });

    test('finite', () => {
        const result = Vec3.finite([2, 3, 4]);
        expect(result).toBeTruthy();

        const infinityResult = Vec3.finite([Infinity, 2, 3]);
        expect(infinityResult).toBeFalsy();

        const nanResult = Vec3.finite([NaN, 2, 3]);
        expect(nanResult).toBeFalsy();
    });

    test('any', () => {
        const result = Vec3.any([2, 3, 4], (num) => num % 2 === 0);
        expect(result).toBeTruthy();
    });

    test('all', () => {
        const result = Vec3.all([2, 3, 4], (num) => num % 2 === 0);
        expect(result).toBeFalsy();

        const result2 = Vec3.all([2, 4, 6], (num) => num % 2 === 0);
        expect(result2).toBeTruthy();
    });

    test('exactlyEqual', () => {
        const result = Vec3.exactlyEqual([2, 3, 4], [4, 5, 6]);
        expect(result).toBeFalsy();

        const result2 = Vec3.exactlyEqual([2, 3, 4], [2, 3, 4]);
        expect(result2).toBeTruthy();
    });
    test('swizzle', () => {
        expect(Vec3.swizzle([111, 222, 33], [2, 1, 2])).toStrictEqual([33, 222, 33]);
        expect(Vec3.swizzle([111, 222, 33], [0, 1, 0])).toStrictEqual([111, 222, 111]);
        // dangerous cases:
        expect(Vec3.swizzle([111, 222, 33], [2, 1, 3])).toStrictEqual([33, 222, undefined]);
    });
    test('xy', () => {
        const result = Vec3.xy([2, 3, 4]);
        expect(result).toStrictEqual([2, 3]);
    });
    test('isVec3', () => {
        expect(Vec3.isVec3([1, 2, 3])).toBeTruthy();
        expect(Vec3.isVec3([1, 2, 2, 3])).toBeFalsy();
        expect(Vec3.isVec3([1, 2])).toBeFalsy();
    });
    test('cross, follows right-hand rule for easy-to-follow cases', () => {
        expect(Vec3.cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1])
        expect(Vec3.cross([1, 0, 0], [0, 0, 1])).toEqual([0, -1, 0])
        expect(Vec3.cross([0, 1, 0], [0, 0, 1])).toEqual([1, 0, 0])
    })
    test('cross for degenerate cases', () => {
        expect(Vec3.cross([1, 0, 0], [1, 0, 0])).toEqual([0, 0, 0])
        expect(Vec3.cross([1, 0, 0], [-1, 0, 0])).toEqual([0, -0, 0])
    })
});
