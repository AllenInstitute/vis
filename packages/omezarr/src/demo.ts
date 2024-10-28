import REGL from 'regl'
import { buildOmeZarrSliceRenderer } from './sliceview/slice-renderer';
import { defaultDecoder } from './sliceview/loader';
import { AsyncDataCache, type ReglCacheEntry, buildAsyncRenderer } from '@alleninstitute/vis-scatterbrain';
import { load } from './zarr-data';
import { Box2D, type vec2 } from '@alleninstitute/vis-geometry';

// this is the most barebones "does it work" demo I can think of.
// do not follow any patterns in this demo - I took as many shortcuts as possible to be able to just call
// the async omezarr renderer once with some static data. see the other renderers (with real cameras, handlers, caches, etc)
// for examples of how to maybe integrate this into a real app - this is just proof of life.

function startDemo() {
    console.warn('start demo!')
    const cnvs = document.getElementById('main') as HTMLCanvasElement | null
    if (cnvs) {
        const gl = cnvs.getContext('webgl', {
            alpha: true,
            preserveDrawingBuffer: true,
            antialias: true,
            premultipliedAlpha: true,
        });
        if (!gl) {
            throw new Error('WebGL not supported!');
        }
        const regl = REGL({
            gl,
            extensions: ['ANGLE_instanced_arrays', 'OES_texture_float', 'WEBGL_color_buffer_float'],
        });
        loadAndRenderOnce(regl, [cnvs.clientWidth, cnvs.clientHeight]);

    }
}
const demo_versa = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/'
async function loadAndRenderOnce(regl: REGL.Regl, screenSize: vec2) {
    // this is a demo, so I didnt bother to prevent memory leaks or anything good at all! 
    const cache = new AsyncDataCache<string, string, ReglCacheEntry>(() => { }, () => 1, 3000)
    const metadata = await load(demo_versa)
    const renderer = buildAsyncRenderer(await buildOmeZarrSliceRenderer(regl, defaultDecoder))
    // just draw a static dataset with the renderer
    renderer(metadata, {
        camera: {
            screenSize,
            view: Box2D.create([0, 0], [250, 120]),
        },
        gamut: {
            R: { gamut: { min: 0, max: 80 }, index: 0 },
            G: { gamut: { min: 0, max: 100 }, index: 1 },
            B: { gamut: { min: 0, max: 100 }, index: 2 },
        },
        plane: 'xy',
        planeIndex: 0,
        tileSize: 256,
    },
        () => { }, null, cache
    )
}

startDemo();