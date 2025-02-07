import type { box2D, vec2, vec4 } from "@alleninstitute/vis-geometry";
import type REGL from "regl";
import type { FrameLifecycle } from "../render-queue";

export type RenderFn<Data, Settings> = (
	target: REGL.Framebuffer2D | null,
	thing: Readonly<Data>,
	settings: Readonly<Settings>,
) => FrameLifecycle;

export type Image = {
	resolution: vec2;
	texture: REGL.Framebuffer2D;
	bounds: box2D | undefined; // if undefined, it means we allocated the texture, but its empty and should not be used (except to fill it)
};

type ImageRendererProps = {
	target: REGL.Framebuffer2D | null;
	box: vec4;
	view: vec4;
	viewport: REGL.BoundingBox;
	img: REGL.Texture2D | REGL.Framebuffer2D;
};

// a function which renders an axis aligned image to another axis aligned image - no funny buisness
export type ImageRenderer = (props: ImageRendererProps) => void;
