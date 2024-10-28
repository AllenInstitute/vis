
// render a slice of an ome-zarr file as a 2D image
// note that the ome-zarr data must have exactly 3 channels
// the channels may be remapped with a basic 2-post gamut control

import type { vec2, vec4 } from "@alleninstitute/vis-geometry";
import REGL, { Framebuffer2D } from "regl";

type Props = {
    target: Framebuffer2D | null;
    tile: vec4;
    view: vec4;
    rotation: number;
    Rgamut: vec2;
    Ggamut: vec2;
    Bgamut: vec2;
    R: REGL.Texture2D;
    G: REGL.Texture2D;
    B: REGL.Texture2D;
}

export function buildTileRenderer(regl: REGL.Regl) {

    const cmd = regl<
        {
            view: vec4;
            tile: vec4;
            rot: number;
            R: REGL.Texture2D;
            G: REGL.Texture2D;
            B: REGL.Texture2D;
            Rgamut: vec2;
            Ggamut: vec2;
            Bgamut: vec2;
        },
        { pos: REGL.BufferData },
        Props
    >({
        vert: ` precision highp float;
        attribute vec2 pos;
            
            uniform vec4 view;
            uniform vec4 tile;
            varying vec2 texCoord;
            uniform float rot;

            vec2 rotateObj(vec2 obj, float radians){
            return obj;
            }
            vec2 rotateTextureCoordinates(vec2 tx, float radians){
            vec2 xy = tx-vec2(0.5,0.5);
            mat2 R = mat2(
                vec2(cos(radians),-sin(radians)), 
                vec2(-sin(radians),cos(radians))
                );
            return ((R*xy)+vec2(0.5,0.5));
            }
            void main(){
            vec2 tileSize = tile.zw-tile.xy;
            texCoord = rotateTextureCoordinates(pos,rot);
            vec2 obj = rotateObj((pos.xy*tileSize+tile.xy),rot);

                vec2 p = (obj-view.xy)/(view.zw-view.xy);
                // now, to clip space
                p = (p*2.0)-1.0;
                gl_Position = vec4(p.x,p.y,0.0,1.0);
            }`,

        frag: `
    precision highp float;
    uniform sampler2D R;
    uniform sampler2D G;
    uniform sampler2D B; // for reasons which are pretty annoying
    // its more direct to do 3 separate channels...
    uniform vec2 Rgamut;
    uniform vec2 Ggamut;
    uniform vec2 Bgamut;
    
    varying vec2 texCoord;
    void main(){
            vec3 mins = vec3(Rgamut.x,Ggamut.x,Bgamut.x);
            vec3 maxs = vec3(Rgamut.y,Ggamut.y,Bgamut.y);
            vec3 span = maxs-mins;
            vec3 color = (vec3(
                texture2D(R, texCoord).r,
                texture2D(G, texCoord).r,
                texture2D(B, texCoord).r
            )-mins) /span;
           
            gl_FragColor = vec4(color, 1.0);
        }`,
        framebuffer: regl.prop<Props, 'target'>('target'),
        attributes: {
            pos: [0, 0, 1, 0, 1, 1, 0, 1],
        },
        uniforms: {
            rot: regl.prop<Props, 'rotation'>('rotation'),
            tile: regl.prop<Props, 'tile'>('tile'),
            view: regl.prop<Props, 'view'>('view'),
            R: regl.prop<Props, 'R'>('R'),
            G: regl.prop<Props, 'G'>('G'),
            B: regl.prop<Props, 'B'>('B'),
            Rgamut: regl.prop<Props, 'Rgamut'>('Rgamut'),
            Ggamut: regl.prop<Props, 'Ggamut'>('Ggamut'),
            Bgamut: regl.prop<Props, 'Bgamut'>('Bgamut'),
        },
        depth: {
            enable: false,
        },
        count: 4,
        primitive: 'triangle fan',
    });

    return (p: Props) => cmd(p)
}
