import { Box2D, Vec2, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import REGL from "regl";
import type { Camera } from "../common/camera";
import { createRoot } from "react-dom/client";
import { AsyncDataCache, ReglLayer2D } from "@alleninstitute/vis-scatterbrain";
import type { CacheEntry } from "../types";
import { buildImageRenderer } from "../common/image-renderer";
import { createUmapDataset, type UmapConfig, type UmapScatterplot } from "../data-sources/scatterplot/umap";
import type { OptionalTransform } from "../data-sources/types";
import { buildTaxonomyRenderer,renderTaxonomyUmap,type RenderSettings,type RenderSettings as TaxRenderSettings } from "./taxonomy-renderer";
import type { ColumnBuffer } from "~/common/loaders/scatterplot/scatterbrain-loader";
const flipBox = (box: box2D): box2D => {
    const { minCorner, maxCorner } = box;
    return { minCorner: [minCorner[0], maxCorner[1]], maxCorner: [maxCorner[0], minCorner[1]] };
};
const uiroot = createRoot(document.getElementById('sidebar')!);

// a demo for playing with constellation plot ideas.


// teh first ting to mess with is animating points through a heirarchy of positions...
// a cell has a class, subclass, cluster, and super cluster
// each value in those feature-types will now have a position associated with it - the centroid
// of that thing in umap space.


function destroyer(item: CacheEntry) {
    switch (item.type) {
        case 'texture2D':
        case 'vbo':
            item.data.destroy();
            break;
        case 'mesh':
            item.data.points.destroy();
            break;
        default:
            // @ts-expect-error
            console.error(item.data, 'implement a destroyer for this case!');
            break;
    }
}
function sizeOf(item: CacheEntry) {
    return 1;
}
export class Demo {
    camera: Camera;
    regl: REGL.Regl;
    canvas: HTMLCanvasElement;
    mouse: 'up' | 'down';
    mode: 'draw' | 'pan';
    mousePos: vec2;
    filterValue: number;
    suppression: number;
    layer: undefined | ReglLayer2D<UmapScatterplot,RenderSettings<CacheEntry>>;
    plot: UmapScatterplot | undefined;
    private refreshRequested: number = 0;
    cache: AsyncDataCache<string, string, CacheEntry>;
    imgRenderer: ReturnType<typeof buildImageRenderer>;
    taxRenderer: ReturnType<typeof buildTaxonomyRenderer>;
    // private redrawRequested: number = 0;
    contourScale: number
    pointSize: number;
    constructor(canvas: HTMLCanvasElement, regl:REGL.Regl){
        this.regl=regl;
        this.mode='pan'
        this.mouse='up'
        this.filterValue = 2;
        this.mousePos=[0,0];
        this.pointSize = 20;
        this.suppression=0.0;
        this.contourScale=1.0;
        this.canvas=canvas;
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h],
            projection: 'webImage',
        };
        this.imgRenderer=buildImageRenderer(regl);
        this.taxRenderer=buildTaxonomyRenderer(regl);
        this.cache = new AsyncDataCache<string, string, CacheEntry>(destroyer, sizeOf, 4000);
        this.initHandlers(canvas);

    }
    mouseButton(click: 'up' | 'down', pos: vec2) {
        this.mouse = click;
        
    }
    private toDataspace(px: vec2) {
        const { view } = this.camera;
        const o: vec2 = [px[0], this.canvas.clientHeight - px[1]];
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
                this.onCameraChanged();
            }
        }
        this.mousePos = Vec2.add(this.mousePos, delta);
    }
    zoom(scale: number) {
        const { view, screen } = this.camera;
        const m = Box2D.midpoint(view);
        this.camera = {
            ...this.camera,
            view: Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m),
            screen,
        };
        this.onCameraChanged();
    }
    getContourScale(){return this.contourScale}
    setContourScale(v:number){
        this.contourScale=v;
        this.requestReRender();
    }
    getPointSize(){return this.pointSize}
    setPointSize(v:number){
        this.pointSize=v;
        this.requestReRender();
    }
    getFilter(){return this.filterValue}
    setFilter(v:number){
        this.filterValue=v;
        this.requestReRender();
    }
    getSuppression(){return this.suppression}
    setSuppression(v:number){
        this.suppression=v;
        this.requestReRender();
    }
    private onCameraChanged(){
        if(this.layer && this.plot){
            this.layer?.onChange({
                data: this.plot,
                settings:{
                    animationParam: 0,
                    cache:this.cache,
                    callback: ()=>{},
                    camera:this.camera,
                    Class,
                    Cluster,
                    SubClass, // TODO!
                    SuperCluster,
                    dataset:this.plot.dataset,
                    pointSize: 14,
                    regl:this.regl,
                    renderer:this.taxRenderer
                }
            })
            this.requestReRender();
        }

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
            if(e.key==='w'){
                this.filterValue++;
                this.onCameraChanged();
            }else if(e.key==='s') {
                this.filterValue-=1;
                this.onCameraChanged();
            }
        }
    }
    loadData(config:UmapConfig){
        const [w, h] = this.camera.screen;
        return createUmapDataset(config).then((plot)=>{
            this.plot=plot;
            this.camera = {...this.camera,view:plot.dataset.bounds};
            this.layer = new ReglLayer2D<UmapScatterplot & OptionalTransform, RenderSettings<CacheEntry>>(
                this.regl,
                this.imgRenderer,
                renderTaxonomyUmap,
                [w, h]
            );
        });
    }
    requestReRender() {
        if (this.refreshRequested === 0) {
            this.refreshRequested = window.requestAnimationFrame(() => {
                this.refreshScreen();
                this.refreshRequested = 0;
                // uiroot?.render(TopoUi({ demo: this }));
            });
        }
    }
    refreshScreen(){
        this.regl.clear({framebuffer:null, color:[0,0,0,1], depth:1})
        if(this.layer){
            const img = this.layer.getRenderResults('prev');
            if(img.bounds){
            const flipped = Box2D.toFlatArray(flipBox(this.camera.view));
            // draw this to the screen (eventually, do that with the topo shader...)
            // this.contourRenderer({
            //     // box:Box2D.toFlatArray(img.bounds),
            //     heightmap:img.texture,
            //     color:[1,1,1,1],
            //     txStep:Vec2.div([1,1],img.resolution),
            //     target:null,
            //     cScale: 10/this.contourScale,
            //     view:Box2D.toFlatArray(this.camera.view)
            // })
            }

        }
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
    theDemo.loadData(fancy);
    theDemo.requestReRender();
}
const cls = 'FS00DXV0T9R1X9FJ4QE'
const superclass='QY5S8KMO5HLJUF0P00K'

const tenx =`https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json`
    // 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json';
const fancy: UmapConfig = {
    url: tenx,
    type: 'UmapConfig',
}
demoTime(document.getElementById('glCanvas') as HTMLCanvasElement);
