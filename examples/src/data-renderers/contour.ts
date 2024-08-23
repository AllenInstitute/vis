
// given an image with a heightmap in the red channel
// render countour lines at even intervals

import type { vec2, vec4 } from "@alleninstitute/vis-geometry";
import type { Framebuffer2D } from "regl";
import type REGL from "regl"

const frag = `precision highp float;
    uniform sampler2D heightmap;
    uniform vec2 txStep;
    uniform vec4 color;

    varying vec2 txCoord;
    float dstToLine(float self, float next){
        // if the contour line ceil(self)
        // is below next, then we should be part of the line
        // todo perf:
        if(ceil(self) < next){
            return abs(ceil(self)-(self+0.5));
        }
        return 1.0;
    }
    void main(){
        float s = 0.010;
        float p = texture2D(heightmap, txCoord).g;
        float other =  texture2D(heightmap, txCoord).b;
        float me = s*texture2D(heightmap, txCoord).r;
        // vec4 pass = texture2D(heightmap, txCoord);
        float L = s*texture2D(heightmap, txCoord+(vec2(-1,0)*txStep)).r;
        float R = s*texture2D(heightmap, txCoord+(vec2(1,0)*txStep)).r;
        float B = s*texture2D(heightmap, txCoord+(vec2(0,-1)*txStep)).r;
        float T = s*texture2D(heightmap, txCoord+(vec2(0,1)*txStep)).r;
        float C = min(dstToLine(me,L),
            min(dstToLine(me,R),
            min(dstToLine(me,B),
            dstToLine(me,T))));
         gl_FragColor = vec4(color.rgb*(1.0-C)+mix(vec3(p/2.0,0,0),vec3(0.3,0.3,0.3), step(0.1,other)), 1.0); 
       // gl_FragColor = vec4(me);
    }
`
const vert = `
precision highp float;
    attribute vec2 position;
    
    uniform vec4 view;
    uniform vec2 offset;

    varying vec2 txCoord;
    void main(){
        txCoord = position;
        vec2 size = view.zw-view.xy;
        vec2 pos = position;//((position+offset)-view.xy)/size;
        vec2 clip = (pos*2.0)-1.0;
        gl_Position = vec4(clip,0.0,1);
    }
`
type Props = {
    target: Framebuffer2D | null;
    view: vec4
    txStep:vec2;
    color: vec4;
    //   viewport: REGL.BoundingBox;
    heightmap: REGL.Texture2D | REGL.Framebuffer2D;
};
export function buildContourRenderer(regl:REGL.Regl){
    const cmd = regl<
    { color:vec4;offset:vec2,txStep:vec2, view: vec4;  heightmap: REGL.Texture2D | REGL.Framebuffer2D },
    { position: REGL.BufferData },
    Props
    >({
        vert,
        frag,
        framebuffer: regl.prop<Props, 'target'>('target'),
        attributes: {
            position: [0, 0, 1, 0, 1, 1, 0, 1],
        },
        depth: {
            enable: false,
        },
        uniforms: {
            offset: [0,0],
            txStep: regl.prop<Props,'txStep'>('txStep'),
            view: regl.prop<Props, 'view'>('view'),
            color: regl.prop<Props, 'color'>('color'),
            heightmap: regl.prop<Props, 'heightmap'>('heightmap'),
        },
        blend: {
            enable: true,
            func: {
                src: 'src alpha',
                dst: 'one minus src alpha',
            },
        },
        count: 4,
        primitive: 'triangle fan',
    });
    return cmd;
}