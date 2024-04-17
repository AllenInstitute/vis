import { Box2D, Vec2, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { isSlideViewData, loadDataset, type ColumnData, type ColumnRequest, type ColumnarMetadata, type SlideViewDataset } from "~/loaders/scatterplot/scatterbrain-loader";
import REGL from "regl";
import { AsyncDataCache, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
import { buildRenderer } from "../../scatterplot/src/renderer";
import { buildImageRenderer } from "../../omezarr-viewer/src/image-renderer";
import { load, sizeInUnits } from "~/loaders/ome-zarr/zarr-data";
import { buildVolumeSliceRenderer } from "../../omezarr-viewer/src/slice-renderer";
import { ReglLayer2D } from "./layer";
import type { AxisAlignedZarrSlice, DynamicGridSlide, OptionalTransform, RenderCallback } from "./data-renderers/types";
import { renderSlide, type RenderSettings as SlideRenderSettings } from "./data-renderers/dynamicGridSlideRenderer";
import { renderSlice, type RenderSettings as SliceRenderSettings } from "./data-renderers/volumeSliceRenderer";
const KB = 1000;
const MB = 1000 * KB;

async function loadJSON(url: string) {
    // obviously, we should check or something
    return fetch(url).then(stuff => stuff.json() as unknown as ColumnarMetadata)
}

type CacheEntry = {
    type:'texture2D';
    data: REGL.Texture2D
} | ColumnData;

type ScatterPlotLayer = {
    type:'scatterplot'
    data: DynamicGridSlide&OptionalTransform,
    render: ReglLayer2D<DynamicGridSlide&OptionalTransform, SlideRenderSettings<CacheEntry>>
};

type VolumetricSliceLayer = {
    type:'volumeSlice'
    data: AxisAlignedZarrSlice&OptionalTransform,
    render: ReglLayer2D<AxisAlignedZarrSlice&OptionalTransform, SliceRenderSettings<CacheEntry>>
};

type Layer = ScatterPlotLayer|VolumetricSliceLayer;

function destroyer(item:CacheEntry){
    if(item.type==='texture2D'){
        item.data.destroy();
    }
}
function sizeOf(item:CacheEntry){
    // todo: care about bytes later!
    return 1;
}
class Demo {
    camera: {
        view: box2D;
        screen: vec2;
    }
    layers: Layer[]
    regl: REGL.Regl;
    canvas: HTMLCanvasElement;
    mouse: 'up' | 'down'
    mousePos: vec2;
    cache: AsyncDataCache<string,string,CacheEntry>;
    imgRenderer: ReturnType<typeof buildImageRenderer>;
    plotRenderer: ReturnType<typeof buildRenderer>;
    sliceRenderer: ReturnType<typeof buildVolumeSliceRenderer>;

    private refreshRequested: number = 0;
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
        this.canvas = canvas;
        this.mouse = 'up'
        this.regl = regl;
        this.mousePos = [0, 0]
        this.layers = [];
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
        this.cache = new AsyncDataCache<string,string,CacheEntry>(destroyer,sizeOf,1000);
    }
    addScatterplot(url: string,slideId: string,color:ColumnRequest) {
        return loadJSON(url).then((metadata)=>{
            if(isSlideViewData(metadata)){
                const dataset = loadDataset(metadata,url) as SlideViewDataset
                const [w, h] = this.camera.screen
                const layer = new ReglLayer2D<DynamicGridSlide&OptionalTransform,SlideRenderSettings<CacheEntry>>(
                    this.regl,renderSlide<CacheEntry>,[w,h]
                );
                this.layers.push({
                    type:'scatterplot',
                    data:{
                        colorBy:color,
                        dataset,
                        dimensions:2,
                        slideId,
                        type:'DynamicGridSlide'
                    },
                    render:layer
                });
            }

        })
    }
    addVolumeSlice(url: string) {
        const [w, h] = this.camera.screen
        return load(url).then((dataset) => {
            console.log('loaded up a layer: ', url)
            console.log('volume slice size: ', sizeInUnits({u:'x',v:'y'},dataset.multiscales[0].axes,dataset.multiscales[0].datasets[0]));
            const layer = new ReglLayer2D<AxisAlignedZarrSlice&OptionalTransform,SliceRenderSettings<CacheEntry>>(
                this.regl,renderSlice<CacheEntry>,[w,h]
            );
            this.layers.push({
                type:'volumeSlice',
                data:{
                    dataset,
                    dimensions:2,
                    gamut:[{min:0,max:500}],
                    plane:'xy',
                    planeParameter:0.5,
                    type:'AxisAlignedZarrSlice',
                },
                render:layer
            });
        })
    }
    private onCameraChanged() {
        const {cache,camera}=this;
        const drawOnProgress:RenderCallback = (e:{status:NormalStatus}|{status:'error',error:unknown})=>{
            const {status}=e;
            switch(status){
                case 'finished':
                case 'progress':
                case 'finished_synchronously':
                case 'begun': 
                this.requestReRender();
                break;
            }
        }
        for (const layer of this.layers) {
            if(layer.type==='scatterplot'){
                layer.render.onChange({
                    data:layer.data,
                    settings:{
                        cache,
                        camera,
                        callback:drawOnProgress,
                        renderer:this.plotRenderer,
                        target:layer.render.getRenderResults('cur').texture,
                    }
                })
            }else if(layer.type==='volumeSlice'){
                layer.render.onChange({
                    data:layer.data,
                    settings:{
                        cache,
                        camera,
                        regl:this.regl,
                        callback:drawOnProgress,
                        renderer:this.sliceRenderer,
                        target:layer.render.getRenderResults('cur').texture,
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
            const src = layer.render.getRenderResults('prev');
            this.imgRenderer({
                box: Box2D.toFlatArray(src.bounds),
                img: src.texture,
                target: null,
                view: Box2D.toFlatArray(this.camera.view)
            })
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
        extensions: ["ANGLE_instanced_arrays", "OES_texture_float", "WEBGL_color_buffer_float"],
    });
    const canvas: HTMLCanvasElement = regl._gl.canvas as HTMLCanvasElement;
    theDemo = new Demo(canvas, regl);
    theDemo.addVolumeSlice(ccf).then(()=>
    theDemo.addScatterplot(merfish,slide32,colorByGene))
}
const slide32 = 'MQ1B9QBZFIPXQO6PETJ'
const colorByGene:ColumnRequest={name:'88',type:'QUANTITATIVE'}
const merfish='https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_slide_view_02142024-20240223021524/DTVLE1YGNTJQMWVMKEU/ScatterBrain.json'
const ccf = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/mouse3/230524_transposed_1501/avg_template/'
const tissuecyte = "https://tissuecyte-visualizations.s3.amazonaws.com/data/230105/tissuecyte/1111175209/green/"
const tenx = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json'
demoTime();