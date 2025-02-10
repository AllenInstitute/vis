import type { VectorLib } from './vector';

type VectorConstraint = ReadonlyArray<number>;
export type box<V extends VectorConstraint> = {
	readonly minCorner: V;
	readonly maxCorner: V;
};

export function BoxClassFactory<V extends VectorConstraint>(lib: VectorLib<V>) {
	const create = (low: V, hi: V) => ({ minCorner: low, maxCorner: hi });
	const isValid = (a: box<V>) => {
		const diff = lib.sub(a.maxCorner, a.minCorner);
		return lib.finite(a.maxCorner) && lib.finite(a.minCorner) && lib.all(diff, (v: number) => v > 0.0);
	};
	const union = (a: box<V>, b: box<V>) => ({
		minCorner: lib.min(a.minCorner, b.minCorner),
		maxCorner: lib.max(a.maxCorner, b.maxCorner),
	});
	const corners = (a: box<V>) => {
		const what = a.minCorner.map(() => false);
		const next = () => {
			for (let i = what.length - 1; i >= 0; i -= 1) {
				if (!what[i]) {
					what[i] = true;
					return true;
				}
				what[i] = false;
			}
			return false;
		};
		const vals: V[] = [];
		const pickValue = (v: boolean, i: number) => (v ? a.maxCorner[i] : a.minCorner[i]);
		do {
			vals.push(what.map(pickValue) as unknown as V);
		} while (next());
		return vals;
	};
	const setCorner = (box: box<V>, cornerIndex: number, position: V): box<V> => {
		// cornerIndex is based from the generated corners from box.corners
		// The corner index corresponds to a binary representation where each bit represents a dimension.
		// For example, in a 2D box, [[minX, minY], [minX, maxY], [maxX, minY], [maxX, maxY]] would be [[0,0], [0,1], [1,0], [1,1]]
		const binaryIndex = cornerIndex.toString(2).padStart(box.minCorner.length, '0').split('').map(Number);

		const newMinCorner = [...box.minCorner];
		const newMaxCorner = [...box.maxCorner];

		// And then based on the binaryIndex (dimensions), set the correct value in each corner so the box corner outputs to the intended position
		for (let i = 0; i < binaryIndex.length; i += 1) {
			if (binaryIndex[i] === 0) {
				newMinCorner[i] = position[i];
			} else {
				newMaxCorner[i] = position[i];
			}
		}

		// Validate that minCorner is actually the minimum and maxCorner is the maximum
		for (let i = 0; i < newMinCorner.length; i += 1) {
			if (newMinCorner[i] > newMaxCorner[i]) {
				[newMinCorner[i], newMaxCorner[i]] = [newMaxCorner[i], newMinCorner[i]];
			}
		}

		return {
			minCorner: newMinCorner as unknown as V,
			maxCorner: newMaxCorner as unknown as V,
		};
	};
	const intersection = (a: box<V>, b: box<V>) => {
		const result: box<V> = {
			minCorner: lib.max(a.minCorner, b.minCorner),
			maxCorner: lib.min(a.maxCorner, b.maxCorner),
		};
		if (isValid(result)) {
			return result;
		}
		return undefined;
	};
	const containsPoint = (box: box<V>, point: V) => {
		const greaterThanMin = lib.all(lib.sub(point, box.minCorner), (v) => v > 0.0);
		const lessThanMax = lib.all(lib.sub(box.maxCorner, point), (v) => v >= 0.0);
		return greaterThanMin && lessThanMax;
	};

	const toFlatArray = (box: box<V>) => [...box.minCorner, ...box.maxCorner] as const;
	const size = (b: box<V>) => lib.sub(b.maxCorner, b.minCorner);
	const midpoint = (b: box<V>) => lib.scale(lib.add(b.minCorner, b.maxCorner), 0.5);
	const map = (box: box<V>, fn: (v: V) => V) => ({
		minCorner: fn(box.minCorner),
		maxCorner: fn(box.maxCorner),
	});
	const scale = (box: box<V>, s: V) => map(box, (c: V) => lib.mul(s, c));
	const translate = (box: box<V>, offset: V) => map(box, (c: V) => lib.add(c, offset));
	return {
		create, // build a box
		corners, // get all the corners of the box
		setCorner, // set a specific corner of the box to the given position
		isValid, // return false if the box has any non-finite points, or has a negative or zero volume/area etc..
		union, // return the smallest box that contains the two given boxes
		intersection, // return the intersection of two boxes if it exists
		containsPoint, // return true if a point is in a box - note that this is exclusive on the low side, and inclusive on the high side
		size, // how big is it?
		midpoint, // yup you guessed it, return a vector at the center of a box.
		toFlatArray,
		scale,
		map,
		translate,
	} as const;
}
