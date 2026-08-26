import type { box2D, vec2 } from '@alleninstitute/vis-geometry';

// a basic camera, for viewing slices
export type Camera = {
    readonly view: box2D; // a view in 'data space'
    readonly screen: vec2; // what that view projects to in display space, aka pixels
    readonly projection: 'webImage' | 'cartesian';
};
