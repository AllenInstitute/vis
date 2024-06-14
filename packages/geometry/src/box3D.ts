import { BoxClassFactory, type box } from './BoundingBox';
import type { vec2 } from './vec2';
import { type vec3, Vec3 } from './vec3';

const isBox3D = (maybe: unknown): maybe is box3D => {
    if (typeof maybe === 'object' && maybe !== null && 'minCorner' in maybe && 'maxCorner' in maybe) {
        if (Array.isArray(maybe.minCorner) && Array.isArray(maybe.maxCorner)) {
            return maybe.minCorner.length === 3 && maybe.maxCorner.length === 3;
        }
    }

    return false;
};
export const Box3D = {
    ...BoxClassFactory<vec3>(Vec3),
    isBox3D,
    xy: (b: box<vec3>): box<vec2> => ({ minCorner: Vec3.xy(b.minCorner), maxCorner: Vec3.xy(b.maxCorner) }),
};
export type box3D = box<vec3>;
