import type { vec4, vec2 } from "@alleninstitute/vis-geometry";
import REGL from "regl";

const frag = `
precision highp float;
uniform vec4 color;
void main(){
    gl_FragColor = vec4(color.rgb*color.a,color.a);
}
`;
const vert = `
precision highp float;
attribute vec2 position;
uniform vec4 view;
uniform vec2 offset;

vec2 unitToClip(vec2 u){
    return (u-0.5)*2.0;
}

void main(){
    vec2 size = view.zw-view.xy;
    vec2 pos= ((position+offset)-view.xy)/size;
    gl_Position = vec4(unitToClip(pos),0.0,1.0);
}
`;

type Uniforms = {
	view: vec4;
	offset: vec2;
	color: vec4;
};
type Attribs = {
	position: REGL.AttributeConfig;
};

type Props = {
	view: vec4;
	offset: vec2;
	position: REGL.AttributeConfig;
	count: number;
	viewport: REGL.BoundingBox;
	color: vec4;
	target: REGL.Framebuffer | null;
};

type LoopProps = { count: number } & Omit<Props, "triangles">;

export function buildLoopRenderer(regl: REGL.Regl) {
	const cmd = regl<Uniforms, Attribs, LoopProps>({
		vert,
		frag,
		primitive: "line loop",
		uniforms: {
			view: regl.prop<LoopProps, "view">("view"),
			offset: regl.prop<LoopProps, "offset">("offset"),
			color: regl.prop<LoopProps, "color">("color"),
		},
		attributes: { position: regl.prop<LoopProps, "position">("position") },
		viewport: regl.prop<LoopProps, "viewport">("viewport"),
		framebuffer: regl.prop<LoopProps, "target">("target"),
		count: regl.prop<LoopProps, "count">("count"),
		depth: {
			mask: false,
			enable: false,
		},
		blend: {
			enable: true,
		},
	});
	return (args: LoopProps[]) => {
		cmd(args);
	};
}
export function buildMeshRenderer(
	regl: REGL.Regl,
	mode: "draw-stencil" | "use-stencil",
) {
	const cmd = regl<Uniforms, Attribs, Props>({
		vert,
		frag,
		primitive: "triangle fan",
		uniforms: {
			view: regl.prop<Props, "view">("view"),
			offset: regl.prop<Props, "offset">("offset"),
			color: regl.prop<Props, "color">("color"),
		},
		attributes: { position: regl.prop<Props, "position">("position") },
		count: regl.prop<Props, "count">("count"),
		viewport: regl.prop<Props, "viewport">("viewport"),
		framebuffer: regl.prop<Props, "target">("target"),
		depth: {
			mask: false,
			enable: false,
		},
		blend: {
			enable: true,
		},
		...(mode === "draw-stencil"
			? {
					colorMask: [false, false, false, false],
					stencil: {
						enable: true,
						mask: -1,
						func: {
							cmp: "always",
							mask: -1,
							ref: 0,
						},
						op: {
							fail: "invert", // cmp is always - thus never fails...
							zfail: "invert",
							zpass: "invert",
						},
					},
				}
			: {
					// use-stencil
					stencil: {
						enable: true,
						mask: 0,
						func: {
							cmp: "lequal",
							mask: -1,
							ref: 1,
						},
						op: {
							fail: "keep",
							zfail: "keep",
							zpass: "keep",
						},
					},
				}),
	});
	return (
		...batches: {
			target: REGL.Framebuffer | null;
			viewport: REGL.BoundingBox;
			view: vec4;
			count: number;
			position: REGL.AttributeConfig;
			color: vec4;
			offset: vec2;
		}[]
	) => {
		cmd(batches);
	};
}
