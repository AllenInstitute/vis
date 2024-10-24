import { Box2D, Vec2, type vec2 } from "@alleninstitute/vis-geometry";
import REGL from "regl";
import type { Camera } from "../common/camera";
import { AsyncDataCache, type ReglCacheEntry, type AsyncFrameEvent } from "@alleninstitute/vis-scatterbrain";
import { buildImageRenderer } from "../common/image-renderer";
import { createUmapDataset, type UmapConfig } from "../data-sources/scatterplot/umap";
import type { ScatterplotDataset } from "~/common/loaders/scatterplot/scatterbrain-loader";
import { buildAsyncConstellationRenderer, buildConstellationRenderer, type ConstellationRenderSettings } from "./constellation-renderer";
import { exampleTaxonomy, type TaxonomyFeatures } from "./loader";


// a demo for playing with constellation plot ideas.

function destroyer(item: CacheEntry) {
    switch (item.type) {
        case 'buffer':
            item.buffer.destroy();
            break;
        case 'texture':
            item.texture.destroy();
            break;
        default:
            // @ts-expect-error
            console.error(item.data, 'implement a destroyer for this case!');
            break;
    }
}
function sizeOf(_item: CacheEntry) {
    return 1;
}
type CacheEntry = ReglCacheEntry;
type RendererType = Awaited<ReturnType<typeof buildConstellationRenderer>>;
export class Demo {
    camera: Camera;
    regl: REGL.Regl;
    canvas: HTMLCanvasElement;
    mouse: 'up' | 'down';
    mode: 'draw' | 'pan';
    mousePos: vec2;
    taxonomyData: REGL.Texture2D;
    txSize: vec2;
    plot: (ScatterplotDataset & TaxonomyFeatures) | undefined;
    anmParam: number;
    goal: number;
    interval: number;
    private refreshRequested: number = 0;
    cache: AsyncDataCache<string, string, CacheEntry>;
    imgRenderer: ReturnType<typeof buildImageRenderer>;
    // taxRenderer: ReturnType<typeof buildTaxonomyRenderer>;
    // edgeRenderer: ReturnType<typeof buildEdgeRenderer>;
    constellationRenderer: null | Awaited<ReturnType<typeof buildAsyncConstellationRenderer>>;
    filterCluster: number;
    colorBy: number;
    pointSize: number;
    edgeBuffers: Array<null | { start: REGL.Buffer, end: REGL.Buffer, pStart: REGL.Buffer, pEnd: REGL.Buffer, count: number }>
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
        this.regl = regl;
        this.mode = 'pan'
        this.mouse = 'up'
        this.mousePos = [0, 0];
        this.pointSize = 2;
        this.filterCluster = -1;
        this.interval = 0;
        this.anmParam = 0;;
        this.goal = 0;
        this.canvas = canvas;
        this.constellationRenderer = null;
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h],
            projection: 'webImage',
        };
        this.colorBy = 0;
        this.imgRenderer = buildImageRenderer(regl);
        this.cache = new AsyncDataCache<string, string, CacheEntry>(destroyer, sizeOf, 4000);
        this.initHandlers(canvas);
        this.taxonomyData = regl.texture({ width: 5, height: 6000, format: 'rgba', type: 'float' });
        this.txSize = [5, 6000];
        this.loadTaxonomyInfo();
        this.edgeBuffers = []
    }
    mouseButton(click: 'up' | 'down', pos: vec2) {
        this.mouse = click;

    }
    private toDataspace(px: vec2) {
        const { view } = this.camera;
        const o: vec2 = px;
        const p = Vec2.div(o, [this.canvas.clientWidth, this.canvas.clientHeight]);
        const c = Vec2.mul(p, Box2D.size(view));
        return Vec2.add(view.minCorner, c);
    }
    mouseMove(delta: vec2, pos: vec2) {
        if (this.mode === 'pan') {
            if (this.mouse === 'down') {
                // drag the view
                const { screen, view } = this.camera;
                const p = Vec2.div(delta, [this.canvas.clientWidth, this.canvas.clientHeight]);
                const c = Vec2.mul(p, Box2D.size(view));
                this.camera = { ...this.camera, view: Box2D.translate(view, c), screen };
            }
        }
        this.mousePos = pos;
        this.onRenderStateChanged();
    }
    zoom(scale: number) {
        const { view, screen } = this.camera;
        const m = Box2D.midpoint(view);
        this.camera = {
            ...this.camera,
            view: Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m),
            screen,
        };
        this.onRenderStateChanged();
    }
    private onRenderEvent(e: AsyncFrameEvent<any, any>) {
        if (this.constellationRenderer) {
            switch (e.status) {
                case 'finished':
                    this.constellationRenderer.edgeRenderer({
                        anmParam: this.anmParam,
                        anmGoal: this.goal,
                        focus: this.toDataspace(this.mousePos),
                        target: null,
                        view: this.camera.view,
                    })
                    break;
            }
        }

    }
    private onRenderStateChanged() {
        if (this.constellationRenderer && this.plot) {
            this.regl.clear({ framebuffer: null, color: [0, 0, 0, 1], depth: 1 })
            const settings: ConstellationRenderSettings = {
                animationParam: this.anmParam,
                colorBy: 4 + this.colorBy,
                camera: this.camera,
                pointSize: this.pointSize,
                filter_out_hack: this.filterCluster,
            }
            this.constellationRenderer.dotRenderer(this.plot, settings, (e) => { this.onRenderEvent(e) }, null, this.cache)
        }
    }

    private async loadTaxonomyInfo() {
        this.constellationRenderer = await buildAsyncConstellationRenderer(this.regl);
        this.onRenderStateChanged();
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
            this.mouseMove([-e.movementX, e.movementY], [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onwheel = (e: WheelEvent) => {
            this.zoom(e.deltaY > 0 ? 1.1 : 0.9);
        };
        window.onkeyup = (e: KeyboardEvent) => {
            if (e.key === 'w') {
                this.anmParam += 0.0331;
                this.onRenderStateChanged();
            } else if (['0', '1', '2', '3', '4'].includes(e.key)) {
                this.goal = Number.parseInt(e.key);
            } else if (e.key === 's') {
                this.anmParam -= 0.0331;
                this.onRenderStateChanged();
            } else if (e.key === 'o') {
                this.filterCluster -= 1;
                this.onRenderStateChanged();
            } else if (e.key === 'p') {
                this.filterCluster += 1;
                this.onRenderStateChanged();
            } else if (e.key === 'c') {
                this.colorBy = (this.colorBy + 1) % 4
                this.onRenderStateChanged();
            }
            else if (e.key === 'a') {
                if (this.interval === 0) {
                    let lastFrameTime = performance.now();
                    const intervalMS = 16; //60fps
                    const progressPerMS = 2 / 1000;
                    this.interval = window.setInterval(() => {
                        const now = performance.now()
                        const delta = now - lastFrameTime;
                        lastFrameTime = now
                        if (this.goal == this.anmParam) {
                            return;
                        }
                        if (Math.abs(this.goal - this.anmParam) < progressPerMS * delta) {
                            this.anmParam = this.goal;
                            this.onRenderStateChanged();
                        }
                        if (this.goal != this.anmParam) {
                            const progress = progressPerMS * delta
                            this.anmParam += (this.goal > this.anmParam) ? progress : -progress
                            this.onRenderStateChanged();
                        }
                    }, intervalMS)
                } else {
                    window.clearInterval(this.interval);
                    this.interval = 0;
                }

            }
        }
    }
    loadData(config: UmapConfig) {
        const [w, h] = this.camera.screen;
        return createUmapDataset(config).then((plot) => {
            this.plot = { ...plot.dataset, ...exampleTaxonomy }
            // cover the dataset, respect the aspect of the screen:
            const [dw, dh] = Box2D.size(plot.dataset.bounds)

            const goodView = Box2D.create([0, 0], [(dw * w) / h, dh])
            this.camera = { ...this.camera, view: goodView };
        });
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
        extensions: ['ANGLE_instanced_arrays', 'OES_texture_float', 'WEBGL_color_buffer_float', 'EXT_frag_depth'],
    });
    theDemo = new Demo(thing, regl);
    theDemo.loadData(fancy);
}
const tenx = `https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json`
// 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json';
const fancy: UmapConfig = {
    url: tenx,
    type: 'UmapConfig',
}
demoTime(document.getElementById('glCanvas') as HTMLCanvasElement);


// lets try GQty to pull in the metadata for cell types
// we need that so that indexing will line up in the shader...

