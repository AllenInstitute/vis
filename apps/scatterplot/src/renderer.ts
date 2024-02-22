import REGL from "regl";
import type { ColumnData, ColumnarTree } from "./scatterbrain-loader";
import type { RenderSettings } from "./data";
import { Box2D, type box2D, type vec2, type vec4 } from "@alleninstitute/vis-geometry";

type Props = {
    view: vec4;
    count: number;
    position: Float32Array,
    color: Float32Array
}
export function buildRenderer(regl: REGL.Regl) {
    // build the regl command first
    const cmd = regl<{ view: vec4 }, { position: Float32Array, color: Float32Array }, Props>({
        vert: `
    precision highp float;
    attribute vec2 position;
    attribute float color;

    uniform vec4 view;

    varying vec4 clr;

    void main(){
        gl_PointSize=4.0;
        vec2 size = view.zw-view.xy;
        vec2 pos = (position-view.xy)/size;
        vec2 clip = (pos*2.0)-1.0;

        // todo: gradients are cool
        clr = vec4(color,color,color,1.0);
        
        gl_Position = vec4(clip,0,1);
    }`,
        frag: `
    varying vec4 clr;
    void main(){
        // todo: round points with gl_FragCoord
        gl_FragColor = clr;
    }`,
        attributes: {
            color: regl.prop<Props, 'color'>('color'),
            position: regl.prop<Props, 'position'>('position'),
        },
        uniforms: {
            view: regl.prop<Props, "view">("view"),
        },
        depth: {
            enable: false,
        },
        count: regl.prop<Props, 'count'>('count'),
        primitive: "points",
    })
    const renderDots = (item: ColumnarTree<vec2>, settings: RenderSettings, columns: Record<string, ColumnData>) => {
        const { color, position } = columns;
        const count = item.content.count;
        if (color && position && color.type === 'float' && position.type === 'float') {
            cmd({
                view: Box2D.toFlatArray(settings.view),
                count,
                position: position.data,
                color: position.data
            })
        } else {
            // todo freak out!
            throw new Error('omg the internet lied to me')
        }

    }
    return renderDots;
}
