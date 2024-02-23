import REGL from 'regl';
import type { ColumnData, ColumnarTree } from './scatterbrain-loader';
import type { RenderSettings } from './data';
import { Box2D, type box2D, type vec2, type vec4 } from '@alleninstitute/vis-geometry';

type Props = {
  view: vec4;
  itemDepth: number;
  count: number;
  position: Float32Array;
  pointSize: number;
  color: Float32Array;
};
export function buildRenderer(regl: REGL.Regl) {
  // build the regl command first
  const cmd = regl<
    { view: vec4; itemDepth: number; pointSize: number },
    { position: Float32Array; color: Float32Array },
    Props
  >({
    vert: `
    precision highp float;
    attribute vec2 position;
    attribute float color;

    uniform vec4 view;
    uniform float itemDepth;
    uniform float pointSize;
    varying vec4 clr;

    void main(){
        gl_PointSize=pointSize;
        vec2 size = view.zw-view.xy;
        vec2 pos = (position-view.xy)/size;
        vec2 clip = (pos*2.0)-1.0;

        // todo: gradients are cool
        clr = vec4(mix(vec3(0.3,0,0),vec3(1,1,0.9),color/30.0),1.0);
        
        gl_Position = vec4(clip,0.5-color/30.0,1);
    }`,
    frag: `
        precision highp float;
    varying vec4 clr;
    void main(){
        vec2 circleCoord = (2.0 * gl_PointCoord.xy)-1.0;
        if(dot(circleCoord,circleCoord)>1.0){
            discard; // magic GLSL keyword that prevents a pixel from having any output - one of the very few good reasons to use an if() statement in a shader.
        }
        gl_FragColor = clr;
    }`,
    blend: {
      enable: true,
      func: {
        dstRGB: 'one minus src alpha',
        srcRGB: 'src alpha',
        dstAlpha: 'zero',
        srcAlpha: 'one',
      },
      equation: {
        alpha: 'add',
        rgb: 'add',
      },
    },
    attributes: {
      color: regl.prop<Props, 'color'>('color'),
      position: regl.prop<Props, 'position'>('position'),
    },
    uniforms: {
      itemDepth: regl.prop<Props, 'itemDepth'>('itemDepth'),
      view: regl.prop<Props, 'view'>('view'),
      pointSize: regl.prop<Props, 'pointSize'>('pointSize'),
    },
    count: regl.prop<Props, 'count'>('count'),
    primitive: 'points',
  });
  const renderDots = (
    item: ColumnarTree<vec2>,
    settings: RenderSettings,
    columns: Record<string, ColumnData | undefined>
  ) => {
    const { color, position } = columns;
    const count = item.content.count;
    const itemDepth = item.content.depth;
    if (color && position && color.type === 'float' && position.type === 'float') {
      cmd({
        view: Box2D.toFlatArray(settings.view),
        count,
        itemDepth,
        position: position.data,
        color: position.data,
        pointSize: Math.max(0.5, settings.pointSize),
      });
    } else {
      // todo freak out!
      throw new Error('omg the internet lied to me');
    }
  };
  return renderDots;
}
