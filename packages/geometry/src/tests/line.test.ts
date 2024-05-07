import { describe, expect, test } from 'vitest';
import { lineSegmentsIntersect } from '../line';

describe('line', () => {
    test('lineSegmentsIntersect finds intersection', () => {
        const firstLine = { start: [0, 0] as const, end: [1, 1] as const };
        const secondLine = { start: [1, 0] as const, end: [0, 1] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(1);
    });

    test('lineSegmentsIntersect finds no intersection', () => {
        const firstLine = { start: [0, 0] as const, end: [1, 1] as const };
        const secondLine = { start: [1, 0] as const, end: [2, 1] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect finds intersection for segment that starts on the end of another one', () => {
        const firstLine = { start: [0, 0] as const, end: [2, 2] as const };
        const secondLine = { start: [2, 2] as const, end: [2, 4] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersects with test line on vertices counts only one intersection', () => {
        // Test used to validate a bounds testing algorithm, where a point is inside a polygon if
        // we have an odd number of intersections. We draw a test line and find intersections of
        // the polygon segments with that line. So if the test line randomly happens to hit a 
        // vertex of a polygon segment, we end up with an odd number of intersections.
        // Diagram of points in test:
        //                       |
        // Second line           |
        // Test line        ----------
        // First line           /
        //                     /
        const testLine = { start: [0, 1] as const, end: [2, 1] as const };
        const firstLine = { start: [0, 0] as const, end: [1, 1] as const };
        const secondLine = { start: [1, 1] as const, end: [1, 2] as const };

        const firstTest = lineSegmentsIntersect(testLine, firstLine);
        const secondTest = lineSegmentsIntersect(testLine, secondLine);

        expect(firstTest).toBe(0);
        expect(secondTest).toBe(1);
        expect(firstTest + secondTest).toBe(1);
    });

    test('lineSegmentsIntersect finds no intersection for coincident line segments when start of one is at end of other', () => {
        const firstLine = { start: [0, 0] as const, end: [2, 2] as const };
        const secondLine = { start: [2, 2] as const, end: [3, 3] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect finds no intersection for collinear line segments', () => {
        const firstLine = { start: [0, 0] as const, end: [1, 1] as const };
        const secondLine = { start: [2, 2] as const, end: [3, 3] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect finds no intersection for parallel line segments', () => {
        const firstLine = { start: [0, 0] as const, end: [1, 1] as const };
        const secondLine = { start: [0, 1] as const, end: [1, 2] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    // For our purposes, we don't consider colinear and coincident line segments to intersect
    test('lineSegmentsIntersect finds 0 intersection for coincident & colinear line segments (WARNING: technically incorrect)', () => {
        const firstLine = { start: [0, 0] as const, end: [2, 2] as const };
        const secondLine = { start: [1, 1] as const, end: [3, 3] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });
});
