import { Box2D, Vec2, type Interval, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { isSlideViewData, loadDataset, type ColumnData, type ColumnRequest, type ColumnarMetadata, type SlideViewDataset } from "~/loaders/scatterplot/scatterbrain-loader";
import REGL from "regl";
import { AsyncDataCache, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
import { buildRenderer } from "../../scatterplot/src/renderer";
import { buildImageRenderer } from "../../omezarr-viewer/src/image-renderer";
import { load, sizeInUnits } from "~/loaders/ome-zarr/zarr-data";
import { buildVolumeSliceRenderer, type AxisAlignedPlane } from "../../omezarr-viewer/src/slice-renderer";
import { ReglLayer2D } from "./layer";
import type { AxisAlignedZarrSlice, DynamicGridSlide, OptionalTransform, RenderCallback } from "./data-renderers/types";
import { renderSlide, type RenderSettings as SlideRenderSettings } from "./data-renderers/dynamicGridSlideRenderer";
import { renderSlice, type RenderSettings as SliceRenderSettings } from "./data-renderers/volumeSliceRenderer";
import { renderAnnotationLayer, type RenderSettings as AnnotationRenderSettings, type SimpleAnnotation } from "./data-renderers/annotationRenderer";
import { buildPathRenderer } from "./data-renderers/lineRenderer";
// gui stuff....
import { buttonH, DEFAULT_THEME, defGUI, Key, sliderH } from "@thi.ng/imgui";
import { gridLayout } from "@thi.ng/layout";
import { $canvas } from "@thi.ng/rdom-canvas";
import { fromDOMEvent, fromRAF, } from "@thi.ng/rstream";
import { gestureStream } from "@thi.ng/rstream-gestures";

const KB = 1000;
const MB = 1000 * KB;


type PtrState = {
    type: 'pen' | 'touch' | 'mouse'
    pressure: number;
    location: vec2;
}
const UserInputSources = ['pen', 'touch', 'mouse'] as const;

async function loadJSON(url: string) {
    // obviously, we should check or something
    return fetch(url).then(stuff => stuff.json() as unknown as ColumnarMetadata)
}

type CacheEntry = {
    type: 'texture2D';
    data: REGL.Texture2D
} | ColumnData;

type ScatterPlotLayer = {
    type: 'scatterplot'
    data: DynamicGridSlide & OptionalTransform,
    render: ReglLayer2D<DynamicGridSlide & OptionalTransform, SlideRenderSettings<CacheEntry>>
};

type VolumetricSliceLayer = {
    type: 'volumeSlice'
    data: AxisAlignedZarrSlice & OptionalTransform,
    render: ReglLayer2D<AxisAlignedZarrSlice & OptionalTransform, SliceRenderSettings<CacheEntry>>
};
type AnnotationLayer = {
    type: 'annotationLayer',
    data: SimpleAnnotation,
    render: ReglLayer2D<SimpleAnnotation & OptionalTransform, AnnotationRenderSettings>
}
type Layer = ScatterPlotLayer | VolumetricSliceLayer | AnnotationLayer;

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
class Demo {
    pretend(): number {
        for (const layer of this.layers) {
            if (layer.type === 'volumeSlice') {
                return layer.data.planeParameter
            }
        }
        return 0.0;
    }
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
    canvas: HTMLCanvasElement;
    mouse: 'up' | 'down'
    mousePos: vec2;
    cache: AsyncDataCache<string, string, CacheEntry>;
    imgRenderer: ReturnType<typeof buildImageRenderer>;
    plotRenderer: ReturnType<typeof buildRenderer>;
    sliceRenderer: ReturnType<typeof buildVolumeSliceRenderer>;
    pathRenderer: ReturnType<typeof buildPathRenderer>
    private refreshRequested: number = 0;
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
        this.canvas = canvas;
        // this.ctx = canvas.getContext('2d')!;
        this.mouse = 'up'
        this.regl = regl;
        this.mousePos = [0, 0]
        this.layers = [];
        this.pathRenderer = buildPathRenderer(regl);
        this.plotRenderer = buildRenderer(regl);
        this.imgRenderer = buildImageRenderer(regl);
        this.sliceRenderer = buildVolumeSliceRenderer(regl);
        this.refreshRequested = 0;
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h]
        }
        this.initHandlers(canvas);
        this.cache = new AsyncDataCache<string, string, CacheEntry>(destroyer, sizeOf, 1000);
        // window.setInterval(() => {
        //     window.requestAnimationFrame(() => {
        //         this.refreshScreen();
        //     })
        // }, 33)

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
    addVolumeSlice(url: string, plane: AxisAlignedPlane, param: number, gamut: Interval[]) {
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
        const renderers = { volumeSlice: this.sliceRenderer, scatterplot: this.plotRenderer, annotationLayer: this.pathRenderer }
        for (const layer of this.layers) {
            // TODO all cases are identical - dry it up!
            if (layer.type === 'scatterplot') {
                console.log('update scatterplot')
                layer.render.onChange({
                    data: layer.data,
                    settings: {
                        ...settings,
                        renderer: renderers[layer.type],
                    }
                })
            } else if (layer.type === 'volumeSlice') {
                console.log('update vSlice')
                layer.render.onChange({
                    data: layer.data,
                    settings: {
                        ...settings,
                        renderer: renderers[layer.type],
                    }
                })
            } else if (layer.type === 'annotationLayer') {
                console.log('update anno')
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
    theDemo = new Demo(thing, regl);
    theDemo.addVolumeSlice(ccf, 'xy', 0.5, [{ min: 0, max: 500 }]).then(() =>
        theDemo.addScatterplot(merfish, slide32, colorByGene)).then(() => {
            theDemo.addAnnotation({
                paths: [
                    {
                        bounds: Box2D.create([0, 0], [11, 11]), color: [1, 0, 0, 1], id: 33, points: [
                            [0, 0],
                            [3, 7],
                            [7, 3],
                            [11, 11]
                        ]
                    }
                ]
            })
        }).then(() => {
            buildGui(theDemo, document.getElementById('sidebar')!)
        })

}
const slide32 = 'MQ1B9QBZFIPXQO6PETJ'
const colorByGene: ColumnRequest = { name: '88', type: 'QUANTITATIVE' }
const merfish = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_slide_view_02142024-20240223021524/DTVLE1YGNTJQMWVMKEU/ScatterBrain.json'
const ccf = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/mouse3/230524_transposed_1501/avg_template/'
const tissuecyte = "https://tissuecyte-visualizations.s3.amazonaws.com/data/230105/tissuecyte/1111175209/green/"
const tenx = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json'


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
        // fromDOMEvent(window, "keydown").subscribe({
        //     next(e) {
        //         if (e.target !== document.body) return;
        //         if (
        //             e.key === Key.TAB ||
        //             e.key === Key.SPACE ||
        //             e.key === Key.UP ||
        //             e.key === Key.DOWN
        //         ) {
        //             e.preventDefault();
        //         }
        //         gui.setKey(e);
        //     },
        // });
        // fromDOMEvent(window, "keyup").subscribe({
        //     next(e) {
        //         gui.setKey(e);
        //     },
        // });
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
        const what = sliderH(gui, grid, 'neat', 0, 1, 0.01, demo.pretend(), "slice")
        if (what !== undefined) {
            Promise.resolve(3).then(() => demo.setSlice(what))
        }
        // end frame
        gui.end();

        return gui;
    };
    const windowSize = fromDOMEvent(sidebar, "resize", false, {
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