import { Vec2, type vec2 } from "./vec2";

export type line = { start: vec2; end: vec2 };

/**
 * Given two line segments, determine if they intersect. If they do, we return a 1, otherwise we return a 0. This
 * is so we can count up how many hits there are across a number of lines to determine if a point is inside
 * a polygon.
 *
 * WARNING: For our purposes, we don't consider colinear and coincident line segments to intersect. This is technically
 * incorrect, but is good enough for our usage. If/when this assumption changes, feel free to update the math here.
 *
 * WARNING: Our line segments are interpreted to be half-closed (the start point intersects but not the end point). This is
 * a convenient (and common) practices when we make larger structures out of conjoined line-segments. There is a unit test
 * proving that it is half-closed, so don't be surprised if you change that and tests start failing!
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
export function lineSegmentsIntersect(
	firstLine: line,
	secondLine: line,
): 1 | 0 {
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
		// if the determinant is 0, the lines are parallel
		return 0;
	}

	const t = Vec2.det(AC, CD) / BAxDC;
	const u = Vec2.det(AC, AB) / BAxDC;

	// Once we have t and u, we know that the lines intersect if t and u are both between 0 and 1
	// NOTE: This is a slight modification from the Wikipedia algorithm linked in the JSDoc.
	// t and u are each checked against the half closed interval [0,1). Each represents the
	// (bezier) parameter of the intersection point in terms of the other - that is to say where
	// on the first line does the second line (if it were infinite) hit, and where on the second
	// line does the first line hit (if it were infinite).
	return t >= 0 && t < 1 && u >= 0 && u < 1 ? 1 : 0;
}
