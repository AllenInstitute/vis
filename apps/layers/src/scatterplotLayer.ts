import { AsyncDataCache, beginLongRunningFrame, type FrameLifecycle, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
import type { Image } from "./types";
import { buildRenderer as buildScatterplotRenderer } from "../../scatterplot/src/renderer";
import type REGL from "regl";
import { Box2D, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { fetchItem, getVisibleItems, type Dataset, type RenderSettings } from "~/loaders/scatterplot/data";
import { type ColumnData, type ColumnarTree, loadDataset, type ColumnarMetadata } from "~/loaders/scatterplot/scatterbrain-loader";
import { buildImageRenderer } from "../../omezarr-viewer/src/image-renderer";


type RenderCallback = (event: { status: NormalStatus } | { status: 'error', error: unknown }) => void;

type Cache = AsyncDataCache<string, string, ColumnData>
type Renderer = ReturnType<typeof buildScatterplotRenderer>
export function buildFrameFactory(cache: Cache, renderer: Renderer, dataset: Dataset) {

    return (view: box2D, target: REGL.Framebuffer2D, callback: RenderCallback) => {
        // get the items:
        const items = getVisibleItems(dataset, view, 1);
        const frame = beginLongRunningFrame(5, 33, items, cache, { view, dataset, target }, fetchItem, renderer, callback, (reqKey, item, _settings) => `${reqKey}:${item.content.name}`);
        return frame;
    }
}

export type BufferPair<T> = {
    writeTo: T;
    readFrom: T;
}
export function swapBuffers<T>(doubleBuffer: BufferPair<T>) {
    const { readFrom, writeTo } = doubleBuffer;
    return { readFrom: writeTo, writeTo: readFrom };
}

export class ScLayer {
    private buffers: BufferPair<Image>;
    private frameMaker: ReturnType<typeof buildFrameFactory>;
    private runningFrame: FrameLifecycle | null;
    private regl: REGL.Regl;
    private imgRenderer: ReturnType<typeof buildImageRenderer>;
    private onRenderUpdate: undefined | (() => void);
    constructor(regl: REGL.Regl, cache: Cache, dataset: Dataset, resolution: vec2, imageRenderer: ReturnType<typeof buildImageRenderer>, plotRenderer: ReturnType<typeof buildScatterplotRenderer>, onRenderProgress?: () => void) {
        this.buffers = {
            readFrom: { texture: regl.framebuffer(...resolution), bounds: Box2D.create([0, 0], [10, 10]) },
            writeTo: { texture: regl.framebuffer(...resolution), bounds: Box2D.create([0, 0], [10, 10]) }
        };
        this.onRenderUpdate = onRenderProgress;
        this.runningFrame = null;
        this.regl = regl;

        this.imgRenderer = imageRenderer

        this.frameMaker = buildFrameFactory(cache, plotRenderer, dataset);
    }
    resize(res: vec2) {
        // allocate new buffers!
        if (this.runningFrame) {
            this.runningFrame.cancelFrame();
        }
        this.buffers.readFrom.texture.destroy();
        this.buffers.writeTo.texture.destroy();
        // TODO: WE COULD copy the old ones to the new to reduce flickering in this case...
        this.buffers.readFrom.texture = this.regl.framebuffer(...res)
        this.buffers.writeTo.texture = this.regl.framebuffer(...res)
        // TODO start a new frame if we inturrupted one that was in progress
        if (this.runningFrame) {
            this.runningFrame = null;
            this.onChangeView(this.buffers.writeTo.bounds);
        }
    }
    destroy() {
        if (this.runningFrame) {
            this.runningFrame.cancelFrame();
        }
        this.buffers.readFrom.texture.destroy();
        this.buffers.writeTo.texture.destroy();
    }
    onChangeView(view: box2D) {

        // start a new frame with the new settings...
        // this.buffers = swapBuffers(this.buffers);
        if (this.runningFrame) {
            this.runningFrame.cancelFrame();
            this.runningFrame = null;
            // this.buffers = swapBuffers(this.buffers);
            this.regl.clear({ framebuffer: this.buffers.writeTo.texture, color: [0, 0, 0, 0], depth: 1 })
        }
        // mutate our write-to buffer:
        this.buffers.writeTo.bounds = view;
        this.runningFrame = this.frameMaker(view, this.buffers.writeTo.texture, (event: { status: NormalStatus } | { status: 'error', error: unknown }) => {
            const { status } = event;
            switch (status) {
                case 'finished':
                case 'finished_synchronously':
                    // "copy" write-to to read-from...
                    this.buffers = swapBuffers(this.buffers);
                    this.regl.clear({ framebuffer: this.buffers.writeTo.texture, color: [0, 0, 0, 0], depth: 1 })


                    this.onRenderUpdate?.();
                    this.runningFrame = null;
                    break;
                case 'progress':
                    this.onRenderUpdate?.();
                    break;
            }
        });
    }
    renderingInProgress() { return this.runningFrame !== null }
    getRenderResults(stage: 'prev' | 'cur') {
        return stage == 'cur' ? this.buffers.writeTo : this.buffers.readFrom
    }
}