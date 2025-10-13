// render a slice of an ome-zarr file as a 2D image
// note that the ome-zarr data must have exactly 3 channels
// the channels may be mapped to color-channels (RGB) with a basic 2-post gamut control

import type { vec2, vec3, vec4 } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';
import type { Framebuffer2D } from 'regl';

const vert = /*glsl*/ `
precision highp float;
attribute vec2 pos;
    
uniform vec4 view;
uniform vec4 tile;
uniform float depth;
varying vec2 texCoord;
uniform float rot;

void main(){
    vec2 tileSize = tile.zw-tile.xy;
    texCoord = pos;
    vec2 obj = (pos.xy*tileSize+tile.xy);

    vec2 p = (obj-view.xy)/(view.zw-view.xy);
    // now, to clip space
    p = (p*2.0)-1.0;
    gl_Position = vec4(p.x,p.y,depth,1.0);
}
`;
type CommonRenderProps = {
    target: Framebuffer2D | null;
    depth: number; // the Z value at which to render the tile, from 0 (the front) to 1 (the back)
    tile: vec4; // [minx,miny,maxx,maxy] representing the bounding box of the tile we're rendering
    view: vec4; // [minx,miny,maxx,maxy] representing the camera in the same space as the tile's bounding box
};

type RGBTileRenderProps = CommonRenderProps & {
    Rgamut: vec2; // [min,max] RedOut = RedChannelValue-Rgamut.min/(Rgamut.max-Rgamut.min)
    Ggamut: vec2; // [min,max] GreenOut = GreenChannelValue-Ggamut.min/(Ggamut.max-Ggamut.min)
    Bgamut: vec2; // [min,max] BlueOut = BlueChannelValue-Bgamut.min/(Bgamut.max-Bgamut.min)
    R: REGL.Texture2D;
    G: REGL.Texture2D;
    B: REGL.Texture2D;
};

type Channel = {
    tex: REGL.Texture2D;
    gamut: vec2;
    rgb: vec3;
};

type TileRenderProps = CommonRenderProps & {
    channels: Channel[];
};

/**
 * A simplified Tile Render Command that specifically handles RGB channels.
 * @param regl an active REGL context
 * @returns a function (regl command) which renders 3 individual channels as the RGB
 * components of an image. Each channel is mapped to the output RGB space via the given Gamut.
 * the rendering is done in the given target buffer (or null for the screen).
 */
export function buildRGBTileRenderCommand(regl: REGL.Regl) {
    const cmd = regl<
        {
            view: vec4;
            tile: vec4;
            depth: number;
            R: REGL.Texture2D;
            G: REGL.Texture2D;
            B: REGL.Texture2D;
            Rgamut: vec2;
            Ggamut: vec2;
            Bgamut: vec2;
        },
        { pos: REGL.BufferData },
        RGBTileRenderProps
    >({
        vert,
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
        framebuffer: regl.prop<RGBTileRenderProps, 'target'>('target'),
        attributes: {
            pos: [0, 0, 1, 0, 1, 1, 0, 1],
        },
        uniforms: {
            tile: regl.prop<RGBTileRenderProps, 'tile'>('tile'),
            view: regl.prop<RGBTileRenderProps, 'view'>('view'),
            depth: regl.prop<RGBTileRenderProps, 'depth'>('depth'),
            R: regl.prop<RGBTileRenderProps, 'R'>('R'),
            G: regl.prop<RGBTileRenderProps, 'G'>('G'),
            B: regl.prop<RGBTileRenderProps, 'B'>('B'),
            Rgamut: regl.prop<RGBTileRenderProps, 'Rgamut'>('Rgamut'),
            Ggamut: regl.prop<RGBTileRenderProps, 'Ggamut'>('Ggamut'),
            Bgamut: regl.prop<RGBTileRenderProps, 'Bgamut'>('Bgamut'),
        },
        depth: {
            enable: true,
        },
        count: 4,
        primitive: 'triangle fan',
    });

    return (p: RGBTileRenderProps) => cmd(p);
}

// biome-ignore lint/suspicious/noExplicitAny: type of uniforms cannot be given explicitly due to dynamic nature of uniforms in these shaders
type ReglUniforms = REGL.MaybeDynamicUniforms<any, REGL.DefaultContext, TileRenderProps>;

/**
 *
 * @param regl an active REGL context
 * @param numChannels the number of channels this renderer will support
 * @returns a function (regl command) which renders a set of individual channels (of any colorspace(s))
 * into a single RGB image. Each channel is mapped to the output RGB space via the given Gamut.
 * The rendering is done in the given target buffer (or null for the screen).
 */
export function buildTileRenderCommand(regl: REGL.Regl, numChannels: number) {
    const reglChannelUniforms: ReglUniforms[] = [];
    const fragmentChannelUniformDefs = [];
    const colorMerges = [];
    for (let i = 0; i < numChannels; i++) {
        reglChannelUniforms.push({
            [`gamut${i}`]: (_context: unknown, props: TileRenderProps) => props.channels[i].gamut,
            [`color${i}`]: (_context: unknown, props: TileRenderProps) => props.channels[i].rgb,
            [`tex${i}`]: (_context: unknown, props: TileRenderProps) => props.channels[i].tex,
        });
        fragmentChannelUniformDefs.push(`uniform vec2 gamut${i};`);
        fragmentChannelUniformDefs.push(`uniform vec3 color${i};`);
        fragmentChannelUniformDefs.push(`uniform sampler2D tex${i};`);
        colorMerges.push(`
            float ch${i}Val = texture2D(tex${i}, texCoord).r;
            ch${i}Val = (ch${i}Val - gamut${i}.x) / (gamut${i}.y - gamut${i}.x);
            color += (color${i} * ch${i}Val);
        `);
    }
    const staticReglUniforms: ReglUniforms = {
        tile: regl.prop<TileRenderProps, 'tile'>('tile'),
        view: regl.prop<TileRenderProps, 'view'>('view'),
        depth: regl.prop<TileRenderProps, 'depth'>('depth'),
    };
    const uniforms = reglChannelUniforms.reduce((acc: ReglUniforms, curr: ReglUniforms) => {
        for (const key in curr) {
            acc[key] = curr[key];
        }
        return acc;
    }, staticReglUniforms);

    const frag = `
        precision highp float;
        ${fragmentChannelUniformDefs.join('\n')}
        varying vec2 texCoord;

        void main() {
            vec3 color = vec3(0.0, 0.0, 0.0);
            ${colorMerges.join('\n')}
            color = clamp(color, 0.0, 1.0);
            gl_FragColor = vec4(color, 1.0);
        }`;

    // biome-ignore lint/suspicious/noExplicitAny: type of uniforms cannot be given explicitly due to dynamic nature of uniforms in these shaders
    const cmd = regl<any, { pos: REGL.BufferData }, TileRenderProps>({
        vert,
        frag,
        framebuffer: regl.prop<TileRenderProps, 'target'>('target'),
        attributes: {
            pos: [0, 0, 1, 0, 1, 1, 0, 1],
        },
        uniforms,
        depth: {
            enable: true,
        },
        count: 4,
        primitive: 'triangle fan',
    });

    return (p: TileRenderProps) => cmd(p);
}
