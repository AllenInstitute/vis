import { Box2D, Vec2, type Interval, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { isSlideViewData, loadDataset, type ColumnData, type ColumnRequest, type ColumnarMetadata, type SlideViewDataset } from "~/loaders/scatterplot/scatterbrain-loader";
import REGL from "regl";
import { AsyncDataCache, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
import { buildRenderer } from "../../scatterplot/src/renderer";
import { buildImageRenderer } from "../../omezarr-viewer/src/image-renderer";
import { load, sizeInUnits } from "~/loaders/ome-zarr/zarr-data";
// import { buildVolumeSliceRenderer, type AxisAlignedPlane } from "../../omezarr-viewer/src/slice-renderer";
import { ReglLayer2D } from "./layer";
import type { AxisAlignedZarrSlice, ColorMapping, DynamicGridSlide, OptionalTransform, RenderCallback } from "./data-renderers/types";
import { renderSlide, type RenderSettings as SlideRenderSettings } from "./data-renderers/dynamicGridSlideRenderer";
import { renderGrid, renderSlice, type RenderSettings as SliceRenderSettings } from "./data-renderers/volumeSliceRenderer";
import { renderAnnotationLayer, type RenderSettings as AnnotationRenderSettings, type SimpleAnnotation } from "./data-renderers/annotationRenderer";
import { buildPathRenderer } from "./data-renderers/lineRenderer";
// gui stuff....
import { buttonH, DEFAULT_THEME, defGUI, Key, sliderH } from "@thi.ng/imgui";
import { gridLayout } from "@thi.ng/layout";
import { $canvas } from "@thi.ng/rdom-canvas";
import { fromDOMEvent, fromRAF, } from "@thi.ng/rstream";
import { gestureStream } from "@thi.ng/rstream-gestures";
import type { AnnotationLayer, CacheEntry, Layer, VolumeGridData } from "./types";
import { layerListUI } from "./ui/layer-list";
import { volumeSliceLayer } from "./ui/volume-slice-layer";
import { annotationUi } from "./ui/annotation-ui";
import { buildVersaRenderer, type AxisAlignedPlane } from "../../omezarr-viewer/src/versa-renderer";
const KB = 1000;
const MB = 1000 * KB;

async function loadJSON(url: string) {
    // obviously, we should check or something
    return fetch(url).then(stuff => stuff.json() as unknown as ColumnarMetadata)
}



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
        view: box2D;
        screen: vec2;
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
    private refreshRequested: number = 0;
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
        this.refreshRequested = 0;
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h]
        }
        this.initHandlers(canvas);
        this.cache = new AsyncDataCache<string, string, CacheEntry>(destroyer, sizeOf, 1000);
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
                this.regl, renderAnnotationLayer, [w, h]
            )
        })
    }
    addScatterplot(url: string, slideId: string, color: ColumnRequest) {
        return loadJSON(url).then((metadata) => {
            if (isSlideViewData(metadata)) {
                const dataset = loadDataset(metadata, url) as SlideViewDataset
                const [w, h] = this.camera.screen
                const layer = new ReglLayer2D<DynamicGridSlide & OptionalTransform, SlideRenderSettings<CacheEntry>>(
                    this.regl, renderSlide<CacheEntry>, [w, h]
                );
                this.layers.push({
                    type: 'scatterplot',
                    data: {
                        colorBy: color,
                        dataset,
                        dimensions: 2,
                        slideId,
                        type: 'DynamicGridSlide'
                    },
                    render: layer
                });
            }

        })
    }
    addVolumeSlice(url: string, plane: AxisAlignedPlane, param: number, gamut: ColorMapping, rotation: number, trn?: { offset: vec2 }) {
        const [w, h] = this.camera.screen
        return load(url).then((dataset) => {
            console.log('loaded up a layer: ', url)
            const layer = new ReglLayer2D<AxisAlignedZarrSlice & OptionalTransform, Omit<SliceRenderSettings<CacheEntry>, 'target'>>(
                this.regl, renderSlice<CacheEntry>, [w, h]
            );
            this.layers.push({
                type: 'volumeSlice',
                data: {
                    dataset,
                    dimensions: 2,
                    gamut,
                    plane,
                    planeParameter: param,
                    type: 'AxisAlignedZarrSlice',
                    rotation,
                    toModelSpace: trn ? { ...trn, scale: [1, 1] } : undefined
                },
                render: layer
            });
        })
    }
    addVolumeGrid(url: string, plane: AxisAlignedPlane, slices: number, gamut: ColorMapping, rotation: number, trn?: { offset: vec2 }) {
        const [w, h] = this.camera.screen
        const rowSize = Math.floor(Math.sqrt(slices));
        return load(url).then((dataset) => {
            const size = sizeInUnits(plane, dataset.multiscales[0].axes, dataset.multiscales[0].datasets[0]);
            const layer = new ReglLayer2D<VolumeGridData, Omit<SliceRenderSettings<CacheEntry>, 'target'>>(
                this.regl, renderGrid<CacheEntry>, [w, h]
            );
            this.layers.push({
                type: 'volumeGrid',
                data: {
                    dataset,
                    dimensions: 2,
                    gamut,
                    plane,
                    slices,
                    type: 'AxisAlignedZarrSlice',
                    rotation,
                    toModelSpace: trn ? { ...trn, scale: [1, 1] } : undefined
                },
                render: layer
            });


        })
    }
    private onCameraChanged() {
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
        const renderers = { volumeSlice: this.sliceRenderer, scatterplot: this.plotRenderer, annotationLayer: this.pathRenderer, volumeGrid: this.sliceRenderer, }
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
                        renderer: renderers[layer.type],
                    }
                })
            }
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
            this.imgRenderer({
                box: Box2D.toFlatArray(src.bounds),
                img: src.texture,
                target: null,
                view: Box2D.toFlatArray(this.camera.view)
            })
        }
        // this.ctx.drawImage(this.regl._gl.canvas, 0, 0);
    }
}

