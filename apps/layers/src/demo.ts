import { Box2D, Vec2, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { type ColumnRequest, type ColumnarMetadata } from "Common/loaders/scatterplot/scatterbrain-loader";
import REGL from "regl";
import { AsyncDataCache, type FrameLifecycle, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
import { buildRenderer } from "../../scatterplot/src/renderer";
import { buildImageRenderer } from "../../omezarr-viewer/src/image-renderer";
import { ReglLayer2D } from "./layer";
import { renderSlide, type RenderSettings as SlideRenderSettings } from "./data-renderers/dynamicGridSlideRenderer";
import { renderGrid, renderSlice, type RenderSettings as SliceRenderSettings } from "./data-renderers/volumeSliceRenderer";
import { renderAnnotationLayer, type RenderSettings as AnnotationRenderSettings, type SimpleAnnotation } from "./data-renderers/simpleAnnotationRenderer";
import { buildPathRenderer } from "./data-renderers/lineRenderer";
// gui stuff....
import { DEFAULT_THEME, defGUI } from "@thi.ng/imgui";
import { gridLayout } from "@thi.ng/layout";
import { $canvas } from "@thi.ng/rdom-canvas";
import { fromDOMEvent, fromRAF, } from "@thi.ng/rstream";
import { gestureStream } from "@thi.ng/rstream-gestures";
import { layerListUI } from "./ui/layer-list";
import { volumeSliceLayer } from "./ui/volume-slice-layer";
import { annotationUi } from "./ui/annotation-ui";
import { buildVersaRenderer, type AxisAlignedPlane } from "../../omezarr-viewer/src/versa-renderer";
import type { ColorMapping, RenderCallback } from "./data-renderers/types";
import { createZarrSlice, type AxisAlignedZarrSlice } from "./data-sources/ome-zarr/planar-slice";
import { createSlideDataset, type DynamicGridSlide } from "./data-sources/scatterplot/dynamic-grid";
import type { OptionalTransform } from "./data-sources/types";
import type { CacheEntry, AnnotationLayer, Layer } from "./types";
import { createZarrSliceGrid, type AxisAlignedZarrSliceGrid } from "./data-sources/ome-zarr/slice-grid";
import { renderAnnotationGrid, type AnnotationGrid, type LoopRenderer, type MeshRenderer, type RenderSettings as AnnotationGridRenderSettings } from "./data-renderers/annotation-renderer";
import { buildLoopRenderer, buildMeshRenderer } from "./data-renderers/mesh-renderer";
import type { Camera } from "../../omezarr-viewer/src/camera";
import { saveAs } from 'file-saver'
const KB = 1000;
const MB = 1000 * KB;



function destroyer(item: CacheEntry) {
    if (item.type === 'texture2D') {
        item.data.destroy();
    }
    // other types are GC'd like normal, no special destruction needed
}
function sizeOf(item: CacheEntry) {
    // todo: care about bytes later!
    return 1;
}
function appendPoint(layer: AnnotationLayer, p: vec2) {
    const path = layer.data.paths[layer.data.paths.length - 1];
    if (path) {
        path.points.push(p);
        path.bounds = Box2D.union(path.bounds, Box2D.create(p, p))
    }
}
function startStroke(layer: AnnotationLayer, p: vec2) {
    layer.data.paths.push({
        bounds: Box2D.create(p, p),
        color: [1, 0, 0, 1],
        id: Math.random(),
        points: [p]
    })
}
class Demo {

    setSlice(what: number) {
        for (const layer of this.layers) {
            if (layer.type === 'volumeSlice') {
                layer.data = { ...layer.data, planeParameter: what }
                this.onCameraChanged();
                break;
            }
        }
    }
    camera: {
        readonly view: box2D;
        readonly screen: vec2;
    }
    layers: Layer[]
    regl: REGL.Regl;
    selectedLayer: number;
    canvas: HTMLCanvasElement;
    mouse: 'up' | 'down'
    mode: 'draw' | 'pan'
    mousePos: vec2;
    cache: AsyncDataCache<string, string, CacheEntry>;
    imgRenderer: ReturnType<typeof buildImageRenderer>;
    plotRenderer: ReturnType<typeof buildRenderer>;
    sliceRenderer: ReturnType<typeof buildVersaRenderer>;
    pathRenderer: ReturnType<typeof buildPathRenderer>
    loopRenderer: LoopRenderer;
    meshRenderer: MeshRenderer;
    stencilMeshRenderer: MeshRenderer;
    private refreshRequested: number = 0;
    private redrawRequested: number = 0;
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
        this.canvas = canvas;
        // this.ctx = canvas.getContext('2d')!;
        this.mouse = 'up'
        this.regl = regl;
        this.mousePos = [0, 0]
        this.layers = [];
        this.mode = 'pan'
        this.selectedLayer = 0;
        this.pathRenderer = buildPathRenderer(regl);
        this.plotRenderer = buildRenderer(regl);
        this.imgRenderer = buildImageRenderer(regl);
        this.sliceRenderer = buildVersaRenderer(regl);
        this.meshRenderer = buildMeshRenderer(regl, 'use-stencil');
        this.stencilMeshRenderer = buildMeshRenderer(regl, 'draw-stencil');
        this.loopRenderer = buildLoopRenderer(regl);

        this.refreshRequested = 0;
        this.redrawRequested = 0;
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h]
        }
        this.initHandlers(canvas);
        // each entry in the cache is about 250 kb - so 4000 means we get 1GB of data
        this.cache = new AsyncDataCache<string, string, CacheEntry>(destroyer, sizeOf, 4000);
    }
    pickLayer(i: number) {
        if (i >= 0 && i < this.layers.length) {
            this.selectedLayer = i;
            if (this.layers[i].type !== 'annotationLayer') {
                this.mode = 'pan'
            }
        }
    }
    uiChange() {
        this.onCameraChanged();
    }

    addAnnotation(data: SimpleAnnotation) {
        const [w, h] = this.camera.screen
        this.layers.push({
            type: 'annotationLayer',
            data,
            render: new ReglLayer2D<SimpleAnnotation, AnnotationRenderSettings>(
                this.regl, this.imgRenderer, renderAnnotationLayer, [w, h]
            )
        })
    }
    addScatterplot(url: string, slideId: string, color: ColumnRequest) {
        return createSlideDataset({
            colorBy: color,
            slideId,
            type: 'ScatterPlotGridSlideConfig',
            url,
        }).then((data) => {
            if (data) {
                const [w, h] = this.camera.screen
                const layer = new ReglLayer2D<DynamicGridSlide & OptionalTransform, SlideRenderSettings<CacheEntry>>(
                    this.regl, this.imgRenderer, renderSlide<CacheEntry>, [w, h]
                );
                this.layers.push({
                    type: 'scatterplot',
                    data,
                    render: layer
                });
            }
        })

    }
    addVolumeSlice(url: string, plane: AxisAlignedPlane, param: number, gamut: ColorMapping, rotation: number, trn?: { offset: vec2, scale: vec2 }) {
        const [w, h] = this.camera.screen
        return createZarrSlice({
            type: 'zarrSliceConfig',
            gamut,
            plane,
            planeParameter: param,
            url,
            rotation,
            trn
        }).then((data) => {
            const layer = new ReglLayer2D<AxisAlignedZarrSlice & OptionalTransform, Omit<SliceRenderSettings<CacheEntry>, 'target'>>(
                this.regl, this.imgRenderer, renderSlice<CacheEntry>, [w, h]
            );
            this.layers.push({
                type: 'volumeSlice',
                data,
                render: layer
            });
        })
    }
    addAnnotationGrid(url: string, levelFeature: string, annotationBaseUrl: string) {
        return createSlideDataset({
            colorBy: colorByGene,
            slideId: slide32,
            type: 'ScatterPlotGridSlideConfig',
            url,
        }).then((data) => {
            if (data) {
                const [w, h] = this.camera.screen
                // const layer = new ReglLayer2D<AxisAlignedZarrSliceGrid, Omit<SliceRenderSettings<CacheEntry>, 'target'>>(
                //     this.regl, this.imgRenderer, renderGrid<CacheEntry>, [w, h]
                // );
                this.layers.push({
                    type: 'annotationGrid',
                    data: {
                        dataset: data?.dataset,
                        annotationBaseUrl,
                        levelFeature,
                        type: 'AnnotationGrid'
                    },
                    render: new ReglLayer2D<AnnotationGrid, Omit<AnnotationGridRenderSettings<CacheEntry>, 'target'>>(
                        this.regl, this.imgRenderer, renderAnnotationGrid, [w, h])
                })
            }
        })
    }
    addVolumeGrid(url: string, plane: AxisAlignedPlane, slices: number, gamut: ColorMapping, rotation: number, trn?: { offset: vec2, scale: vec2 }) {
        const [w, h] = this.camera.screen
        return createZarrSliceGrid({
            gamut,
            plane,
            slices,
            type: 'ZarrSliceGridConfig',
            url,
            rotation,
            trn
        }).then((data) => {
            const layer = new ReglLayer2D<AxisAlignedZarrSliceGrid, Omit<SliceRenderSettings<CacheEntry>, 'target'>>(
                this.regl, this.imgRenderer, renderGrid<CacheEntry>, [w, h]
            );
            this.layers.push({
                type: 'volumeGrid',
                data: data,
                render: layer
            });


        })
    }
    async requestSnapshot() {
        // TODO: using a canvas to build a png is very fast (the browser does it for us)
        // however, it does require that the whole image be in memory at once - if you want truely high-res snapshots,
        // we should trade out some speed and use pngjs, which lets us pass in as little as a single ROW of pixels at a time
        // this would let us go slow(er), but use WAAAY less memory (consider the cost of a 12000x8000 pixel image is (before compression)) about 300 MB...
        const w = 12000;
        const { view, screen } = this.camera;
        const aspect = screen[1] / screen[0];
        const h = w * aspect;
        const pixels = await this.takeSnapshot({ view, screen: [w, h] }, this.layers)
        // create an offscreen canvas...
        const cnvs = new OffscreenCanvas(w, h);
        const imgData = new ImageData(new Uint8ClampedArray(pixels.buffer), w, h);
        const ctx = cnvs.getContext('2d');
        ctx?.putImageData(imgData, 0, 0);
        const blob = await cnvs.convertToBlob();
        saveAs(blob, 'neat.png');
    }
    private takeSnapshot(camera: Camera, layers: readonly Layer[]) {
        // render each layer, in order, given a snapshot buffer
        // once done, regl.read the whole thing, turn it to a png
        return new Promise<Uint8Array>((resolve, reject) => {

            const [width, height] = camera.screen
            const target = this.regl.framebuffer(width, height);
            this.regl.clear({ framebuffer: target, color: [0, 0, 0, 1], depth: 1 })
            const renderers = {
                volumeSlice: this.sliceRenderer,
                scatterplot: this.plotRenderer,
                annotationLayer: this.pathRenderer,
                volumeGrid: this.sliceRenderer,
                annotationGrid: {
                    loopRenderer: this.loopRenderer,
                    meshRenderer: this.meshRenderer,
                    stencilMeshRenderer: this.stencilMeshRenderer
                }
            }


            const layerPromises: Array<() => FrameLifecycle> = []
            const nextLayerWhenFinished: RenderCallback = (e: { status: NormalStatus } | { status: 'error', error: unknown }) => {
                const { status } = e;
                switch (status) {
                    case 'cancelled':
                        reject('one of the layer tasks was cancelled')
                        break;
                    case 'progress':
                        if (Math.random() > 0.7) {
                            console.log('...')
                        }
                        break;
                    case 'finished':
                    case 'finished_synchronously':
                        // start the next layer
                        const next = layerPromises.shift()
                        if (!next) {
                            // do the final read!
                            const bytes = this.regl.read({ framebuffer: target })
                            resolve(bytes);
                        } else {
                            // do the next layer
                            next();
                        }
                }
            }
            const settings = {
                cache: this.cache, camera, callback: nextLayerWhenFinished, regl: this.regl
            }
            for (const layer of layers) {
                switch (layer.type) {
                    case 'volumeGrid':
                        layerPromises.push(() => renderGrid<CacheEntry>(target, layer.data, { ...settings, renderer: renderers[layer.type] }))
                        break;
                    case 'annotationGrid':
                        layerPromises.push(() => renderAnnotationGrid(target, layer.data, { ...settings, renderers: renderers[layer.type] }));
                        break;
                    case 'volumeSlice':
                        layerPromises.push(() => renderSlice(target, layer.data, { ...settings, renderer: renderers[layer.type] }));
                        break;
                    case 'scatterplot':
                        layerPromises.push(() => renderSlide(target, layer.data, { ...settings, renderer: renderers[layer.type] }));
                        break;
                    case 'annotationLayer':
                        layerPromises.push(() => renderAnnotationLayer(target, layer.data, { ...settings, renderer: renderers[layer.type] }))
                        break;
                }
            }
            // start it up!
            const first = layerPromises.shift();
            if (first) {
                first();
            }
        })
    }
    private doReRender() {
        const { cache, camera } = this;
        const drawOnProgress: RenderCallback = (e: { status: NormalStatus } | { status: 'error', error: unknown }) => {
            const { status } = e;
            switch (status) {
                case 'finished':
                case 'progress':
                case 'finished_synchronously':
                case 'begun':
                    this.requestReRender();
                    break;
            }
        }
        const settings = {
            cache, camera, callback: drawOnProgress, regl: this.regl
        }
        const renderers = {
            volumeSlice: this.sliceRenderer,
            scatterplot: this.plotRenderer,
            annotationLayer: this.pathRenderer,
            volumeGrid: this.sliceRenderer,
            annotationGrid: {
                loopRenderer: this.loopRenderer,
                meshRenderer: this.meshRenderer,
                stencilMeshRenderer: this.stencilMeshRenderer
            }
        }
        for (const layer of this.layers) {
            // TODO all cases are identical - dry it up!
            if (layer.type === 'scatterplot') {
                layer.render.onChange({
                    data: layer.data,
                    settings: {
                        ...settings,

                        renderer: renderers[layer.type],
                    }
                })
            } else if (layer.type === 'volumeSlice') {
                layer.render.onChange({
                    data: layer.data,
                    settings: {
                        ...settings,
                        renderer: renderers[layer.type],
                    }
                })
            } else if (layer.type === 'annotationLayer') {
                layer.render.onChange({
                    data: layer.data,
                    settings: {
                        ...settings,
                        renderer: renderers[layer.type],
                    }
                })
            } else if (layer.type === 'volumeGrid') {
                layer.render.onChange({
                    data: layer.data,
                    settings: {
                        ...settings,
                        concurrentTasks: 2,
                        renderer: renderers[layer.type],
                    }
                })
            } else if (layer.type === 'annotationGrid') {
                layer.render.onChange({
                    data: layer.data,
                    settings: {
                        ...settings,
                        concurrentTasks: 2,
                        renderers: renderers[layer.type],
                    }
                })
            }
        }
    }
    onCameraChanged() {
        if (this.redrawRequested === 0) {
            this.redrawRequested = window.requestAnimationFrame(() => {
                this.doReRender();
                this.redrawRequested = 0;
            })
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
    mouseButton(click: "up" | "down", pos: vec2) {
        this.mouse = click;
        const curLayer = this.layers[this.selectedLayer]
        if (click === 'down' && curLayer && curLayer.type === 'annotationLayer') {
            startStroke(curLayer, this.toDataspace(pos));
        }
    }
    private toDataspace(px: vec2) {
        const { screen, view } = this.camera;
        const p = Vec2.div(px, [this.canvas.clientWidth, this.canvas.clientHeight]);
        const c = Vec2.mul(p, Box2D.size(view));
        return Vec2.add(view.minCorner, c);
    }
    mouseMove(delta: vec2, pos: vec2) {
        const curLayer = this.layers[this.selectedLayer]
        if (this.mode === 'pan') {
            if (this.mouse === "down") {
                // drag the view
                const { screen, view } = this.camera;
                const p = Vec2.div(delta, [this.canvas.clientWidth, this.canvas.clientHeight]);
                const c = Vec2.mul(p, Box2D.size(view));
                this.camera = { view: Box2D.translate(view, c), screen };
                this.onCameraChanged();
            }
        } else if (curLayer && curLayer.type === 'annotationLayer') {
            if (this.mouse === "down") {
                appendPoint(curLayer, this.toDataspace(pos))
                this.onCameraChanged();
            }
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
            this.mouseButton("down", [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onmouseup = (e: MouseEvent) => {
            this.mouseButton("up", [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onmousemove = (e: MouseEvent) => {
            // account for gl-origin vs. screen origin:
            this.mouseMove([-e.movementX, e.movementY], [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onwheel = (e: WheelEvent) => {
            this.zoom(e.deltaY > 0 ? 1.1 : 0.9);
        };
    }

    refreshScreen() {
        this.regl.clear({ framebuffer: null, color: [0, 0, 0, 1], depth: 1 })
        for (const layer of this.layers) {
            const src = layer.render.getRenderResults('prev')
            if (src.bounds) {
                this.imgRenderer({
                    box: Box2D.toFlatArray(src.bounds),
                    img: src.texture,
                    target: null,
                    view: Box2D.toFlatArray(this.camera.view)
                })
            }
            if (layer.render.renderingInProgress()) {
                // draw our incoming frame overtop the old!
                const cur = layer.render.getRenderResults('cur')
                if (cur.bounds) {
                    this.imgRenderer({
                        box: Box2D.toFlatArray(cur.bounds),
                        img: cur.texture,
                        target: null,
                        view: Box2D.toFlatArray(this.camera.view)
                    })
                }
            }

        }
    }
}

let theDemo: Demo;

function demoTime(thing: HTMLCanvasElement) {
    console.log('fire up the demo!')
    if (theDemo !== undefined) {
        return theDemo;
    }
    thing.width = thing.clientWidth;
    thing.height = thing.clientHeight;

    const offscreen = thing;
    const gl = offscreen.getContext("webgl", {
        alpha: true,
        preserveDrawingBuffer: true,
        antialias: true,
        premultipliedAlpha: true,
    });
    if (!gl) {
        throw new Error('WebGL not supported!')
    }
    const regl = REGL({
        gl,
        extensions: ["ANGLE_instanced_arrays", "OES_texture_float", "WEBGL_color_buffer_float"],
    });
    const pretend = { min: 0, max: 500 }
    theDemo = new Demo(thing, regl);

    theDemo.addVolumeGrid(scottpoc, 'xy', 142, {
        R: { index: 0, gamut: pretend },
        G: { index: 1, gamut: pretend },
        B: { index: 2, gamut: pretend }
    }, 0 * Math.PI).then(() => {
        const { dataset, level, base } = structureAnnotation
        theDemo.addAnnotationGrid(dataset, level, base).then(() => theDemo.uiChange())
    })
    window['theDemo'] = theDemo;
}
const slide32 = 'MQ1B9QBZFIPXQO6PETJ'
const colorByGene: ColumnRequest = { name: '88', type: 'QUANTITATIVE' }
const merfish = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_slide_view_02142024-20240223021524/DTVLE1YGNTJQMWVMKEU/ScatterBrain.json'
const ccf = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/mouse3/230524_transposed_1501/avg_template/'
const tissuecyte = "https://tissuecyte-visualizations.s3.amazonaws.com/data/230105/tissuecyte/1111175209/green/"
const tenx = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json'
const scottpoc = 'https://tissuecyte-ome-zarr-poc.s3.amazonaws.com/40_128_128/1145081396'
const structureAnnotation = {
    dataset: 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_ccf_04112024-20240419205547/4STCSZBXHYOI0JUUA3M/ScatterBrain.json',
    // gridFeature: '7IJI7W3FOGYCTGOH0MO',//'V78U3GI18LIA0UHBLAL',
    level: '73GVTDXDEGE27M2XJMT',
    base: 'https://stage-sfs.brain.devlims.org/api/v1/Annotation/4STCSZBXHYOI0JUUA3M/v3/TLOKWCL95RU03D9PETG/'
}
// function buildGui(demo: Demo, sidebar: HTMLElement) {
//     const gui = defGUI({
//         theme: {
//             ...DEFAULT_THEME,
//             font: "16px 'IBM Plex Mono', monospace",
//             baseLine: 6,
//             focus: "#000",
//         },
//     });

//     const initGUI = (el: HTMLCanvasElement) => {
//         // unified mouse & touch event handling
//         gestureStream(el).subscribe({
//             next(e: any) {
//                 gui.setMouse(e.pos, e.buttons);
//             },
//         });
//     };

//     const updateGUI = () => {
//         // create grid layout using https://thi.ng/layout
//         // position grid centered in window
//         const rowHeight = 32;
//         const gap = 4;
//         const grid = gridLayout(
//             // start X position
//             16,
//             // start Y position (centered)
//             (sidebar.clientHeight - (2 * rowHeight + gap)) / 2,
//             // layout width
//             sidebar.clientWidth - 32,
//             // single column
//             1,
//             rowHeight,
//             gap
//         );
//         // prep GUI for next frame
//         gui.begin();
//         layerListUI(gui, grid, demo.selectedLayer, demo.layers, (i) => demo.pickLayer(i));
//         const curLayer = demo.layers[demo.selectedLayer];
//         if (curLayer) {
//             switch (curLayer.type) {
//                 case 'volumeSlice':
//                     volumeSliceLayer(gui, grid, curLayer,
//                         (i: number) => { curLayer.data = { ...curLayer.data, planeParameter: i }; demo.uiChange() },
//                         (p: AxisAlignedPlane) => { curLayer.data = { ...curLayer.data, plane: p }; demo.uiChange() })
//                     break;
//                 case 'annotationLayer':
//                     annotationUi(gui, grid, demo.mode, curLayer,
//                         (p: 'draw' | 'pan') => { demo.mode = p; demo.uiChange() })
//                     break;
//             }
//         }
//         // end frame
//         gui.end();

//         return gui;
//     };
//     const windowSize = fromDOMEvent(window, "resize", false, {
//         init: <any>{},
//     }).map(() => [sidebar.clientWidth, sidebar.clientHeight]);

//     // canvas component
//     $canvas(fromRAF().map(updateGUI), windowSize, {
//         // execute above init handler when canvas has been mounted
//         onmount: initGUI,
//         style: {
//             background: gui.theme.globalBg,
//             // update cursor value each frame
//             cursor: fromRAF().map(() => gui.cursor),
//         },
//         ...gui.attribs,
//     }).mount(sidebar);
// }
demoTime(document.getElementById('glCanvas') as HTMLCanvasElement)