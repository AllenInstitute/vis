import { Box2D, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import type REGL from "regl";
import { swapBuffers, type BufferPair } from "../../common/src/bufferPair";
import type { Image } from "./types";
import type { FrameLifecycle, NormalStatus } from "@alleninstitute/vis-scatterbrain";
import type { Camera } from "./data-renderers/types";
import type { buildImageRenderer } from "../../omezarr-viewer/src/image-renderer";

type RenderFn<R, S> =
    (target: REGL.Framebuffer2D | null, thing: Readonly<R>, settings: Readonly<S>) => FrameLifecycle;
type ImageRenderer = ReturnType<typeof buildImageRenderer>
type RenderCallback = (event: { status: NormalStatus } | { status: 'error', error: unknown }) => void;
type EventType = Parameters<RenderCallback>[0]
type RequiredSettings = { camera: Camera, callback: RenderCallback }
/**
 * a class that makes it easy to manage rendering 2D layers using regl
 */
export class ReglLayer2D<Renderable, RenderSettings extends RequiredSettings> {
    private buffers: BufferPair<Image>;
    private renderFn: RenderFn<Renderable, RenderSettings>
    private runningFrame: FrameLifecycle | null;
    private regl: REGL.Regl;
    private renderImg: ImageRenderer
    constructor(regl: REGL.Regl, imgRenderer: ImageRenderer, renderFn: RenderFn<Renderable, RenderSettings & RequiredSettings>, resolution: vec2) {
        this.buffers = {
            readFrom: { texture: regl.framebuffer(...resolution), bounds: undefined },
            writeTo: { texture: regl.framebuffer(...resolution), bounds: undefined }
        };
        this.renderImg = imgRenderer
        this.regl = regl;
        this.runningFrame = null;
        this.renderFn = renderFn;
    }
    destroy() {
        this.runningFrame?.cancelFrame("destroy this layer");
        this.buffers.readFrom.texture.destroy();
        this.buffers.writeTo.texture.destroy();
    }
    renderingInProgress() { return this.runningFrame !== null }

    getRenderResults(stage: 'prev' | 'cur') {
        return stage == 'cur' ? this.buffers.writeTo : this.buffers.readFrom
    }
    onChange(props: {
        readonly data: Readonly<Renderable>;
        readonly settings: Readonly<RenderSettings>
    }) {

        if (this.runningFrame) {
            this.runningFrame.cancelFrame();
            this.runningFrame = null;
            const { readFrom, writeTo } = this.buffers;
            // copy our work to the prev-buffer...
            if (readFrom.bounds && writeTo.bounds && Box2D.intersection(readFrom.bounds, writeTo.bounds)) {
                this.renderImg({
                    box: Box2D.toFlatArray(writeTo.bounds),
                    img: writeTo.texture,
                    target: readFrom.texture,
                    view: Box2D.toFlatArray(readFrom.bounds)
                })
            }
            this.regl.clear({ framebuffer: this.buffers.writeTo.texture, color: [0, 0, 0, 0], depth: 1 })
        }
        const { data, settings } = props;
        const { camera, callback } = settings;
        this.buffers.writeTo.bounds = camera.view;


        const wrapCallback: RenderSettings =
        {
            ...settings,
            callback: (ev: EventType) => {
                const { status } = ev;
                switch (status) {
                    case 'finished':
                    case 'finished_synchronously':
                        this.buffers = swapBuffers(this.buffers);
                        this.regl.clear({ framebuffer: this.buffers.writeTo.texture, color: [0, 0, 0, 0], depth: 1 })
                        this.runningFrame = null;
                        break;
                }
                callback?.(ev);
            }
        };
        this.runningFrame = this.renderFn(this.buffers.writeTo.texture, data, wrapCallback);
    }

}
