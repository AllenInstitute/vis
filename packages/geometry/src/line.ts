import { Vec2, vec2 } from "./vec2";

export type line = { start: vec2; end: vec2 };

/**
 * Given two line segments, determine if they intersect. If they do, we return a 1, otherwise we return a 0. This
 * is so we can count up how many hits there are across a number of lines to determine if a point is inside
 * a polygon.
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
    const t = Vec2.det(AC, CD) / BAxDC;
    const u = Vec2.det(AC, AB) / BAxDC;

    // Once we have t and u, we know that the lines intersect if t and u are both between 0 and 1
    return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? 1 : 0;
}
