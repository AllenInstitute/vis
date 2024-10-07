

// I've got to start simple or I will go crazy and get nowhere

import type { vec4, vec2, vec3 } from "@alleninstitute/vis-geometry";
import { flatMap } from "lodash";
import type { Framebuffer2D } from "regl";
import type REGL from "regl"


// lets render edges as instanced:
// an edge will be a rectangle in UV - V=0 will run along the center of the line we're drawing
// V will be zero on both extremes
// U will be 0 at the start of the edge, and 1 at the end.
const vert = `
    precision highp float;
    attribute vec3 uv;      // the object-space edge - start and end are instanced!
    attribute vec4 start;  // x,y,z, radius 
    attribute vec4 end;

    uniform vec4 view;

    varying vec2 edgePos;
    varying vec3 linePos;

    vec4 makeUpCircle(){
        // find a circle that goes through start and end
        vec2 A = start.xy;
        vec2 B = end.xy;
        vec2 AB = end.xy-start.xy;
        vec2 mid = (A+B)/2.0;
        vec2 lineDir = normalize(AB);
        vec2 offDir = vec2(-lineDir.y,lineDir.x);

        // make up a pretend center point:
        // // float R = 10.8*length(AB);
        vec2 C =(offDir*(0.15*length(AB))) + mid;
        vec2 BC = C-B;
        // // we need the angle of the corner A:
        float sinA = length(C-mid)/length(C-A);
        float R = length(BC)/(2.0*sinA);

        vec2 center = (-R*offDir)+C;
        // TODO: theta is not needed, remove
        float theta = 2.0* asin(length(B-mid)/length(B-center));
  
        return vec4(center,R, theta);
    }
    vec2 curveEdge(float p, vec4 circle){
        float R = circle.z;
        vec4 P = mix(start,end,p);
        vec2 dir = normalize(P.xy-circle.xy);
        float r = uv.y*0.03*max(1.0, log(P.w));
        return circle.xy + (R*dir)+(r*dir);
        return (r*dir)+P.xy;
    }

    void main(){
        vec2 dir = normalize(end.xy-start.xy);
        vec4 pos = mix(start,end,uv.z);

        vec2 off = vec2(-dir.y,dir.x);
        // to offset, we have to convert uv.xy into data-specific terms:
        vec2 Dx = 0.0*uv.x*dir; // that is to say, uv.x is along the line, uv.y is orthagonal to it.
        vec2 Dy = uv.y*off;
        float R = 0.03*max(1.0, log(pos.w));
        vec2 w = R*(Dx+Dy);
        
        // the dataspace position is thus:
        vec3 P = vec3(pos.xy+w,pos.z);
        vec4 circle = makeUpCircle();
        P.xy = curveEdge(uv.z, circle);
        pos.xy = curveEdge(uv.z, circle);
        // now apply the camera like usual!
        vec2 size = view.zw-view.xy;
        vec2 unit = (P.xy-view.xy)/size;
        vec2 clip = (unit*2.0)-1.0;

        edgePos = P.xy;
        linePos = vec3(pos.xy,uv.z);

        gl_Position = vec4(clip.xy,P.z,1.0);
    }

`

const frag = `precision highp float;
    uniform vec4 color;
    
    varying vec2 edgePos;
    varying vec3 linePos;

    void main(){
        // start simple!
        float p = linePos.z;
        // center that...
        p = abs(p-0.5)*2.0;
        vec4 clr = color;
        float R = mix(0.005,0.015,p)/2.0;
        // if(length(edgePos.xy-linePos.xy) > R){
            
        // }
        // clr.a *= (1.0-smoothstep(R-0.0002,R+0.0002,length(edgePos.xy-linePos.xy)));
        clr.g = length(edgePos.xy-linePos.xy)/0.03;
        clr.b = p;
        gl_FragColor = clr;
    }
`
type Props = {
    view: vec4;
    target: Framebuffer2D | null;
    instances: number,
    color: vec4;
    start: REGL.Buffer;
    end: REGL.Buffer;
}
type Unis = {
    color: vec4,
    view: vec4;
}
type Attrs = {
    uv: REGL.Attribute,
    start: REGL.AttributeConfig,
    end: REGL.AttributeConfig,
}
const v = (x: number, y: number, p: number): vec3 => [x, y, p]
const verts = {
    A: v(0, 0, 0),
    B: v(-1, 1, 0),
    C: v(-1, -1, 0),

    D: v(0, 0, 1),
    E: v(1, -1, 1),
    F: v(1, 1, 1)
}
function buildStrip(d: number) {
    const nums: number[] = []
    for (let p = 0.0; p <= 1.0; p += 1.0 / d) {
        nums.push(p, 1, p);
        nums.push(p, -1, p);
    }
    return nums;
}
type V = keyof typeof verts;
type Tri = [V, V, V];
type Line = [V, V];
const tris: Tri[] = [['A', 'B', 'C'], ['B', 'D', 'F'], ['B', 'A', 'D'], ['C', 'A', 'D'], ['C', 'D', 'E'], ['D', 'E', 'F']]
// const tris: Tri[] = [['B', 'C', 'E'], ['B', 'E', 'F']]
function flattenTri(tri: Tri) {
    const [A, B, C] = tri;
    return [...verts[A], ...verts[B], ...verts[C]]
}
const lines: Line[] = [['D', 'E']]
function flattenLine(line: Line) {
    const [A, B] = line;
    return [...verts[A], ...verts[B]]
}
export function buildEdgeRenderer(regl: REGL.Regl) {
    const verts = buildStrip(30);
    const cmd = regl<Unis, Attrs, Props>({
        vert,
        frag,
        count: verts.length / 3,
        attributes: {
            uv: verts, //flatMap(tris.map(flattenTri)), //flatMap(lines.map(flattenLine))
            start: {
                buffer: regl.prop<Props, 'start'>('start'),
                divisor: 1
            },
            end: {
                buffer: regl.prop<Props, 'end'>('end'),
                divisor: 1
            }
        },
        uniforms: {
            view: regl.prop<Props, 'view'>('view'),
            color: regl.prop<Props, 'color'>('color'),
        },
        depth: { enable: false },
        blend: {
            enable: true, func: {
                dst: 'one minus src alpha',
                src: 'src alpha'
            }
        },
        framebuffer: regl.prop<Props, 'target'>('target'),
        instances: regl.prop<Props, 'instances'>('instances'),
        primitive: 'triangle strip',
    });

    return (props: Props) => cmd(props)
}