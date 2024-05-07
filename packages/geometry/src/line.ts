import { Vec2, vec2 } from "./vec2";

export type line = { start: vec2; end: vec2 };

/**
 * Given two line segments, determine if they intersect. If they do, we return a 1, otherwise we return a 0. This
 * is so we can count up how many hits there are across a number of lines to determine if a point is inside
 * a polygon.
 * 
 * WARNING: For our purposes, we don't consider colinear and coincident line segments to intersect. This is technically
 * incorrect, but is good enough for our usage. If/when this assumption changes, feel free to update the math here.
 * 
 * WARNING: For our purposes, we don't consider a line segment that ends on the other line segment as intersecting so
 * that we can use this function in a point-in-polygon test.
 *
 * This is accomplished by using determinants to compare the two lines in an efficient manner. We don't need
 * the actual point of intersection, just whether or not the lines intersect, so we do not do the final step in the
 * wikipedia article linked below.
 * See more here: https://en.wikipedia.org/wiki/Line%E2%80%93line_intersection#Given_two_points_on_each_line_segment
 *
 * @param firstLine First line to compare
 * @param secondLine Second line to compare
 * @returns One if the lines intersect, zero otherwise
 */
export function lineSegmentsIntersect(firstLine: line, secondLine: line): 1 | 0 {
    // given line segments a->b and c->d:
    // make a vec for each point:
    const { start: A, end: B } = firstLine;
    const { start: C, end: D } = secondLine;

    const AB = Vec2.sub(A, B);
    const CD = Vec2.sub(C, D);
    const AC = Vec2.sub(A, C);

    // from the wikipedia link:
    // - 1s and 2s are A and B
    // - 3s and 4s are C and D
    // now use vec2.sub to group the points into vectors:
    // this is the common denominator:
    const BAxDC = Vec2.det(AB, CD);

    if (BAxDC === 0) {
        // if the determinant is 0, the lines are parallel or coincidental
        return 0;
    }

    const t = Vec2.det(AC, CD) / BAxDC;
    const u = Vec2.det(AC, AB) / BAxDC;

    // Once we have t and u, we know that the lines intersect if t and u are both between 0 and 1
    // NOTE: This is modified to not include the upper bounds, for use in a point-in-polygon test
    return t >= 0 && t < 1 && u >= 0 && u < 1 ? 1 : 0;
}
