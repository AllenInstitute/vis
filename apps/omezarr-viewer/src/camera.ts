import type { box2D, vec2 } from "@alleninstitute/vis-geometry"

// a basic camera, for viewing slices
export type Camera = {
    readonly view: box2D; // a view in 'data space'
    readonly screen: vec2; // what that view projects to in display space, aka pixels
    readonly projection: 'webImage' | 'cartesian'
}

// export function flipY(camera: Camera): Camera {
//     const { view, projection } = camera;
//     const { minCorner, maxCorner } = view;
//     return { ...camera, view: { minCorner: [minCorner[0], maxCorner[1]], maxCorner: [maxCorner[0], minCorner[1]] }, projection: projection === 'webImage' ? 'cartesian' : 'webImage' }
// }