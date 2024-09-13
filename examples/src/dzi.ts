import REGL from "regl";
import type { Camera } from "./common/camera";
import { Box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { buildDziRenderer, type CacheContentType, type DziImage, type DziRenderSettings } from "@alleninstitute/vis-dzi";
import { AsyncDataCache, ReglLayer2D } from "@alleninstitute/vis-scatterbrain";
import { buildImageRenderer } from "./common/image-renderer";


const exampleDzi: DziImage = {
    imagesUrl: 'https://openseadragon.github.io/example-images/highsmith/highsmith_files/',
    // imagesUrl: 'https://openseadragon.github.io/example-images/duomo/duomo_files/',
    format: 'jpg',
    overlap: 2,
    size: {
        width: 7026,
        height: 9221,
    },
    tileSize: 256
}
const omg_cors: DziImage = {
    format: 'jpeg',
    imagesUrl: 'https://idk-etl-prod-download-bucket.s3.amazonaws.com/idf-23-10-pathology-images/pat_images_HPW332DMO29NC92JPWA/H20.33.029-A12-I6-primary/H20.33.029-A12-I6-primary_files/',
    overlap: 1,
    size: {
        width: 11596,
        height: 13446
    },
    tileSize: 512
}


function destroyer(item: CacheContentType) {
    switch (item.type) {
        case 'texture2D':
            item.data.destroy();
            break;
    }
}
function sizeOf(item: CacheContentType) {
    return 1;
}
export class Demo {
    camera: Camera;
    regl: REGL.Regl;
    dzi: DziImage;
    layer: ReglLayer2D<DziImage, DziRenderSettings>
    cache: AsyncDataCache<string, string, CacheContentType>;
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
        this.regl = regl;
        const screen: vec2 = [canvas.clientWidth, canvas.clientHeight]
        this.camera = {
            projection: 'webImage',
            screen,
            view: Box2D.create([0, 0], [1, 1])
        }
        this.cache = new AsyncDataCache(destroyer, sizeOf, 512);
        this.dzi = exampleDzi;
        const imgRenderer = buildImageRenderer(regl);
        const renderDzi = buildDziRenderer(regl);
        this.layer = new ReglLayer2D(regl, imgRenderer, renderDzi, screen);
        window.setInterval(() => {
            const img = this.layer.getRenderResults('prev')

            if (img && img.bounds) {
                regl.clear({ framebuffer: null, color: [0, 0, 0, 1], depth: 1 })
                imgRenderer({
                    box: Box2D.toFlatArray(img.bounds),
                    img: img.texture,
                    target: null,
                    view: Box2D.toFlatArray(this.camera.view)
                })
            }
        }, 33)
        this.layer.onChange({
            data: this.dzi,
            settings: {
                cache: this.cache,
                callback: (e) => { console.log(e) },
                camera: { view: this.camera.view, screenSize: this.camera.screen },
                regl: this.regl,
            }
        })
    }

}

let theDemo: Demo;

function demoTime(thing: HTMLCanvasElement) {
    if (theDemo !== undefined) {
        return theDemo;
    }
    thing.width = thing.clientWidth;
    thing.height = thing.clientHeight;

    const offscreen = thing;
    const gl = offscreen.getContext('webgl', {
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
    theDemo = new Demo(thing, regl);
}

demoTime(document.getElementById('glCanvas') as HTMLCanvasElement)