

// I've got to start simple or I will go crazy and get nowhere

import type { vec4, vec2 } from "@alleninstitute/vis-geometry";
import type { Framebuffer2D } from "regl";
import type REGL from "regl"


// lets render edges as instanced:
// an edge will be a rectangle in UV - V=0 will run along the center of the line we're drawing
// V will be zero on both extremes
// U will be 0 at the start of the edge, and 1 at the end.
const vert = `
    precision highp float;
    attribute vec3 uv;      // the object-space edge - start and end are instanced!
    attribute vec3 start;  // id,classId, radius 
    attribute vec3 end;    // id,classId,radius 

    attribute vec2 pStart;  // id, classId
    attribute vec2 pEnd;    // id, classId

    uniform vec4 view;
    uniform float anmParam;
    uniform float taxonLayer;

    uniform sampler2D taxonomyPositions;
    uniform vec2 taxonomySize;
    uniform vec2 focus;

    varying vec4 clr;
    varying vec3 edgePos;
    varying vec3 linePos;

    struct Edge {
        vec2 start;
        float srcR;
        vec4 srcColor;
        vec2 end;
        float dstR;
        vec4 dstColor;
    };

    // handle the animation of the edge  s--->e to pS ---> pE
    vec2 lookupPosition(float id, float layer){
        return texture2D(taxonomyPositions, vec2(layer+0.5,id+0.5)/taxonomySize).rg;
    }
    vec4 lookupTaxonomyColor(float id){
        float uS = taxonomySize.x;
        float vS = taxonomySize.y;
        return texture2D(taxonomyPositions, vec2(4.5/uS,(id+0.5)/vS));
    }
    Edge getAnimatedEdge(){
        vec2 sPos = lookupPosition(start.x,taxonLayer);
        vec2 psPos = lookupPosition(pStart.x, max(0.0,taxonLayer-1.0));
        vec2 ePos = lookupPosition(end.x,taxonLayer);
        vec2 pePos = lookupPosition(pEnd.x, max(0.0,taxonLayer-1.0));
        vec2 aStart = mix(sPos, psPos, anmParam);
        vec2 aEnd = mix(ePos, pePos, anmParam);

        vec4 sColor = lookupTaxonomyColor(start.y);
        vec4 eColor = lookupTaxonomyColor(end.y);
        return Edge(aStart,start.z,sColor,aEnd,end.z,eColor);
    }

    vec3 makeUpCircle(vec2 A, vec2 B){
        // find a circle that goes through start and end
        vec2 AB = B-A;
        vec2 mid = (A+B)/2.0;
        vec2 lineDir = normalize(AB);
        vec2 offDir = vec2(-lineDir.y,lineDir.x);

        // make up a pretend center point:
        
        float curvature =0.15;
        vec2 C =(offDir*(curvature*length(AB))) + mid;
        vec2 BC = C-B;
        // // we need the angle of the corner A:
        float sinA = length(C-mid)/length(C-A);
        float R = length(BC)/(2.0*sinA);

        vec2 center = (-R*offDir)+C;
  
        return vec3(center,R);
    }
    vec3 curveEdge(float p, vec3 circle, float y, Edge E){
        float R = circle.z;
        vec2 P = mix(E.start,E.end,p);
        float Er = max(0.025, mix(E.srcR,E.dstR,p));
        float dotScale = 500.0;
        // Er is the edge radius - map it to the calc we would use in the Dot renderer:
        vec2 dir = normalize(P.xy-circle.xy);
        float r = y*Er;
        return vec3(circle.xy + (R*dir)+(r*dir),Er);
    }
    
   
    vec4 mixColor(Edge E, float param){
        float p = (1.0+cos(param*3.14159))/2.0;
        return mix(E.srcColor,E.dstColor, p)*0.7;
    }

    void main(){
        Edge E = getAnimatedEdge();
        vec2 dir = normalize(E.end-E.start);
        vec2 pos = mix(E.start,E.end,uv.z);
        float W = mix(E.srcR,E.dstR,uv.z);

        vec3 circle = makeUpCircle(E.start,E.end);
        float C = clamp(uv.z, 0.0,1.0);
        vec3 P = curveEdge(uv.z, circle,uv.y,E);
        pos.xy = curveEdge(C, circle,0.0,E).xy;
        // now apply the camera like usual!
        vec2 size = view.zw-view.xy;
        vec2 unit = (P.xy-view.xy)/size;
        vec2 clip = (unit*2.0)-1.0;

        

        edgePos = P;
        linePos = vec3(pos.xy,C);
        // make the lines "hang" so they overlap in a nicer way:
        float Z = abs(uv.z-0.5);
        
        // however, if focus is within a few pixels S.xy, lift it up to highlight it
        float nearFocus = smoothstep(1.0, 0.0, min(length(focus-E.start), length(focus-E.end)));
        
        Z=1.0-(Z*Z);
        Z *= mix(1.0, -0.5, nearFocus);
        Z -= mix(0.0,0.1, nearFocus);

        clr = mixColor(E, uv.z);
        clr.rgb = mix(vec3(0.6),clr.rgb,nearFocus);
        clr.a = 1.0-anmParam;
        // also ramp very slightly on the edges...
        clr.a *= mix(1.0,0.8, uv.y*uv.y);

        gl_Position = vec4(clip.xy,Z,1.0);
    }

`

const frag = `precision highp float;
    uniform vec4 color;
    uniform vec4 view;

    varying vec3 edgePos;
    varying vec3 linePos;
    varying vec4 clr;

    void main(){
        // compute a reasonable guess at the size of a pixel in data space
        float dpx = abs(view.z-view.x)/2000.0; // pretending the screen is 2000 px wide - good enough
        // start simple!
        float p = linePos.z;
        p = abs(p-0.5)*2.0;

        float R = edgePos.z;
       
        if(length(edgePos.xy-linePos.xy) > R){
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
    start: REGL.Buffer | REGL.DynamicVariable<REGL.Buffer>;
    end: REGL.Buffer;
    pStart: REGL.Buffer;
    pEnd: REGL.Buffer;
    anmParam: number;
    taxonomySize: vec2;
    taxonomyPositions: REGL.Texture2D;
    focus: vec2;
    taxonLayer: number;
}
type Unis = {
    color: vec4,
    view: vec4;
    anmParam: number;
    taxonLayer: number;
    taxonomySize: vec2;
    focus: vec2;
    taxonomyPositions: REGL.Texture2D;
}
type Attrs = {
    uv: REGL.Attribute,
    start: REGL.Attribute,
    end: REGL.Attribute,
    pStart: REGL.Attribute,
    pEnd: REGL.Attribute,
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
export function buildEdgeRenderer(regl: REGL.Regl) {
    const verts = buildStrip(30);
    const cmd = regl<Unis, Attrs, Props>({
        vert,
        frag,
        count: verts.length / 3,
        attributes: {
            uv: verts,
            start: {
                // the errors here are (I believe) a gap in the TS typings for REGL. 
                // we're making a dynamic prop, which works fine and is clearly correct practice given regl's own examples
                // however the type says that only 'REGL.Buffer' is safe
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
            taxonLayer: regl.prop<Props, 'taxonLayer'>('taxonLayer'),
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