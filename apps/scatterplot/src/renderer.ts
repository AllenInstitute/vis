import REGL, { type Framebuffer2D } from "regl";
import type { ColumnData, ColumnarTree } from "Common/loaders/scatterplot/scatterbrain-loader";
import type { RenderSettings } from "Common/loaders/scatterplot/data";
import { Box2D, type box2D, type vec2, type vec4 } from "@alleninstitute/vis-geometry";

type Props = {
    view: vec4;
    itemDepth: number;
    count: number;
    position: Float32Array,
    color: Float32Array
    target: Framebuffer2D | null;
}
export function buildRenderer(regl: REGL.Regl) {
    // build the regl command first
    const cmd = regl<{ view: vec4, itemDepth: number }, { position: Float32Array, color: Float32Array }, Props>({
        vert: `
    precision highp float;
    attribute vec2 position;
    attribute float color;

    uniform vec4 view;
    uniform float itemDepth;
    varying vec4 clr;

    void main(){
        gl_PointSize=4.0;
        vec2 size = view.zw-view.xy;
        vec2 pos = (position-view.xy)/size;
        vec2 clip = (pos*2.0)-1.0;

        // todo: gradients are cool
        clr = vec4(mix(vec3(0.3,0,0),vec3(1,1,1),color/15.0),1.0);
        
        gl_Position = vec4(clip,0.5-color/20.0,1);
    }`,
        frag: `
        precision highp float;
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
            itemDepth: regl.prop<Props, "itemDepth">("itemDepth"),
            view: regl.prop<Props, "view">("view"),
        },

        blend: {
            enable: false,
        },
        framebuffer: regl.prop<Props, 'target'>('target'),
        count: regl.prop<Props, 'count'>('count'),
        primitive: "points",
    })
    const renderDots = (item: ColumnarTree<vec2>, settings: RenderSettings, columns: Record<string, ColumnData | object | undefined>) => {
        const { color, position } = columns;
        const count = item.content.count;
        const itemDepth = item.content.depth
        if (color && position && 'type' in color && 'type' in position && color.type === 'float' && position.type === 'float') {
            cmd({
                view: Box2D.toFlatArray(settings.view),
                count,
                itemDepth,
                position: position.data,
                color: color.data,
                target: settings.target
            })
        } else {
            // todo freak out!
            throw new Error('omg the internet lied to me')
        }

    }
    return renderDots;
}
