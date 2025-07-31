
// accumulate the avg expression over rows/cols of a heatmap

import { Box2D, type box2D, type mat4, type vec2, type vec4 } from "@alleninstitute/vis-geometry";
import type { Framebuffer2D } from "regl";
import type REGL from "regl";
import type { ColumnarNode } from "../common/loaders/scatterplot/scatterbrain-loader";
import type { VBO } from "./vbo";



type Props = {
    count: number;
    measurement: REGL.Buffer;
    rowType: REGL.AttributeConfig;
    mapSize: vec2;
    column: number;
    target: Framebuffer2D;
};
export type RenderSettings = {
    mapSize: vec2;
    target: REGL.Framebuffer2D | null;
};
export function buildAvgAccumulator(regl: REGL.Regl) {
    // build the regl command first
    const cmd = regl<
        { mapSize: vec2, column: number },
        { measurement: REGL.Buffer, rowType: REGL.Buffer },
        Props
    >({
        vert: /*glsl*/`
    precision highp float;
    attribute float measurement;
    attribute float rowType;

    uniform vec2 mapSize;
    uniform float column;

    varying vec4 clr;
    void main(){
        gl_PointSize=0.5;
        vec2 pos = (vec2(column,rowType)+vec2(0.5,0.5))/mapSize;
        // pos is in uv texture space

        vec2 clip = (pos*2.0)-1.0;
        clr = vec4(measurement,1,0,0);
        // TODO - offset 1/2 pixel?
        gl_Position = vec4(clip,0.0,1.0);
    }`,
        frag: /*glsl*/`
        precision highp float;
        varying vec4 clr;
        void main(){
        gl_FragColor = clr;
    }`,
        attributes: {
            measurement: regl.prop<Props, 'measurement'>('measurement'),
            rowType: regl.prop<Props, 'rowType'>('rowType'),
        },
        uniforms: {
            column: regl.prop<Props, 'column'>('column'),
            mapSize: regl.prop<Props, 'mapSize'>('mapSize'),
        },
        depth: {
            enable: false,
        },
        blend: {
            enable: true,
            func: {
                dst: 'one',
                src: 'one',
            }
        },
        framebuffer: regl.prop<Props, 'target'>('target'),
        count: regl.prop<Props, 'count'>('count'),
        primitive: 'points',
    });

    const renderDots = (
        item: ColumnarNode<vec2> & { columnIndex: number },
        settings: RenderSettings,
        columns: { color: VBO, position: VBO, rowType: VBO },
    ) => {
        const { rowType, color } = columns;
        const { count, columnIndex } = item;
        const { mapSize } = settings;
        cmd({
            count,
            rowType: {
                buffer: rowType.vbo,
                normalized: false,
                type: 'uint16',
            },
            mapSize,
            measurement: color.vbo,
            column: columnIndex,
            target: settings.target,
        });

    };
    return renderDots;
}