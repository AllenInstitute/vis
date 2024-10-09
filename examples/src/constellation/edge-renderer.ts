

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
    attribute vec4 start;  // x,y,id, radius 
    attribute vec4 end;

    attribute vec4 pStart;  // x,y,id, radius 
    attribute vec4 pEnd;

    uniform vec4 view;
    uniform float anmParam;

    uniform sampler2D taxonomyPositions;
    uniform vec2 taxonomySize;
    uniform vec2 focus;

    varying vec4 clr;
    varying vec2 edgePos;
    varying vec3 linePos;

    // handle the animation of the edge  s--->e to pS ---> pE
    vec4 getAnimatedStart(){
        return mix(start, pStart, anmParam);
    }
    vec4 getAnimatedEnd(){
        return mix(end, pEnd, anmParam);
    }

    vec4 makeUpCircle(vec2 A, vec2 B){
        // find a circle that goes through start and end
        vec2 AB = B-A;
        vec2 mid = (A+B)/2.0;
        vec2 lineDir = normalize(AB);
        vec2 offDir = vec2(-lineDir.y,lineDir.x);

        // make up a pretend center point:
        float curvature = 0.2*abs(anmParam-0.5); // enbiggen me for a wilder curve!
        vec2 C =(offDir*(curvature*length(AB))) + mid;
        vec2 BC = C-B;
        // // we need the angle of the corner A:
        float sinA = length(C-mid)/length(C-A);
        float R = length(BC)/(2.0*sinA);

        vec2 center = (-R*offDir)+C;
        // TODO: theta is not needed, remove
        float theta = 2.0* asin(length(B-mid)/length(B-center));
  
        return vec4(center,R, theta);
    }
    vec2 curveEdge(float p, vec4 circle, float y, vec4 S, vec4 E){
        float R = circle.z;
        vec4 P = mix(S,E,p);
        vec2 dir = normalize(P.xy-circle.xy);
        float r = y*0.03*max(1.0, log(P.w));
        return circle.xy + (R*dir)+(r*dir);
        return (r*dir)+P.xy;
    }
    vec4 lookupTaxonomyColor(float id){
        float uS = taxonomySize.x;
        float vS = taxonomySize.y;
        return texture2D(taxonomyPositions, vec2(4.5/uS,(id+0.5)/vS));
    }
    vec4 getColor(float startId, float endId){
        // wiggle uv.z using a cosine for color transitions that take longer
        float p = (1.0+cos(uv.z*3.14159))/2.0;
        return mix(lookupTaxonomyColor(startId), lookupTaxonomyColor(endId), p)*0.7;
    }

    void main(){
        vec4 S = getAnimatedStart();
        vec4 E = getAnimatedEnd();
        vec2 dir = normalize(E.xy-S.xy);
        vec4 pos = mix(S,E,uv.z);
        
        float dpx = abs(view.z-view.x)/2000.0; // pretending the screen is 2000 px wide - good enough
        
        vec2 off = vec2(-dir.y,dir.x);
        // to offset, we have to convert uv.xy into data-specific terms:
        vec2 Dx = 0.0*uv.x*dir; // that is to say, uv.x is along the line, uv.y is orthagonal to it.
        vec2 Dy = uv.y*off;
        float R = 0.03*max(1.0, log(pos.w));
        vec2 w = R*(Dx+Dy);
        
        // the dataspace position is thus:
        vec3 P = vec3(pos.xy+w,pos.z);
        vec4 circle = makeUpCircle(S.xy,E.xy);
        float C = clamp(uv.z, 0.0,1.0);
        P.xy = curveEdge(uv.z, circle,uv.y,S,E);
        pos.xy = curveEdge(C, circle,0.0,S,E);
        // now apply the camera like usual!
        vec2 size = view.zw-view.xy;
        vec2 unit = (P.xy-view.xy)/size;
        vec2 clip = (unit*2.0)-1.0;

        

        edgePos = P.xy;
        linePos = vec3(pos.xy,C);
        // make the lines "hang" so they overlap in a nicer way:
        float Z = abs(uv.z-0.5);
        
        // however, if focus is within a few pixels S.xy, lift it up to highlight it
        float nearFocus = smoothstep(1.0, 0.0, min(length(focus-S.xy), length(focus-E.xy)));
        
        Z=1.0-(Z*Z);
        Z *= mix(1.0, -0.5, nearFocus);
        Z -= mix(0.0,0.1, nearFocus);

        clr = getColor(start.z,end.z); // dont animate these... its weird
        clr.a = mix(0.8,1.0,nearFocus);
        // also ramp very slightly on the edges...
        clr.a *= mix(1.0,0.8, uv.y*uv.y);

        gl_Position = vec4(clip.xy,Z,1.0);
    }

`

const frag = `precision highp float;
    uniform vec4 color;
    uniform vec4 view;

    varying vec2 edgePos;
    varying vec3 linePos;
    varying vec4 clr;

    void main(){
        // compute a reasonable guess at the size of a pixel in data space
        float dpx = abs(view.z-view.x)/2000.0; // pretending the screen is 2000 px wide - good enough
        // start simple!
        float p = linePos.z;
        // center that...
        p = abs(p-0.5)*2.0;

        float R = mix(dpx*8.0,dpx*24.0,p)/2.0;
       
        if(length(edgePos.xy-linePos.xy) > R+dpx){
            discard;
        }
   
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
    pStart: REGL.Buffer;
    pEnd: REGL.Buffer;
    anmParam: number;
    taxonomySize: vec2;
    taxonomyPositions: REGL.Texture2D;
    focus: vec2;
}
type Unis = {
    color: vec4,
    view: vec4;
    anmParam: number;
    taxonomySize: vec2;
    focus: vec2;
    taxonomyPositions: REGL.Texture2D;
}
type Attrs = {
    uv: REGL.Attribute,
    start: REGL.AttributeConfig,
    end: REGL.AttributeConfig,
    pStart: REGL.AttributeConfig,
    pEnd: REGL.AttributeConfig,
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
    const step = 1.0 / d;
    for (let p = -0.4; p <= 1.4; p += step) {
        nums.push(p, 1, p);
        nums.push(p, 0, p);
    }
    // do a U-turn:
    nums.push(1.4, 0, 1.4)
    nums.push(1.4 + step, 0, 1.4)
    nums.push(1.4, 0, 1.4)
    nums.push(1.4, -1, 1.4)
    // go back!
    for (let p = 1.4; p >= -0.4; p -= step) {
        nums.push(p, 0, p);
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
            },
            pStart: {
                buffer: regl.prop<Props, 'pStart'>('pStart'),
                divisor: 1
            },
            pEnd: {
                buffer: regl.prop<Props, 'pEnd'>('pEnd'),
                divisor: 1
            }
        },
        uniforms: {
            anmParam: regl.prop<Props, 'anmParam'>('anmParam'),
            view: regl.prop<Props, 'view'>('view'),
            taxonomySize: regl.prop<Props, 'taxonomySize'>('taxonomySize'),
            taxonomyPositions: regl.prop<Props, 'taxonomyPositions'>('taxonomyPositions'),
            color: regl.prop<Props, 'color'>('color'),
            focus: regl.prop<Props, 'focus'>('focus'),
        },
        depth: { enable: true },
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