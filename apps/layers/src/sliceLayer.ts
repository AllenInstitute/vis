
// make a second layer type, then factor out what they have in common if it makes sense
import { AsyncDataCache, beginLongRunningFrame, type FrameLifecycle, type NormalStatus } from "@alleninstitute/vis-scatterbrain";
import type { Image } from "./types";
import type REGL from "regl";
import { Box2D, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import { swapBuffers, type BufferPair } from "~/bufferPair";
import type { ZarrDataset } from "~/loaders/ome-zarr/zarr-data";
import { cacheKeyFactory, getVisibleTiles, requestsForTile, type VoxelSliceRenderSettings, type VoxelTile, type buildVolumeSliceRenderer } from "../../omezarr-viewer/src/slice-renderer";
import type { Camera } from "../../omezarr-viewer/src/camera";


type RenderCallback = (event: { status: NormalStatus } | { status: 'error', error: unknown }) => void;
type Renderer = ReturnType<typeof buildVolumeSliceRenderer>;
type Cache = AsyncDataCache<string, string, REGL.Texture2D>
export function buildFrameFactory(cache: Cache, renderer: Renderer, dataset: ZarrDataset, regl: REGL.Regl) {

    return (camera: Camera, sliceParam: number, target: REGL.Framebuffer2D, callback: RenderCallback) => {
        // get the items:
        const items = getVisibleTiles(camera, 'xy', sliceParam, dataset);
        const frame = beginLongRunningFrame<REGL.Texture2D, VoxelTile, VoxelSliceRenderSettings>(5, 33,
            items.tiles, cache, {
            dataset,
            gamut: { min: 0, max: 500 },
            regl,
            rotation: (3 * Math.PI) / 2,
            target,
            view: camera.view,
            viewport: {
                x: 0, y: 0,
                width: camera.screen[0],
                height: camera.screen[1]
            },
        }, requestsForTile, renderer, callback, cacheKeyFactory);
        return frame;
    }
}

export class SliceLayer {
    private buffers: BufferPair<Image>;
    private runningFrame: FrameLifecycle | null;
    private regl: REGL.Regl;
    private onRenderUpdate: undefined | (() => void);
    private dataset: ZarrDataset;
    private frameMaker: ReturnType<typeof buildFrameFactory>;
    constructor(regl: REGL.Regl, cache: Cache, dataset: ZarrDataset, resolution: vec2, renderer: Renderer, onRenderProgress?: () => void) {
        this.buffers = {
            readFrom: { texture: regl.framebuffer(...resolution), bounds: Box2D.create([0, 0], [10, 10]) },
            writeTo: { texture: regl.framebuffer(...resolution), bounds: Box2D.create([0, 0], [10, 10]) }
        };
        this.dataset = dataset;
        this.onRenderUpdate = onRenderProgress;
        this.runningFrame = null;
        this.regl = regl;
        this.frameMaker = buildFrameFactory(cache, renderer, dataset, regl);
    }

    onChangeView(camera: Camera, sliceParam: number) {
        const { view } = camera;
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
        this.runningFrame = this.frameMaker(camera, sliceParam, this.buffers.writeTo.texture, (event: { status: NormalStatus } | { status: 'error', error: unknown }) => {
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