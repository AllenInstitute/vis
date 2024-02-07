import { box2D, vec2 } from "@vis/geometry"

// a basic camera, for viewing slices
export type Camera = {
    view: box2D; // a view in 'data space'
    screen: vec2; // what that view projects to in display space, aka pixels
}

