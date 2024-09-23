import REGL, { type Framebuffer2D } from 'regl';

type Props = {
    target: Framebuffer2D | null;
    img: REGL.Texture2D | REGL.Framebuffer2D;
};
export function buildImageCopy(regl: REGL.Regl) {
    const cmd = regl<
        { img: REGL.Texture2D | REGL.Framebuffer2D },
        { pos: REGL.BufferData, tx: REGL.BufferData },
        Props
    >({
        vert: ` precision highp float;
            attribute vec2 pos;
            attribute vec2 tx;
          
            varying vec2 texCoord;
  
          void main(){
              texCoord = tx;
              gl_Position = vec4(pos.x,pos.y,0.0,1.0);
          }`,
        frag: `
      precision highp float;
      
      uniform sampler2D img;
      varying vec2 texCoord;

      void main(){
              gl_FragColor =texture2D(img, texCoord);
          }`,
        framebuffer: regl.prop<Props, 'target'>('target'),
        attributes: {
            pos: [-1, -1, 1, -1, 1, 1, -1, 1],
            tx: [0, 0, 1, 0, 1, 1, 0, 1]
        },
        depth: {
            enable: false,
        },
        uniforms: {
            img: regl.prop<Props, 'img'>('img'),
        },
        blend: {
            enable: false,
        },
        count: 4,
        primitive: 'triangle fan',
    });
    return cmd;
}
