import { AsyncDataCache, beginLongRunningFrame, type FrameLifecycle, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
import type { Image, Layer } from "./types";
import type { buildRenderer } from "../../scatterplot/src/renderer";
import type REGL from "regl";
import { Box2D, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { fetchItem, getVisibleItems, type Dataset, type RenderSettings } from "~/loaders/scatterplot/data";
import { type ColumnData, type ColumnarTree, loadDataset, type ColumnarMetadata } from "~/loaders/scatterplot/scatterbrain-loader";

async function loadJSON(url: string) {
    // obviously, we should check or something
    return fetch(url).then(stuff => stuff.json() as unknown as ColumnarMetadata)
}

type RenderCallback = (event: { status: NormalStatus } | { status: 'error', error: unknown }) => void;

export class ScatterplotLayer implements Layer<unknown> {
    private dataset: Dataset | undefined;
    private renderer: ReturnType<typeof buildRenderer>
    // this is a pattern that I should turn into a util:
    private prevFrame: Image;
    private curFrame: Image;

    regl: REGL.Regl
    private runningFrame: FrameLifecycle | null
    private camera: { view: box2D, screen: vec2 };
    private onRenderProgress: undefined | RenderCallback;
    constructor(renderer: ReturnType<typeof buildRenderer>, regl: REGL.Regl, url: string, renderProgressCallback?: RenderCallback) {
        this.renderer = renderer;
        this.runningFrame = null;
        this.regl = regl;
        this.onRenderProgress = renderProgressCallback;
        this.camera = {
            view: Box2D.create([0, 0], [1, 1]),
            screen: [100, 100]
        }
        this.prevFrame = this.allocImage(this.camera.view, this.camera.screen)
        this.curFrame = this.allocImage(this.camera.view, this.camera.screen)
        loadJSON(url).then((metadata) => {
            this.dataset = loadDataset(metadata, url);
            // todo: start rendering?
        })
    }
    private saveProgress() {
        // copy the current frame's info into the prev-frame!
        const tmp = this.prevFrame;
        this.prevFrame = this.curFrame;
        this.curFrame = { ...tmp, bounds: this.camera.view };
        this.regl.clear({ color: [0, 0, 0, 0], depth: 1 })
    }
    private allocImage(bounds: box2D, size: vec2) {
        return {
            texture: this.regl.framebuffer(...size),
            bounds
        }
    }
    private handleRenderEvents(event: { status: NormalStatus } | { status: 'error', error: unknown }) {
        switch (event.status) {
            case "error":
                throw event.error; // error boundary might catch this
            case "progress":
                break;
            case "finished_synchronously":
            case "finished":
                this.runningFrame = null;
                this.saveProgress();
                break;
            case "begun":
                break;
            case "cancelled":
                this.runningFrame = null;
                this.saveProgress();
                break;
            default:
                break;
        }

        if (this.onRenderProgress) {
            this.onRenderProgress(event);
        }
    }
    private rerender(cache: AsyncDataCache<string, string, ColumnData>) {
        if (!this.dataset) return;

        if (this.runningFrame !== null) {
            // cancel it I guess?
            this.runningFrame.cancelFrame('yay!');
        }
        const items = getVisibleItems(this.dataset, this.view, 10); // TODO compute correct px size in dataspace
        this.runningFrame = beginLongRunningFrame<ColumnData, ColumnarTree<vec2>, RenderSettings>(
            5, 33, items,
            cache, { dataset: this.dataset, view: this.view },
            fetchItem, this.renderer, this.handleRenderEvents, (reqKey, item, _settings) => `${reqKey}:${item.content.name}`)
    }
    update(state: any) {

    }
    getImage(): Image {
        return this.prevFrame;
    }
    cancel() {
        this.runningFrame?.cancelFrame();
    }



}