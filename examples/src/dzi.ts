import REGL from "regl";
import type { Camera } from "./common/camera";
import { Box2D, Vec2, type vec2 } from "@alleninstitute/vis-geometry";
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
        width: 13446,
        height: 11596,
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
    mousePos: vec2;
    mouse: 'up' | 'down';
    canvas: HTMLCanvasElement;
    dzi: DziImage;
    layer: ReglLayer2D<DziImage, DziRenderSettings>
    cache: AsyncDataCache<string, string, CacheContentType>;
    updateReqd: boolean = false;
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
        this.regl = regl;
        this.mouse = 'up'
        this.mousePos = [0, 0]
        this.canvas = canvas;
        const screen: vec2 = [canvas.clientWidth, canvas.clientHeight]
        this.camera = {
            projection: 'webImage',
            screen,
            view: Box2D.create([0, 0], [1, 1])
        }
        this.cache = new AsyncDataCache(destroyer, sizeOf, 512);
        this.dzi = omg_cors;
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
        this.onChange();
        this.initHandlers(this.canvas);
    }
    onChange() {
        if (!this.updateReqd) {
            this.updateReqd = true;
            requestAnimationFrame(() => {
                this.layer.onChange({
                    data: this.dzi,
                    settings: {
                        cache: this.cache,
                        callback: (e) => { console.log(e) },
                        camera: { view: this.camera.view, screenSize: this.camera.screen },
                        regl: this.regl,
                    }
                });
                this.updateReqd = false;
            })
        }
    }
    // private toDataspace(px: vec2) {
    //     const { view } = this.camera;
    //     const o: vec2 = [px[0], this.canvas.clientHeight - px[1]];
    //     const p = Vec2.div(o, [this.canvas.clientWidth, this.canvas.clientHeight]);
    //     const c = Vec2.mul(p, Box2D.size(view));
    //     return Vec2.add(view.minCorner, c);
    // }
    mouseMove(delta: vec2, pos: vec2) {
        if (this.mouse === 'down') {
            // drag the view
            const { screen, view } = this.camera;
            const p = Vec2.div(delta, [this.canvas.clientWidth, this.canvas.clientHeight]);
            const c = Vec2.mul(p, Box2D.size(view));
            this.camera = { ...this.camera, view: Box2D.translate(view, c), screen };
            this.onChange();
        }


        this.mousePos = Vec2.add(this.mousePos, delta);
    }
    mouseButton(click: 'up' | 'down', pos: vec2) {
        this.mouse = click;
    }
    zoom(scale: number) {
        const { view, screen } = this.camera;
        const m = Box2D.midpoint(view);
        this.camera = {
            ...this.camera,
            view: Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m),
            screen,
        };
        this.onChange();
    }
    private initHandlers(canvas: HTMLCanvasElement) {
        canvas.onmousedown = (e: MouseEvent) => {
            this.mouseButton('down', [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onmouseup = (e: MouseEvent) => {
            this.mouseButton('up', [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onmousemove = (e: MouseEvent) => {
            // account for gl-origin vs. screen origin:
            this.mouseMove([-e.movementX, -e.movementY], [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onwheel = (e: WheelEvent) => {
            this.zoom(e.deltaY > 0 ? 1.1 : 0.9);
        };

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