let theDemo: Demo;

function demoTime(thing: HTMLCanvasElement) {
    if (theDemo !== undefined) {
        return theDemo;
    }
    thing.width = thing.clientWidth;
    thing.height = thing.clientHeight;

    // const offscreen = new OffscreenCanvas(thing.width, thing.height);
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
    // theDemo.addVolumeSlice(scottpoc, 'xy', 0.5, {
    //     R: { index: 0, gamut: pretend },
    //     G: { index: 1, gamut: pretend },
    //     B: { index: 2, gamut: pretend }
    // }, 0 * Math.PI, { offset: [-5, -5] }).then(() =>
    //     theDemo.addScatterplot(merfish, slide32, colorByGene)).then(() => {
    //         theDemo.addAnnotation({
    //             paths: [

    //             ]
    //         })
    //     }).then(() => {
    //         theDemo.uiChange();
    //         buildGui(theDemo, document.getElementById('sidebar')!)
    //     })
    theDemo.addVolumeGrid(scottpoc, 'xy', 142, {
        R: { index: 0, gamut: pretend },
        G: { index: 1, gamut: pretend },
        B: { index: 2, gamut: pretend }
    }, 0 * Math.PI);

}
const slide32 = 'MQ1B9QBZFIPXQO6PETJ'
const colorByGene: ColumnRequest = { name: '88', type: 'QUANTITATIVE' }
const merfish = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_slide_view_02142024-20240223021524/DTVLE1YGNTJQMWVMKEU/ScatterBrain.json'
const ccf = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/mouse3/230524_transposed_1501/avg_template/'
const tissuecyte = "https://tissuecyte-visualizations.s3.amazonaws.com/data/230105/tissuecyte/1111175209/green/"
const tenx = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json'
const scottpoc = 'https://tissuecyte-ome-zarr-poc.s3.amazonaws.com/40_128_128/1145081396'

function buildGui(demo: Demo, sidebar: HTMLElement) {
    const gui = defGUI({
        theme: {
            ...DEFAULT_THEME,
            font: "16px 'IBM Plex Mono', monospace",
            baseLine: 6,
            focus: "#000",
        },
    });

    const initGUI = (el: HTMLCanvasElement) => {
        // unified mouse & touch event handling
        gestureStream(el).subscribe({
            next(e: any) {
                gui.setMouse(e.pos, e.buttons);
            },
        });
    };

    const updateGUI = () => {
        // create grid layout using https://thi.ng/layout
        // position grid centered in window
        const rowHeight = 32;
        const gap = 4;
        const grid = gridLayout(
            // start X position
            16,
            // start Y position (centered)
            (sidebar.clientHeight - (2 * rowHeight + gap)) / 2,
            // layout width
            sidebar.clientWidth - 32,
            // single column
            1,
            rowHeight,
            gap
        );
        // prep GUI for next frame
        gui.begin();
        layerListUI(gui, grid, demo.selectedLayer, demo.layers, (i) => demo.pickLayer(i));
        const curLayer = demo.layers[demo.selectedLayer];
        if (curLayer) {
            switch (curLayer.type) {
                case 'volumeSlice':
                    volumeSliceLayer(gui, grid, curLayer,
                        (i: number) => { curLayer.data = { ...curLayer.data, planeParameter: i }; demo.uiChange() },
                        (p: AxisAlignedPlane) => { curLayer.data = { ...curLayer.data, plane: p }; demo.uiChange() })
                    break;
                case 'annotationLayer':
                    annotationUi(gui, grid, demo.mode, curLayer,
                        (p: 'draw' | 'pan') => { demo.mode = p; demo.uiChange() })
                    break;
            }
        }
        // end frame
        gui.end();

        return gui;
    };
    const windowSize = fromDOMEvent(window, "resize", false, {
        init: <any>{},
    }).map(() => [sidebar.clientWidth, sidebar.clientHeight]);

    // canvas component
    $canvas(fromRAF().map(updateGUI), windowSize, {
        // execute above init handler when canvas has been mounted
        onmount: initGUI,
        style: {
            background: gui.theme.globalBg,
            // update cursor value each frame
            cursor: fromRAF().map(() => gui.cursor),
        },
        ...gui.attribs,
    }).mount(sidebar);
}
demoTime(document.getElementById('glCanvas') as HTMLCanvasElement)