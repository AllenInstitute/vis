import { type box3D, Vec3, type box2D, type vec2, type vec3, type vec4 } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';
import type { Framebuffer2D } from 'regl';


// the dataset: some AnnotationInfo object
// the item: a single chunk of a layer of the spatial index
// the fetch is one single huge buffer
// the problem is we probably want only a few of the dimensions, props, etc...
// lets start and see how it falls out

const vert = `
precision highp float;
    attribute vec3 position;
    
    uniform float pointSize;
    uniform vec4 view;
    uniform vec2 zNearFar;
    varying float opacity;
    
    void main(){
        gl_PointSize=pointSize;
        float zRange = zNearFar.y - zNearFar.x;
        vec3 viewSize = vec3(view.zw-view.xy,zRange);
        // TODO: its unclear if values within a chunk are relative to their chunk

        vec3 pos = (position-vec3(view.xy,0.0))/viewSize;
        opacity=1.0;
        vec3 clip = (pos*2.0)-1.0;
        gl_Position = vec4(clip,1);
    }
`
const frag = `
precision highp float;

uniform vec3 color;
uniform vec3 outlineColor;
varying float opacity;

void main(){

    vec2 circleCoord = (2.0 * gl_PointCoord.xy)-1.0;
    if(dot(circleCoord,circleCoord)>1.0){
        discard; 
    }
    vec3 clr = mix(color,outlineColor, smoothstep(0.7,0.8, length(circleCoord)));
    gl_FragColor = vec4(clr, opacity);
}
`

type Settings = {
    camera: box2D,
    // NG precomputed annotations have arbitrary dimensionality - xyz maps any 3 dimensions [foo,bar,baz] to [x,y,z]
    xyz: readonly [string, string, string],
    color: vec3;
    outlineColor: vec3;
    size: number;


}
type InnerProps = {
    target: Framebuffer2D | null;
    zNearFar: vec2;
    color: vec3;
    pointSize: number;
    count: number;
    outlineColor: vec3;
    positions: REGL.Buffer
    view: vec4
}
type RenderProps = {
    target: Framebuffer2D | null;
    color: vec3;
    outlineColor: vec3;
    pointSize: number;
    positions: REGL.Buffer
    view: box3D
    count: number;
}
type Unis = {
    view: vec4,
    color: vec3,
    zNearFar: vec2;
    outlineColor: vec3,
    pointSize: number
}
type Attrs = {
    position: REGL.Buffer
}
export function buildPointRenderer(regl: REGL.Regl) {

    const cmd = regl<Unis, Attrs, InnerProps>({
        vert,
        frag,
        attributes: {
            position: regl.prop<InnerProps, 'positions'>('positions')
        },
        uniforms: {
            view: regl.prop<InnerProps, 'view'>('view'),
            pointSize: regl.prop<InnerProps, 'pointSize'>('pointSize'),
            color: regl.prop<InnerProps, 'color'>('color'),
            outlineColor: regl.prop<InnerProps, 'outlineColor'>('outlineColor'),
            zNearFar: regl.prop<InnerProps, 'zNearFar'>('zNearFar')

        },
        depth: {
            enable: true,
        },
        count: regl.prop<InnerProps, 'count'>('count'),
        framebuffer: regl.prop<InnerProps, 'target'>('target'),
        primitive: 'points'
    })

    return (props: RenderProps) => {
        const view: vec4 = [...Vec3.xy(props.view.minCorner), ...Vec3.xy(props.view.maxCorner)]
        cmd({
            ...props,
            view,
            zNearFar: [props.view.minCorner[2], props.view.maxCorner[2]],
        })
    }
}

