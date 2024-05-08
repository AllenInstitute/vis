import { describe, expect, test } from 'vitest';
import { line, lineSegmentsIntersect } from '../line';

describe('line', () => {
    test('lineSegmentsIntersect finds intersection', () => {
        const firstLine: line = { start: [0, 0], end: [1, 1] };
        const secondLine: line = { start: [1, 0], end: [0, 1] };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(1);
    });

    test('lineSegmentsIntersect finds no intersection', () => {
        const firstLine: line= { start: [0, 0] , end: [1, 1] };
        const secondLine: line = { start: [1, 0] , end: [2, 1] };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect finds intersection for segment that starts on the end of another one', () => {
        const firstLine: line = { start: [0, 0] , end: [2, 2]  };
        const secondLine: line = { start: [2, 2] , end: [2, 4]  };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersects are half-closed', () => {
        // FYI, we chose half-closed because this is used for a bounds testing algorithm, where a point is
        // inside a polygon if we have an odd number of intersections. We draw a test line and find
        // intersections of the polygon segments with that line. So if the test line randomly happens
        // to hit a vertex of a polygon segment, we end up with an odd number of intersections.
        // Diagram of points in test:
        //                       |
        // Second line           |
        // Test line        ----------
        // First line           /
        //                     /
        const testLine: line = { start: [0, 1] , end: [2, 1]  };
        const firstLine: line = { start: [0, 0] , end: [1, 1]  };
        const secondLine: line = { start: [1, 1] , end: [1, 2]  };

        const firstTest = lineSegmentsIntersect(testLine, firstLine);
        const secondTest = lineSegmentsIntersect(testLine, secondLine);

        expect(firstTest).toBe(0);
        expect(secondTest).toBe(1);
        expect(firstTest + secondTest).toBe(1);
    });

    test('lineSegmentsIntersect finds no intersection for coincident line segments when start of one is at end of other', () => {
        const firstLine: line = { start: [0, 0] , end: [2, 2]  };
        const secondLine: line = { start: [2, 2] , end: [3, 3]  };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect finds no intersection for collinear line segments', () => {
        const firstLine: line = { start: [0, 0] , end: [1, 1]  };
        const secondLine: line = { start: [2, 2] , end: [3, 3]  };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    test('lineSegmentsIntersect finds no intersection for parallel line segments', () => {
        const firstLine: line = { start: [0, 0] , end: [1, 1]  };
        const secondLine: line = { start: [0, 1] , end: [1, 2]  };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });

    // For our purposes, we don't consider colinear and coincident line segments to intersect
    test('lineSegmentsIntersect finds 0 intersection for coincident & colinear line segments (WARNING: technically incorrect)', () => {
        const firstLine: line = { start: [0, 0] , end: [2, 2]  };
        const secondLine: line = { start: [1, 1] , end: [3, 3]  };
        expect(lineSegmentsIntersect(firstLine, secondLine)).toBe(0);
    });
});
