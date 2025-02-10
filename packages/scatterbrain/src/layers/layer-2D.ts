import { Box2D, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';
import type { FrameLifecycle, RenderCallback } from '../render-queue';
import { type BufferPair, swapBuffers } from './buffer-pair';
// a helper to render a 2D layer, using regl
import type { Image, ImageRenderer, RenderFn } from './types';

type EventType = Parameters<RenderCallback>[0];
type RequiredSettings = { camera: { view: box2D }; callback: RenderCallback };

export class ReglLayer2D<Renderable, RenderSettings extends RequiredSettings> {
    private buffers: BufferPair<Image>;
    private renderFn: RenderFn<Renderable, RenderSettings>;
    private runningFrame: FrameLifecycle | null;
    private regl: REGL.Regl;
    private renderImg: ImageRenderer;
    constructor(
        regl: REGL.Regl,
        imgRenderer: ImageRenderer,
        renderFn: RenderFn<Renderable, RenderSettings & RequiredSettings>,
        resolution: vec2,
    ) {
        this.buffers = {
            readFrom: {
                resolution,
                texture: regl.framebuffer(...resolution),
                bounds: undefined,
            },
            writeTo: {
                resolution,
                texture: regl.framebuffer(...resolution),
                bounds: undefined,
            },
        };
        this.renderImg = imgRenderer;
        this.regl = regl;
        this.runningFrame = null;
        this.renderFn = renderFn;
    }
    destroy() {
        this.runningFrame?.cancelFrame('destroy this layer');
        this.buffers.readFrom.texture.destroy();
        this.buffers.writeTo.texture.destroy();
    }
    renderingInProgress() {
        return this.runningFrame !== null;
    }

    getRenderResults(stage: 'prev' | 'cur') {
        return stage == 'cur' ? this.buffers.writeTo : this.buffers.readFrom;
    }
    onChange(
        props: {
            readonly data: Readonly<Renderable>;
            readonly settings: Readonly<RenderSettings>;
        },
        cancel = true,
    ) {
        if (cancel && this.runningFrame) {
            this.runningFrame.cancelFrame();
            this.runningFrame = null;
            const { readFrom, writeTo } = this.buffers;
            // copy our work to the prev-buffer...
            if (readFrom.bounds && writeTo.bounds && Box2D.intersection(readFrom.bounds, writeTo.bounds)) {
                const [width, height] = writeTo.resolution;
                this.renderImg({
                    box: Box2D.toFlatArray(writeTo.bounds),
                    img: writeTo.texture,
                    target: readFrom.texture,
                    viewport: {
                        x: 0,
                        y: 0,
                        width,
                        height,
                    },
                    view: Box2D.toFlatArray(readFrom.bounds),
                });
            }
            this.regl.clear({
                framebuffer: this.buffers.writeTo.texture,
                color: [0, 0, 0, 0],
                depth: 1,
            });
        }
        const { data, settings } = props;
        const { camera, callback } = settings;
        this.buffers.writeTo.bounds = camera.view;

        const wrapCallback: RenderSettings = {
            ...settings,
            callback: (ev: EventType) => {
                const { status } = ev;
                switch (status) {
                    case 'finished':
                    case 'finished_synchronously':
                        this.buffers = swapBuffers(this.buffers);
                        // only erase... if we would have cancelled...
                        if (cancel) {
                            this.regl.clear({
                                framebuffer: this.buffers.writeTo.texture,
                                color: [0, 0, 0, 0],
                                depth: 1,
                            });
                        }
                        this.runningFrame = null;
                        break;
                }
                callback?.(ev);
            },
        };
        this.runningFrame = this.renderFn(this.buffers.writeTo.texture, data, wrapCallback);
    }
}
