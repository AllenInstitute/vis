import type { vec2, vec4 } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';
import type { Framebuffer2D } from 'regl';

type Props = {
    target: Framebuffer2D | null;
    box: vec4;
    view: vec4;
    depth?: number;
    //   viewport: REGL.BoundingBox;
    img: REGL.Texture2D | REGL.Framebuffer2D;
};
export function buildImageRenderer(regl: REGL.Regl, depthTest: boolean = false) {
    const cmd = regl<
        { depth: Number, view: vec4; box: vec4; img: REGL.Texture2D | REGL.Framebuffer2D },
        { pos: REGL.BufferData },
        Props
    >({
        vert: ` precision highp float;
      attribute vec2 pos;
          
          uniform vec4 view;
          uniform vec4 box;
          uniform float depth;
          varying vec2 texCoord;
  
          void main(){
             vec2 tileSize = box.zw-box.xy;
             texCoord = pos;
             vec2 obj = (pos.xy*tileSize+box.xy);
              vec2 p = (obj-view.xy)/(view.zw-view.xy);
              // now, to clip space
              p = (p*2.0)-1.0;
              gl_Position = vec4(p.x,p.y,depth,1.0);
          }`,
        frag: `
      precision highp float;
      
      uniform sampler2D img;
      // its more direct to do 3 separate channels...
      varying vec2 texCoord;
      void main(){
              
              gl_FragColor =texture2D(img, texCoord);
          }`,
        framebuffer: regl.prop<Props, 'target'>('target'),
        attributes: {
            pos: [0, 0, 1, 0, 1, 1, 0, 1],
        },
        depth: {
            enable: depthTest,
        },
        uniforms: {
            box: regl.prop<Props, 'box'>('box'),
            view: regl.prop<Props, 'view'>('view'),
            img: regl.prop<Props, 'img'>('img'),
            depth: regl.prop<Props, 'depth'>('depth'),
        },
        blend: {
            enable: true,
            func: {
                src: 'src alpha',
                dst: 'one minus src alpha',
            },
        },
        count: 4,
        primitive: 'triangle fan',
        // ... more!
    });
    return (p: Props) => cmd({ depth: 0, ...p });
}
