import { BoxClassFactory, type box } from './BoundingBox';
import type { rectangle2D } from './Rectangle2D';
import { type vec2, Vec2 } from './vec2';

export type box2D = box<vec2>;

const isBox2D = (maybe: unknown): maybe is box2D => {
	if (typeof maybe === 'object' && maybe !== null && 'minCorner' in maybe && 'maxCorner' in maybe) {
		if (Array.isArray(maybe.minCorner) && Array.isArray(maybe.maxCorner)) {
			return maybe.minCorner.length === 2 && maybe.maxCorner.length === 2;
		}
	}

	return false;
};
const boxClass = BoxClassFactory<vec2>(Vec2);
function toRectangle2D(b: box2D): rectangle2D {
	return { center: boxClass.midpoint(b), size: boxClass.size(b) };
}

export const Box2D = { isBox2D, toRectangle2D, ...boxClass };
