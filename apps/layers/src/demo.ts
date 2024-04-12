import { Box2D, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import type { Dataset } from "~/loaders/scatterplot/data";
import type { ColumnData } from "~/loaders/scatterplot/scatterbrain-loader";
import REGL from "regl";
import { AsyncDataCache, type FrameLifecycle, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
const KB = 1000;
const MB = 1000 * KB;


class Demo {
    camera: {
        view: box2D;
        screen: vec2;
    }
    dataset: Dataset | undefined;
    regl: REGL.Regl;
    canvas: HTMLCanvasElement;
    mouse: 'up' | 'down'
    mousePos: vec2;
    pointCache: AsyncDataCache<string, string, ColumnData>;
    textureCache: AsyncDataCache<string, string, REGL.Texture2D>;
    layers: Layer<typeof this.camera>[]
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
        this.canvas = canvas;
        this.mouse = 'up'
        this.regl = regl;
        this.mousePos = [0, 0]
        this.layers = [];
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h]
        }
        this.pointCache = new AsyncDataCache<string, string, ColumnData>((_data) => {
            // no op destroyer - GC will clean up for us
        }, (data: ColumnData) => data.data.byteLength, 500 * MB);
        this.textureCache = new AsyncDataCache<string, string, REGL.Texture2D>((d: REGL.Texture2D) => {
            d.destroy()
        }, (_d) => 1, 512)
    }

    refreshScreen() {

        // for each layer in order, draw it to the screen - 
        this.layers.forEach((layer) => {
            const image = layer.getImage();
            // draw the image to the screen
        })
    }
}

let theDemo: Demo;

function demoTime() {
    const thing = document.getElementById("glCanvas") as HTMLCanvasElement;
    thing.width = thing.clientWidth;
    thing.height = thing.clientHeight;
    const gl = thing.getContext("webgl", {
        alpha: true,
        preserveDrawingBuffer: true,
        antialias: true,
        premultipliedAlpha: true,
    }) as WebGL2RenderingContext;
    const regl = REGL({
        gl,
        extensions: ["ANGLE_instanced_arrays", "OES_texture_float", "WEBGL_color_buffer_float"],
    });
    const canvas: HTMLCanvasElement = regl._gl.canvas as HTMLCanvasElement;
    theDemo = new Demo(canvas, regl);
}

demoTime();