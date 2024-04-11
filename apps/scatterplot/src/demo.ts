import { Box2D, Vec2, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { beginLongRunningFrame, AsyncDataCache, type FrameLifecycle } from "@alleninstitute/vis-scatterbrain";

import { getVisibleItems, type Dataset, type RenderSettings, fetchItem } from './data'
import REGL from "regl";
import { loadDataset, type ColumnarMetadata, type ColumnData, type ColumnarTree } from "./scatterbrain-loader";
import { buildRenderer } from "./renderer";
const better = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json';
const busted = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json';
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
    renderer: ReturnType<typeof buildRenderer>;
    mouse: 'up' | 'down'
    mousePos: vec2;
    cache: AsyncDataCache<string, string, ColumnData>;
    curFrame: FrameLifecycle | null;
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl, url: string) {
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h]
        }
        this.curFrame = null;
        this.cache = new AsyncDataCache<string, string, ColumnData>((_data) => {
            // no op destroyer - GC will clean up for us
        }, (data: ColumnData) => data.data.byteLength, 500 * MB);

        loadJSON(url).then((metadata) => {
            this.dataset = loadDataset(metadata, url)
            this.rerender();
        })
        this.renderer = buildRenderer(regl);
        this.canvas = canvas;
        this.mouse = 'up'
        this.regl = regl;
        this.mousePos = [0, 0]
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
            this.rerender();
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
        this.rerender();
    }
    rerender() {
        if (this.curFrame) {
            this.curFrame.cancelFrame('whatever')
        }
        this.regl.clear({ color: [0.25, 0.25, 0.25, 1], depth: 1 })
        if (this.dataset) {
            // how big is one px in data-units?
            const px = Box2D.size(this.camera.view)[0] / this.camera.screen[0]
            // lets only draw a box of points if its 90px wide:
            const sizeThreshold = 90 * px;
            const items = getVisibleItems(this.dataset, this.camera.view, sizeThreshold);
            this.curFrame = beginLongRunningFrame<ColumnData, ColumnarTree<vec2>, RenderSettings>(
                5, 33, items, this.cache, {
                dataset: this.dataset,
                view: this.camera.view
            },
                fetchItem,
                this.renderer,
                (event) => {
                    switch (event.status) {
                        case "error":
                            throw event.error; // error boundary might catch this
                        case "progress":
                            break;
                        case "finished_synchronously":
                        case "finished":
                            this.curFrame = null;
                            break;
                        case "begun":
                            break;
                        case "cancelled":
                            break;
                        default:
                            break;
                    }
                },
                (reqKey, item, settings) => `${reqKey}:${item.content.name}`)
        }
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
        // attributes: {},
        extensions: ["ANGLE_instanced_arrays", "OES_texture_float", "WEBGL_color_buffer_float"],
    });
    const canvas: HTMLCanvasElement = regl._gl.canvas as HTMLCanvasElement;
    theDemo = new Demo(canvas, regl, better);

    setupEventHandlers(canvas, theDemo);
}


function setupEventHandlers(canvas: HTMLCanvasElement, demo: Demo) {
    canvas.onmousedown = (e: MouseEvent) => {
        demo.mouseButton("down");
    };
    canvas.onmouseup = (e: MouseEvent) => {
        demo.mouseButton("up");
    };
    canvas.onmousemove = (e: MouseEvent) => {
        // account for gl-origin vs. screen origin:
        demo.mouseMove([-e.movementX, e.movementY]);
    };
    canvas.onwheel = (e: WheelEvent) => {
        demo.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    };
}

async function loadJSON(url: string) {
    // obviously, we should check or something
    return fetch(url).then(stuff => stuff.json() as unknown as ColumnarMetadata)
}
demoTime();