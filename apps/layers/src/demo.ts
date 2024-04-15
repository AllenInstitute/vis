import { Box2D, Vec2, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import type { Dataset } from "~/loaders/scatterplot/data";
import { loadDataset, type ColumnData, type ColumnarMetadata } from "~/loaders/scatterplot/scatterbrain-loader";
import REGL from "regl";
import { AsyncDataCache, type FrameLifecycle, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
import { ScLayer } from "./scatterplotLayer";
import { buildRenderer } from "../../scatterplot/src/renderer";
import { buildImageRenderer } from "../../omezarr-viewer/src/image-renderer";
const KB = 1000;
const MB = 1000 * KB;

async function loadJSON(url: string) {
    // obviously, we should check or something
    return fetch(url).then(stuff => stuff.json() as unknown as ColumnarMetadata)
}


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
    layer: ScLayer | null;
    imgRenderer: ReturnType<typeof buildImageRenderer>;
    private refreshRequested: number = 0;
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl, url: string) {
        this.canvas = canvas;
        this.mouse = 'up'
        this.regl = regl;
        this.mousePos = [0, 0]
        this.layer = null;
        const plotRenderer = buildRenderer(regl);
        this.imgRenderer = buildImageRenderer(regl);
        this.refreshRequested = 0;
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h]
        }
        this.initHandlers(canvas);
        this.pointCache = new AsyncDataCache<string, string, ColumnData>((_data) => {
            // no op destroyer - GC will clean up for us
        }, (data: ColumnData) => data.data.byteLength, 500 * MB);
        this.textureCache = new AsyncDataCache<string, string, REGL.Texture2D>((d: REGL.Texture2D) => {
            d.destroy()
        }, (_d) => 1, 512)

        loadJSON(url).then((metadata) => {
            this.dataset = loadDataset(metadata, url);
            this.layer = new ScLayer(regl, this.pointCache, this.dataset, [w, h], plotRenderer, () => {
                this.requestReRender();
            })
        })
    }
    private onCameraChanged() {
        if (this.layer) {
            this.layer.onChangeView(this.camera.view);
        }
    }
    requestReRender() {
        if (this.refreshRequested === 0) {
            this.refreshRequested = window.requestAnimationFrame(() => {
                this.refreshScreen();
                this.refreshRequested = 0;
            })
        }
    }
    mouseButton(click: "up" | "down") {
        this.mouse = click;
    }
    mouseMove(delta: vec2) {
        if (this.mouse === "down") {
            // drag the view
            const { screen, view } = this.camera;
            const p = Vec2.div(delta, [this.canvas.clientWidth, this.canvas.clientHeight]);
            const c = Vec2.mul(p, Box2D.size(view));
            this.camera = { view: Box2D.translate(view, c), screen };
            this.onCameraChanged();
        }
        this.mousePos = Vec2.add(this.mousePos, delta);
    }
    zoom(scale: number) {
        const { view, screen } = this.camera;
        const m = Box2D.midpoint(view);
        this.camera = {
            view: Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m),
            screen,
        };
        this.onCameraChanged();
    }
    private initHandlers(canvas: HTMLCanvasElement) {
        canvas.onmousedown = (e: MouseEvent) => {
            this.mouseButton("down");
        };
        canvas.onmouseup = (e: MouseEvent) => {
            this.mouseButton("up");
        };
        canvas.onmousemove = (e: MouseEvent) => {
            // account for gl-origin vs. screen origin:
            this.mouseMove([-e.movementX, e.movementY]);
        };
        canvas.onwheel = (e: WheelEvent) => {
            this.zoom(e.deltaY > 0 ? 1.1 : 0.9);
        };
    }

    refreshScreen() {
        if (!this.layer) return

        this.regl.clear({ framebuffer: null, color: [0, 0, 0, 1], depth: 1 })
        const src = this.layer.getRenderResults('prev');
        this.imgRenderer({
            box: Box2D.toFlatArray(src.bounds),
            img: src.texture,
            target: null,
            view: Box2D.toFlatArray(this.camera.view)
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
    theDemo = new Demo(canvas, regl, 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json');
}

demoTime();