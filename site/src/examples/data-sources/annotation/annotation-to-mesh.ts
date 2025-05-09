import { Box2D, Vec2, Vec4, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import type { Annotation, Path, PathCommand } from './annotation-schema-type';
import type { AnnotationMesh, AnnotationPolygon, ClosedLoop } from './types';
// a helper function, which does a first path over commands, grouping them into closed loops
function groupLoops(path: Path) {
    // collect each closed polygon from the path - because path commands are very flexible,
    // there could be multiple overlapping polygons in a single path!
    const { commands } = path;
    const closed =
        commands?.reduce(
            (loops: PathCommand[][], command) => {
                const curLoop = loops[loops.length - 1];
                switch (command.type) {
                    case 'ClosePolygon':
                        curLoop.push(command);
                        // start a new loop
                        loops.push([]);
                        break;
                    case 'LineTo':
                    case 'MoveTo':
                    case 'CurveTo':
                        curLoop.push(command);
                        break;
                    default:
                        break;
                }
                return loops;
            },
            [[]] as PathCommand[][],
        ) ?? [];
    return closed.filter((loop) => loop.length > 0);
}
// helper function for computing a bounding box of a bunch of uncertain stuff in a reasonably performant way
function accumulateBounds(curBounds: box2D | vec2 | undefined, curPoint: vec2 | box2D): box2D {
    if (!curBounds) {
        return Box2D.isBox2D(curPoint) ? curPoint : Box2D.create(curPoint, curPoint);
    }
    if (Box2D.isBox2D(curBounds)) {
        return Box2D.union(curBounds, Box2D.isBox2D(curPoint) ? curPoint : Box2D.create(curPoint, curPoint));
    }
    if (Box2D.isBox2D(curPoint)) {
        return accumulateBounds(curPoint, curBounds);
    }
    return Box2D.create(Vec2.min(curPoint, curBounds), Vec2.max(curPoint, curBounds));
}
// given a set of path commands, which we assume has been pre-processed to contain only one closed loop,
// accumulate the bounds of that loop, and merge all the points into a single a data array for convenience later
// TODO someday support curve-to
function closedPolygon(loop: PathCommand[]) {
    if (loop.length < 1) return undefined;
    if (loop[0].data.length < 2) return undefined;

    const firstPoint: vec2 = [loop[0].data[0], loop[0].data[1]];
    const initialState: { data: number[]; bounds: box2D } = {
        data: [],
        bounds: Box2D.create(firstPoint, firstPoint),
    };

    return loop.reduce((acc, command) => {
        const data: number[] = acc.data;
        let { bounds } = acc;
        switch (command.type) {
            case 'ClosePolygon':
                data.push(...firstPoint);
                return { data, bounds };
            case 'LineTo':
            case 'MoveTo':
                for (let i = 0; i < command.data.length - 1; i += 2) {
                    bounds = accumulateBounds(bounds, [command.data[i], command.data[i + 1]]);
                }
                data.push(...command.data);
                return { data, bounds };
            case 'CurveTo':
                throw new Error('Error: developers must support curve-to commands in annotation shape paths');
            default:
        }
        return acc;
    }, initialState);
}
function onlyDefined<T>(collection: ReadonlyArray<T | undefined>): ReadonlyArray<T> {
    return collection.reduce(
        (defined, cur) => {
            if (cur !== undefined) {
                (defined as T[]).push(cur);
            }
            return defined;
        },
        [] as ReadonlyArray<T>,
    );
}

// intersection stuff:

type line = { a: vec2; b: vec2 };

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
function linesIntersect(firstLine: line, secondLine: line): 1 | 0 {
    // given line segments a->b and c->d:
    // make a vec for each point:
    const { a: A, b: B } = firstLine;
    const { a: C, b: D } = secondLine;

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

/**
 * Find the "first hit" of a point against a given annotation mesh. If the point is inside the annotation,
 * we return that annotation, otherwise we return undefined.
 *
 * An explanation of the algorithm and a diagram can be found in the function body.
 *
 * @param annotation The annotation mesh to search for a hit
 * @param p The coordinates that we want to use for finding the right annotation
 * @returns The annotation polygon that contains the point, or undefined if no polygon contains the point
 */
export function findFirstHit(annotation: AnnotationMesh, p: vec2): AnnotationPolygon | undefined {
    // return the first polygon in annotation that contains p,
    // accounting for all the holes that may have been cut out!
    // check out this rad ascii for a diagram of the problem at hand:
    /*        ---    o = miss x = hit!
         o  /  x  \___
           /    _____  \
           |   /  o  \  |
        o   \ x\_____/x/ o
            |    x    /
             \_______/  o
    */
    // we can compute this by drawing a line to our test point, p
    // the line starts out-side the bounds of the polygon as a whole,
    // starting at zero, every time this line hits an edge, increment a counter
    // once you reach the test point p, if the count is odd, then its a hit. its a miss otherwise!

    const start: vec2 = [annotation.bounds.minCorner[0] - 10, p[1]];
    const testLine: line = { a: start, b: p };
    for (const poly of annotation.closedPolygons) {
        if (Box2D.containsPoint(poly.bounds, p)) {
            let intersections = 0;
            // worth looking closer
            for (const loop of poly.loops) {
                // TODO: consider adding bounds to each loop - we could
                // skip this inner loop if its bounds dont contain p!
                // IMPORTANT: i stops at loop.length - 1, otherwise B will overflow into the next loop and cause chaos
                for (let i = 0; i < loop.length - 1; i += 1) {
                    const A = (loop.start + i) * 2;
                    const B = A + 2;
                    const a: vec2 = [annotation.points[A], annotation.points[A + 1]];
                    const b: vec2 = [annotation.points[B], annotation.points[B + 1]];
                    const hit = linesIntersect(testLine, { a, b });
                    intersections += hit;
                }
            }
            if (intersections % 2 !== 0) {
                return poly;
            }
        }
    }
    return undefined;
}

export function MeshFromAnnotation(annotation: Annotation): AnnotationMesh | undefined {
    const groups =
        annotation.closedPolygons?.map((path) => ({
            path,
            loops: onlyDefined(groupLoops(path).map(closedPolygon)),
        })) ?? [];

    if (groups.length < 1) {
        return {
            bounds: Box2D.create([1, 1], [-1, -1]),
            closedPolygons: [],
            points: new Float32Array(),
        };
    }
    // we have to pre-allocate a big pile of 32-bit floats, so we have to count all the lengths:
    const totalNumbers = groups.reduce(
        (sum, group) => sum + group.loops.reduce((total, loop) => total + (loop?.data.length ?? 0), 0),
        0,
    );

    const points = new Float32Array(totalNumbers);

    const groupBounds = (group: { loops: readonly { bounds: box2D }[] }) =>
        group.loops.reduce((bounds, cur) => Box2D.union(bounds, cur.bounds), group.loops[0].bounds);

    let outIndex = 0;
    let totalBounds: box2D | undefined;
    const closedPolygons: AnnotationPolygon[] = [];
    // accumulation of several things at ounce:
    // the total bounds, the counting outIndex, and polygons with potentially multiple loops
    for (const group of groups) {
        const { color } = group.path;
        const loops: ClosedLoop[] = [];
        if (group.loops.length < 1) continue;

        for (const loop of group.loops) {
            if (!loop) continue;

            const closedLoop: ClosedLoop = {
                start: outIndex / 2,
                length: loop.data.length / 2,
            };
            loops.push(closedLoop);
            points.set(loop.data, outIndex);
            outIndex += loop.data.length;
        }
        const bounds = groupBounds(group);
        totalBounds = accumulateBounds(totalBounds, bounds);
        closedPolygons.push({
            bounds,
            color: color ? Vec4.scale([color.red, color.green, color.blue, 255], 1 / 255) : [0, 0, 0, 1],
            loops,
        });
    }

    return totalBounds === undefined
        ? undefined
        : {
              bounds: totalBounds,
              closedPolygons,
              points,
          };
}
