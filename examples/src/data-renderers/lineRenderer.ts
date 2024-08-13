import type { box2D, vec2, vec4 } from '@alleninstitute/vis-geometry';
import REGL, { type AttributeConfig } from 'regl';
import type { ColumnData } from '~/common/loaders/scatterplot/scatterbrain-loader';

type Attrs = { pos: REGL.AttributeConfig };
type Unis = { view: vec4; color: vec4 };
type Props = {
    target: REGL.Framebuffer2D | null;
    view: vec4;
    color: vec4;
    pos: REGL.AttributeConfig | REGL.BufferData;
    count: number;
};
const frag = `
precision highp float;

uniform vec4 color;
void main(){
    gl_FragColor = color;
}`;
const vert = `
precision highp float;
attribute vec2 pos;
uniform vec4 view;

void main(){
    vec2 size = view.zw-view.xy;
    vec2 unit = (pos-view.xy)/size;
    vec2 clip = 2.0*(unit-0.5);
    gl_Position = vec4(clip.x,clip.y,0,1);
}`;
export function buildLineRenderer(regl: REGL.Regl) {
    const cmd = regl<Unis, Attrs, Props>({
        frag,
        vert,
        uniforms: {
            view: regl.prop<Props, 'view'>('view'),
            color: regl.prop<Props, 'color'>('color'),
        },
        attributes: {
            pos: regl.prop<Props, 'pos'>('pos'),
        },
        blend: {
            enable: false,
        },
        depth: {
            enable: false,
        },
        count: regl.prop<Props, 'count'>('count'),
        primitive: 'line strip',
        framebuffer: regl.prop<Props, 'target'>('target'),
    });
    return (points: Float32Array, color: vec4, view: box2D, target: REGL.Framebuffer2D | null) => {
        const { minCorner, maxCorner } = view;
        cmd({
            target,
            color,
            view: [...minCorner, ...maxCorner],
            pos: points,
            count: points.length / 2,
        });
    };
}
export type Path = {
    id: number;
    color: vec4;
    bounds: box2D;
    points: Array<vec2>;
};
export function buildPathRenderer(regl: REGL.Regl) {
    const cmd = buildLineRenderer(regl);

    return (
        item: Path,
        settings: { view: box2D; target: REGL.Framebuffer2D | null },
        tasks: Record<string, ColumnData | object | undefined>
    ) => {
        const pos = tasks['position'];
        const { view, target } = settings;
        if (pos && 'type' in pos && pos.type === 'float') {
            cmd(pos.data, item.color, view, target);
        }
    };
}
