import { describe, expect, test } from 'vitest';
import { lineSegmentsIntersect } from '../line';
import { Vec2 } from '../vec2';

describe('line', () => {
    test('lineSegmentsIntersect finds intersection', () => {
        const firstLine = { start: Vec2.new(0, 0), end: Vec2.new(1, 1) };
        const secondLine = { start: Vec2.new(1, 0), end: Vec2.new(0, 1) };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(1);
    });

    test('lineSegmentsIntersect finds no intersection', () => {
        const firstLine = { start: Vec2.new(0, 0), end: Vec2.new(1, 1) };
        const secondLine = { start: Vec2.new(1, 0), end: Vec2.new(2, 1) };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect fines no intersection for coincident lines', () => {
        const firstLine = { start: Vec2.new(0, 0), end: Vec2.new(1, 1) };
        const secondLine = { start: Vec2.new(2, 2), end: Vec2.new(3, 3) };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect finds no intersection for parallel lines', () => {
        const firstLine = { start: Vec2.new(0, 0), end: Vec2.new(1, 1) };
        const secondLine = { start: Vec2.new(0, 1), end: Vec2.new(1, 2) };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });
});
