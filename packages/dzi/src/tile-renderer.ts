import type { vec4 } from "@alleninstitute/vis-geometry";
import REGL from "regl";
type Props = {
	img: REGL.Texture2D;
	view: vec4;
	tile: vec4;
	depth: number;
	target: REGL.Framebuffer2D | null;
};
const vert = `
precision highp float;
uniform vec4 view;
uniform vec4 tile;
uniform float depth;
attribute vec2 position;
varying vec2 uv;
void main(){
    uv = position;
    vec2 size = view.zw-view.xy;
    vec2 tileSize = tile.zw-tile.xy;
    vec2 tilePosition = (position * tileSize)+tile.xy;
    vec2 pos =(tilePosition-view.xy)/size;
    // to clip space:
    pos = (pos*2.0)-1.0;
    gl_Position = vec4(pos.x,pos.y,depth,1);
}`;

const frag = `
precision highp float;
varying vec2 uv;
uniform sampler2D img;

void main(){
    gl_FragColor = texture2D(img, uv);
}
`;
export function buildTileRenderer(
	regl: REGL.Regl,
	blend: REGL.BlendingOptions,
) {
	const cmd = regl({
		vert,
		frag,
		depth: {
			enable: true,
		},
		blend,
		count: 4,
		primitive: "triangle fan",
		attributes: {
			position: [0, 0, 1, 0, 1, 1, 0, 1],
		},
		uniforms: {
			img: regl.prop<Props, "img">("img"),
			view: regl.prop<Props, "view">("view"),
			tile: regl.prop<Props, "tile">("tile"),
			depth: regl.prop<Props, "depth">("depth"),
		},
		framebuffer: regl.prop<Props, "target">("target"),
	});
	return (p: Props) => cmd(p);
}
