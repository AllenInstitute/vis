import { Box2D, type vec2, type vec4 } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';
import type { Framebuffer2D } from 'regl';
import type { RenderSettings } from '../common/loaders/scatterplot/data';
import type { ColumnBuffer, ColumnarTree } from '../common/loaders/scatterplot/scatterbrain-loader';

type Props = {
    view: vec4;
    itemDepth: number;
    count: number;
    pointSize: number;
    position: REGL.Buffer;
    color: REGL.Buffer;
    offset?: vec2 | undefined;
    target: Framebuffer2D | null;
};
export function buildRenderer(regl: REGL.Regl) {
    // build the regl command first
    const cmd = regl<
        { view: vec4; itemDepth: number; offset: vec2; pointSize: number },
        { position: REGL.Buffer; color: REGL.Buffer },
        Props
    >({
        vert: `
    precision highp float;
    attribute vec2 position;
    attribute float color;
    
    uniform float pointSize;
    uniform vec4 view;
    uniform float itemDepth;
    uniform vec2 offset;

    varying vec4 clr;
    
    void main(){
        gl_PointSize=pointSize;
        vec2 size = view.zw-view.xy;
        vec2 pos = ((position+offset)-view.xy)/size;
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
            itemDepth: regl.prop<Props, 'itemDepth'>('itemDepth'),
            view: regl.prop<Props, 'view'>('view'),
            offset: regl.prop<Props, 'offset'>('offset'),
            pointSize: regl.prop<Props, 'pointSize'>('pointSize'),
        },

        blend: {
            enable: false,
        },
        framebuffer: regl.prop<Props, 'target'>('target'),
        count: regl.prop<Props, 'count'>('count'),
        primitive: 'points',
    });
    const renderDots = (
        item: ColumnarTree<vec2> & { offset?: vec2 | undefined },
        settings: RenderSettings,
        columns: Record<string, ColumnBuffer | object | undefined>,
    ) => {
        const { color, position } = columns;
        const count = item.content.count;
        const itemDepth = item.content.depth;
        if (
            color &&
            position &&
            'type' in color &&
            'type' in position &&
            color.type === 'vbo' &&
            position.type === 'vbo'
        ) {
            cmd({
                view: Box2D.toFlatArray(settings.view),
                count,
                itemDepth,
                position: position.data,
                pointSize: settings.pointSize,
                color: color.data,
                offset: item.offset ?? [0, 0],
                target: settings.target,
            });
        } else {
            // todo freak out!
            throw new Error('omg the internet lied to me');
        }
    };
    return renderDots;
}
