import { describe, expect, test } from 'vitest';
import { lineSegmentsIntersect } from '../line';
import { Vec2 } from '../vec2';

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

    test('lineSegmentsIntersect finds no intersection for coincident lines', () => {
        const firstLine = { start: [0, 0] as const, end: [2, 2] as const };
        const secondLine = { start: [1, 1] as const, end: [3, 3] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect finds no intersection for collinear lines', () => {
        const firstLine = { start: [0, 0] as const, end: [1, 1] as const };
        const secondLine = { start: [2, 2] as const, end: [3, 3] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect finds no intersection for parallel lines', () => {
        const firstLine = { start: [0, 0] as const, end: [1, 1] as const };
        const secondLine = { start: [0, 1] as const, end: [1, 2] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    // For our purposes, we don't consider colinear and coincident line segments to intersect
    test('lineSegmentsIntersect finds 0 intersection for coincident & colinear lines (WARNING: technically incorrect)', () => {
        const firstLine = { start: [0, 0] as const, end: [2, 2] as const };
        const secondLine = { start: [1, 1] as const, end: [3, 3] as const };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });
});
