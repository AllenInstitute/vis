import { Box2D } from '../box2D';
import { Vec2 } from '../vec2';
import { describe, expect, test } from 'vitest'
describe('box2D', () => {
    // Basic box to use throughout the tests
    const box = Box2D.create([1, 2], [3, 4]);

    test('create', () => {
        expect(box).toStrictEqual({ minCorner: [1, 2], maxCorner: [3, 4] });
    });

    test('corners', () => {
        const corners = Box2D.corners(box);
        // Checks that we get them back in this order:
        // - bottom left
        // - top left
        // - bottom right
        // - top right
        expect(corners).toStrictEqual([
            [1, 2],
            [1, 4],
            [3, 2],
            [3, 4],
        ]);
    });
    test('map', () => {
        expect(Box2D.map(Box2D.create([0, 0], [1, 1]), (v) => Vec2.scale(v, 200))).toStrictEqual(
            Box2D.create([0, 0], [200, 200])
        );
    });
    test('isValid', () => {
        const validBox = Box2D.isValid(box);
        expect(validBox).toBeTruthy();

        const nanBox = Box2D.isValid(Box2D.create([NaN, NaN], [1, 1]));
        expect(nanBox).toBeFalsy();

        const infinityBox = Box2D.isValid(Box2D.create([Infinity, Infinity], [1, 1]));
        expect(infinityBox).toBeFalsy();

        const noAreaPointBox = Box2D.isValid(Box2D.create([0, 0], [0, 0]));
        expect(noAreaPointBox).toBeFalsy();

        const noAreaLineBox = Box2D.isValid(Box2D.create([0, 0], [0, 100]));
        expect(noAreaLineBox).toBeFalsy();
    });

    test('union', () => {
        const union = Box2D.union(box, Box2D.create([3, 3], [5, 5]));
        expect(union).toStrictEqual(Box2D.create([1, 2], [5, 5]));
    });

    test('intersection', () => {
        const intersection = Box2D.intersection(box, Box2D.create([2, 3], [5, 5]));
        expect(intersection).toStrictEqual(Box2D.create([2, 3], [3, 4]));

        const borderIntersection = Box2D.intersection(box, Box2D.create([3, 3], [5, 5]));
        expect(borderIntersection).toBeUndefined();

        const noIntersection = Box2D.intersection(box, Box2D.create([10, 10], [20, 20]));
        expect(noIntersection).toBeUndefined();
    });

    test('containsPoint', () => {
        const insidePoint = Box2D.containsPoint(box, [2, 3]);
        expect(insidePoint).toBeTruthy();

        const outsidePoint = Box2D.containsPoint(box, [0, 0]);
        expect(outsidePoint).toBeFalsy();

        // A point on the lower border is not contained within the box
        const lowerBorderPoint = Box2D.containsPoint(box, [1, 2]);
        expect(lowerBorderPoint).toBeFalsy();

        // A point on the upper border is contained within the box
        const upperBorderPoint = Box2D.containsPoint(box, [3, 4]);
        expect(upperBorderPoint).toBeTruthy();
    });

    test('size', () => {
        const size = Box2D.size(box);
        expect(size).toStrictEqual([2, 2]);
    });

    test('midpoint', () => {
        const midpoint = Box2D.midpoint(box);
        expect(midpoint).toStrictEqual([2, 3]);
    });

    test('toFlatArray', () => {
        const flatArray = Box2D.toFlatArray(box);
        expect(flatArray).toStrictEqual([1, 2, 3, 4]);
    });
});
