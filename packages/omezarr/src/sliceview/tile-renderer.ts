// render a slice of an ome-zarr file as a 2D image
// note that the ome-zarr data must have exactly 3 channels
// the channels may be mapped to color-channels (RGB) with a basic 2-post gamut control

import type { vec2, vec3, vec4 } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';
import type { Framebuffer2D } from 'regl';

// biome-ignore lint/complexity/noBannedTypes: Intentionally open-ended function that operates on all valid objects
export const keysOf = <T extends Object>(obj: T) => Object.getOwnPropertyNames(obj);

type Props = {
    target: Framebuffer2D | null;
    tile: vec4; // [minx,miny,maxx,maxy] representing the bounding box of the tile we're rendering
    view: vec4; // [minx,miny,maxx,maxy] representing the camera in the same space as the tile's bounding box
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
    color: vec3;
};

type GenericProps = {
    target: Framebuffer2D | null;
    tile: vec4; // [minx,miny,maxx,maxy] representing the bounding box of the tile we're rendering
    view: vec4; // [minx,miny,maxx,maxy] representing the camera in the same space as the tile's bounding box
    channels: Channel[];
};

/**
 *
 * @param regl an active REGL context
 * @returns a function (regl command) which renders 3 individual channels as the RGB
 * components of an image. Each channel is mapped to the output RGB space via the given Gamut.
 * the rendering is done in the given target buffer (or null for the screen).
 */
export function buildRGBTileRenderer(regl: REGL.Regl) {
    const cmd = regl<
        {
            view: vec4;
            tile: vec4;
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

            void main(){
                vec2 tileSize = tile.zw-tile.xy;
                texCoord = pos;
                vec2 obj = (pos.xy*tileSize+tile.xy);

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

    return (p: Props) => cmd(p);
}

// biome-ignore lint/suspicious/noExplicitAny: type of uniforms cannot be given explicitly due to dynamic nature of uniforms in these shaders
type ReglUniforms = REGL.MaybeDynamicUniforms<any, REGL.DefaultContext, GenericProps>;

/**
 *
 * @param regl an active REGL context
 * @param numChannels the number of channels this renderer will support
 * @returns a function (regl command) which renders a set of individual channels (of any colorspace(s))
 * into a single RGB image. Each channel is mapped to the output RGB space via the given Gamut.
 * The rendering is done in the given target buffer (or null for the screen).
 */
export function buildTileRenderer(regl: REGL.Regl, numChannels: number) {
    const reglChannelUniforms: ReglUniforms[] = [];
    const fragmentChannelUniformDefs = [];
    const colorMerges = [];
    for (let i = 0; i < numChannels; i++) {
        reglChannelUniforms.push({
            [`gamut${i}`]: (context: unknown, props: GenericProps) => props.channels[i].gamut,
            [`color${i}`]: (context: unknown, props: GenericProps) => props.channels[i].color,
            [`tex${i}`]: (context: unknown, props: GenericProps) => props.channels[i].tex,
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
        tile: regl.prop<GenericProps, 'tile'>('tile'),
        view: regl.prop<GenericProps, 'view'>('view'),
    };
    const uniforms = reglChannelUniforms.reduce((acc: ReglUniforms, curr: ReglUniforms) => {
        for (const key of keysOf(curr)) {
            acc[key] = curr[key];
        }
        return acc;
    }, staticReglUniforms);

    const vert = `
        precision highp float;
        attribute vec2 pos;
        
        uniform vec4 view;
        uniform vec4 tile;
        varying vec2 texCoord;
        uniform float rot;

        void main() {
            vec2 tileSize = tile.zw-tile.xy;
            texCoord = pos;
            vec2 obj = (pos.xy*tileSize+tile.xy);

            vec2 p = (obj-view.xy)/(view.zw-view.xy);
            // now, to clip space
            p = (p*2.0)-1.0;
            gl_Position = vec4(p.x,p.y,0.0,1.0);
        }`;

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
    const cmd = regl<any, { pos: REGL.BufferData }, GenericProps>({
        vert,
        frag,
        framebuffer: regl.prop<GenericProps, 'target'>('target'),
        attributes: {
            pos: [0, 0, 1, 0, 1, 1, 0, 1],
        },
        uniforms,
        depth: {
            enable: false,
        },
        count: 4,
        primitive: 'triangle fan',
    });

    return (p: GenericProps) => cmd(p);
}
