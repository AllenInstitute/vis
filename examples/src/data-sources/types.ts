import type { vec2 } from '@alleninstitute/vis-geometry';
export type MaybePromise<T> = T | Promise<T>;

// we'd like to be able to configure a layer with a simple payload
export type Simple2DTransform = {
	offset: vec2;
	scale: vec2;
};
export type OptionalTransform = {
	toModelSpace?:
		| {
				offset: vec2;
				scale: vec2;
		  }
		| undefined;
};
