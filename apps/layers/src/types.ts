import type { box2D } from "@alleninstitute/vis-geometry";
import type { NormalStatus } from "@alleninstitute/vis-scatterbrain";
import type REGL from "regl";

// note: right now, all layers should be considered 2D, and WebGL only...
export type Image = {
    texture: REGL.Framebuffer2D
    bounds: box2D;
}
