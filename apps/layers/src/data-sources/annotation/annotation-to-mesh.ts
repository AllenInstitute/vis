import { type box2D, type vec2, Box2D, Vec2, Vec4 } from '@alleninstitute/vis-geometry';
import type { Annotation, Path, PathCommand } from './annotation-schema-type';
import type { AnnotationMesh, AnnotationPolygon, ClosedLoop } from './types';

// a helper function, which does a first path over commands, grouping them into closed loops
function groupLoops(path: Path) {
    // collect each closed polygon from the path - because path commands are very flexible,
    // there could be multiple overlapping polygons in a single path!
    const { commands } = path;
    const closed = commands?.reduce(
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
        [[]] as PathCommand[][]
    ) ?? []
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
    const initialState: { data: number[]; bounds: box2D } = { data: [], bounds: Box2D.create(firstPoint, firstPoint) };

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
    }, initialState)
}
function onlyDefined<T>(collection: ReadonlyArray<T | undefined>): ReadonlyArray<T> {
    return collection.reduce((defined, cur) => {
        return cur !== undefined ? [...defined, cur] : defined
    }, [] as ReadonlyArray<T>);
}
export function MeshFromAnnotation(annotation: Annotation): AnnotationMesh {
    const groups =
        annotation.closedPolygons?.map((path) => ({ path, loops: onlyDefined(groupLoops(path).map(closedPolygon)) })) ?? [];

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
        0
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
            if (!loop) continue

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

    return {
        bounds: totalBounds,
        closedPolygons,
        points,
    };
}
