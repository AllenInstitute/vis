import { Box3D } from '../box3D';
import { Vec3 } from '../vec3';
import { describe, expect, test } from 'vitest'
describe('Box3D', () => {
    // Basic box to use throughout the tests
    const box = Box3D.create([1, 2, 3], [3, 4, 5]);

    test('create', () => {
        expect(box).toStrictEqual({ minCorner: [1, 2, 3], maxCorner: [3, 4, 5] });
    });

    test('corners', () => {
        const corners = Box3D.corners(box);
        // Checks that we get them back in this order:
        // - bottom left front
        // - bottom left back
        // - bottom top front
        // - bottom top back
        // - top left front
        // - top left back
        // - top right front
        // - top right back
        expect(corners).toStrictEqual([
            [1, 2, 3],
            [1, 2, 5],
            [1, 4, 3],
            [1, 4, 5],
            [3, 2, 3],
            [3, 2, 5],
            [3, 4, 3],
            [3, 4, 5],
        ]);
    });
    test('map', () => {
        expect(Box3D.map(Box3D.create([0, 0, 0], [1, 1, 1]), (v) => Vec3.scale(v, 300))).toStrictEqual(
            Box3D.create([0, 0, 0], [300, 300, 300])
        );
    });
    test('isValid', () => {
        const validBox = Box3D.isValid(box);
        expect(validBox).toBeTruthy();

        const nanBox = Box3D.isValid(Box3D.create([NaN, NaN, NaN], [1, 1, 1]));
        expect(nanBox).toBeFalsy();

        const infinityBox = Box3D.isValid(Box3D.create([Infinity, Infinity, Infinity], [1, 1, 1]));
        expect(infinityBox).toBeFalsy();

        const noAreaBox = Box3D.isValid(Box3D.create([0, 0, 0], [0, 0, 0]));
        expect(noAreaBox).toBeFalsy();
    });

    test('union', () => {
        const union = Box3D.union(box, Box3D.create([3, 3, 3], [5, 5, 5]));
        expect(union).toStrictEqual(Box3D.create([1, 2, 3], [5, 5, 5]));
    });

    test('intersection', () => {
        const intersection = Box3D.intersection(box, Box3D.create([2, 3, 4], [5, 5, 5]));
        expect(intersection).toStrictEqual(Box3D.create([2, 3, 4], [3, 4, 5]));

        // Borders by sharing the same min corner and a max corner where the Y is flipped
        const borderIntersection = Box3D.intersection(box, Box3D.create([1, 2, 3], [3, -4, 5]));
        expect(borderIntersection).toBeUndefined();

        const noIntersection = Box3D.intersection(box, Box3D.create([10, 10, 10], [20, 20, 20]));
        expect(noIntersection).toBeUndefined();
    });

    test('containsPoint', () => {
        const insidePoint = Box3D.containsPoint(box, [2, 3, 4]);
        expect(insidePoint).toBeTruthy();

        const outsidePoint = Box3D.containsPoint(box, [0, 0, 0]);
        expect(outsidePoint).toBeFalsy();

        // A point on the lower border is not contained within the box
        const lowerBorderPoint = Box3D.containsPoint(box, [1, 2, 3]);
        expect(lowerBorderPoint).toBeFalsy();

        // A point on the upper border is contained within the box
        const upperBorderPoint = Box3D.containsPoint(box, [3, 4, 5]);
        expect(upperBorderPoint).toBeTruthy();
    });

    test('size', () => {
        const size = Box3D.size(box);
        expect(size).toStrictEqual([2, 2, 2]);
    });

    test('midpoint', () => {
        const midpoint = Box3D.midpoint(box);
        expect(midpoint).toStrictEqual([2, 3, 4]);
    });

    test('toFlatArray', () => {
        const flatArray = Box3D.toFlatArray(box);
        expect(flatArray).toStrictEqual([1, 2, 3, 3, 4, 5]);
    });
});
