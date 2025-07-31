
// we want a little outline of the "features" used to generate the rows in this dataset 
// for viewer context

import { Box2D, Mat4, type box2D, type mat4, type vec2, type vec4 } from "@alleninstitute/vis-geometry";
import type { Framebuffer2D } from "regl";
import type REGL from "regl";
import type { ColumnarNode } from "../common/loaders/scatterplot/scatterbrain-loader";
import type { VBO } from "./vbo";



type Props = {
    count: number;
    position: REGL.Buffer;
    rowType: REGL.AttributeConfig;
    zOffset: number;
    rotation: number[];
    bounds: box2D;
    target: Framebuffer2D | null;
};
export type RenderSettings = {
    rotation: number[];
    bounds: box2D;
    size: vec2;
    lineColor: vec4;
    target: REGL.Framebuffer2D | null;
};

function buildRowDotRenderer(regl: REGL.Regl) {
    // build the regl command first
    const cmd = regl<
        { zOffset: number, bounds: vec4, rotation: number[] },
        { position: REGL.Buffer, rowType: REGL.Buffer },
        Props
    >({
        vert: /*glsl*/`
    precision highp float;
    attribute float rowType;
    attribute vec2 position;

    uniform mat4 rotation;
    uniform vec4 bounds;
    uniform float zOffset;

    varying vec4 clr;
    void main(){
        gl_PointSize=3.0;
        vec2 size = bounds.zw-bounds.xy;
        float z = (zOffset-30.0)/10.0;
        vec4 p = rotation*vec4(position,z,0.0)*vec4(1,1,1,1);
        vec2 pos = (p.xy-bounds.xy)/size;
        vec2 clip = (pos*2.0)-1.0;
        clr = vec4(rowType,0,0,0);
        gl_Position = vec4(clip,0.0,1.0);
    }`,
        frag: /*glsl*/`
        precision highp float;
        varying vec4 clr;
        void main(){
        gl_FragColor =clr;
    }`,
        attributes: {
            position: regl.prop<Props, 'position'>('position'),
            rowType: regl.prop<Props, 'rowType'>('rowType'),
        },
        uniforms: {
            bounds: regl.prop<Props, 'bounds'>('bounds'),
            zOffset: regl.prop<Props, 'zOffset'>('zOffset'),
            rotation: regl.prop<Props, 'rotation'>('rotation'),
        },
        depth: {
            enable: true,
        },
        blend: {
            enable: false,
        },
        framebuffer: regl.prop<Props, 'target'>('target'),
        count: regl.prop<Props, 'count'>('count'),
        primitive: 'points',
    });

    const renderDots = (
        item: ColumnarNode<vec2> & { zOffset: number },
        settings: RenderSettings,
        columns: { position: VBO, row: VBO },
    ) => {
        const { row, position } = columns;
        const { count, zOffset } = item;
        const { target, rotation, bounds } = settings;
        cmd({
            count,
            rowType: {
                buffer: row.vbo,
                normalized: false,
                type: 'uint16',
            },
            bounds: Box2D.toFlatArray(bounds),
            position: position.vbo,
            rotation,
            zOffset,
            target,
        });

    };
    return renderDots;
}

// ok, now a simple edge-detection filter, presuming an image rendered as above
function buildEdgeDetection(regl: REGL.Regl) {
    const cmd = regl({
        vert: /*glsl*/`
            precision highp float;
            attribute vec2 position;
            varying vec2 uv;
            void main(){
                uv = (position/2.0)+0.5; 
                gl_Position = vec4(position.xy,0,1.0);
            }
            `,
        frag: /*glsl*/`
            precision highp float;
        uniform sampler2D expr;
        uniform vec2 size;
        uniform vec4 color;
        varying vec2 uv;
    
        void main(){
            vec2 step = vec2(1,1)/size;
            // this is a pretty popular convolution kernel:
            float v = texture2D(expr,uv).r*8.0;
            for(int i = -1;i<=1;i++){
                for(int j = -1;j<=1;j++){
                    vec2 tx = vec2(i,j)*step;
                    v += texture2D(expr,uv+tx).r*-1.0;
                }
            }
            float alpha = color.a*clamp(v/9.0,0.0,1.0);
            gl_FragColor = vec4(color.rgb*alpha,alpha);
        }`,
        count: 4,
        primitive: 'triangle fan',
        attributes: { position: [-1, -1, 1, -1, 1, 1, -1, 1] },
        uniforms: {
            size: regl.prop('size'),
            expr: regl.prop('expr'),
            color: regl.prop('color'),
        },
        blend: {
            enable: false
        }, depth: {
            enable: false
        },
        framebuffer: regl.prop('target')
    });
    return (props: {
        color: vec4,
        texture: REGL.Framebuffer2D | REGL.Texture2D,
        size: vec2,
        target: REGL.Framebuffer2D | null;
    }) => {
        const { target, color, texture, size } = props
        cmd({
            color,
            target,
            size,
            expr: texture
        })
    }
}

function buildBackdropDisplay(regl: REGL.Regl) {
    const cmd = regl({
        vert: /*glsl*/`
            precision highp float;
            attribute vec2 position;
            uniform vec4 view;
            varying vec2 uv;
            void main(){
                vec2 unit = (position/2.0)+0.5; 
                vec2 size = view.zw-view.xy;
                vec2 dataPos = view.xy + (unit*size);
                uv = dataPos;
                gl_Position = vec4(position.xy,0,1.0);
            }
            `,
        frag: /*glsl*/`
            precision highp float;
        uniform sampler2D tex;
        uniform vec4 dataBound;
        uniform vec4 view;
        uniform vec2 mapSize;
        varying vec2 uv;
    
        void main(){
            // uv is the position of the pixel in data-space
            // convert it into a tile by making it a param of data-bound
            vec2 size = dataBound.zw-dataBound.xy;
            vec2 vSize = view.zw-view.xy;
            vec2 p = (uv-dataBound.xy)/size;
            float a = mix(1.0,0.0,(vSize.x/size.x)/30.0);
            vec2 tx = fract(p);
            vec2 rc = floor(p);
            if(rc.x<0.||rc.y<0.0||rc.x>=mapSize.x||rc.y>=mapSize.y){
                discard;
            }
            
            vec4 clr = texture2D(tex,tx);
            gl_FragColor = clr*a;
            

        }`,
        count: 4,
        primitive: 'triangle fan',
        attributes: { position: [-1, -1, 1, -1, 1, 1, -1, 1] },
        uniforms: {
            dataBound: regl.prop('dataBound'),
            mapSize: regl.prop('mapSize'),
            tex: regl.prop('tex'),
            view: regl.prop('view'),
        },
        blend: {
            enable: true
        }, depth: {
            enable: false
        },
        framebuffer: regl.prop('target')
    });
    return (props: {
        texture: REGL.Framebuffer2D | REGL.Texture2D,
        dataBound: box2D,
        view: box2D,
        mapSize: vec2,
        target: REGL.Framebuffer2D | null;
    }) => {
        const { target, texture, dataBound, view, mapSize } = props
        cmd({
            target,
            mapSize,
            dataBound: Box2D.toFlatArray(dataBound),
            view: Box2D.toFlatArray(view),
            tex: texture
        })
    }
}

export function buildOutliner(regl: REGL.Regl) {

    const dots = buildRowDotRenderer(regl);
    const edges = buildEdgeDetection(regl);
    const display = buildBackdropDisplay(regl);

    return { dots, edges, display }
}