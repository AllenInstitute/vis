import { AsyncDataCache } from '../dataset-cache';
import type { ReglCacheEntry } from './types';
import { Vec2, type vec2 } from '@alleninstitute/vis-geometry'
import REGL from 'regl';
import { type AsyncFrameEvent, type RenderCallback } from './async-frame';
import { type FrameLifecycle } from '../render-queue';
import { buildImageCopy } from './image-copy';



function destroyer(item: ReglCacheEntry) {
    switch (item.type) {
        case 'texture':
            item.texture.destroy();
            break;
        case 'buffer':
            item.buffer.destroy();
            break;
    }
}
// return the size, in bytes, of some cached entity!
function sizeOf(item: ReglCacheEntry) {
    return Math.max(1, item.bytes ?? 0);
}
const oneMB = 1024 * 1024;

type ClientEntry = {
    frame: FrameLifecycle | null;
    image: REGL.Framebuffer2D;
    copyBuffer: ArrayBuffer;
    updateRequested: boolean;
}
type ServerActions = {
    copyToClient: () => void;
}
type RenderEvent<D, I> = AsyncFrameEvent<D, I> & { target: REGL.Framebuffer2D | null, server: ServerActions }
type ServerCallback<D, I> = (event: RenderEvent<D, I>) => void;
type RFN<D, I> = (target: REGL.Framebuffer2D | null, cache: AsyncDataCache<string, string, ReglCacheEntry>, callback: RenderCallback<D, I>) => FrameLifecycle | null;
type Client = HTMLCanvasElement
export class RenderServer {
    private canvas: OffscreenCanvas;
    private refreshRequested: boolean;
    regl: REGL.Regl | null;
    cache: AsyncDataCache<string, string, ReglCacheEntry>
    private clients: Map<Client, ClientEntry>;
    private imageCopy: ReturnType<typeof buildImageCopy>
    private requestAnimationFrame: (fn: () => void) => void;
    private maxSize: vec2
    constructor(maxSize: vec2, requestAnimationFrame: (fn: () => void) => void, cacheByteLimit: number = 2000 * oneMB,) {
        this.canvas = new OffscreenCanvas(10, 10); // we always render to private buffers
        this.clients = new Map();
        this.maxSize = maxSize;
        this.requestAnimationFrame = requestAnimationFrame;
        this.refreshRequested = false;
        const gl = this.canvas.getContext('webgl', {
            alpha: true,
            preserveDrawingBuffer: true, // because this is a multiplexed context, we should turn this to false: TODO
            antialias: true,
            premultipliedAlpha: true,
        });
        if (!gl) {
            throw new Error('WebGL not supported!');
        }
        const regl = REGL({
            gl,
            // TODO add extensions as arguments to the constructor of this server!
            extensions: ['ANGLE_instanced_arrays', 'OES_texture_float', 'WEBGL_color_buffer_float'],
        });
        this.regl = regl;
        this.imageCopy = buildImageCopy(regl);
        this.cache = new AsyncDataCache<string, string, ReglCacheEntry>(destroyer, sizeOf, cacheByteLimit)
    }
    private copyToClient(image: REGL.Framebuffer2D, buffer: ArrayBuffer, client: Client) {
        try {
            // read directly from the framebuffer to which we render:
            this.regl?.read({ framebuffer: image, x: 0, y: 0, width: client.width, height: client.height, data: new Uint8Array(buffer) })
            // then:
            const ctx: CanvasRenderingContext2D = client.getContext('2d')!
            const img = new ImageData(new Uint8ClampedArray(buffer), client.width, client.height);
            ctx.putImageData(img, 0, 0);
            // this is dramatically more performant than transferToBitmap() trickery - and uses way less memory!
        } catch (err) {
            console.error('error - we tried to copy to a client buffer, but maybe it got unmounted? that can happen, its ok')
        }
    }
    private onAnimationFrame() {
        if (this.refreshRequested) {
            for (const [client, entry] of this.clients) {
                if (entry.updateRequested) {
                    this.copyToClient(entry.image, entry.copyBuffer, client);
                    entry.updateRequested = false;
                }
            }
            this.refreshRequested = false;
        }
    }
    private requestCopyToClient(client: Client) {
        const c = this.clients.get(client);
        if (c) {
            if (!c.updateRequested) {
                c.updateRequested = true;
                if (!this.refreshRequested) {
                    this.refreshRequested = true;
                    this.requestAnimationFrame(() => this.onAnimationFrame());
                }
            }
        }
    }
    private clientFrameFinished(client: Client) {
        const C = this.clients.get(client);
        if (C) {
            C.frame = null;
        }
    }
    destroyClient(client: Client) {
        const C = this.clients.get(client);
        if (C) {
            C.frame?.cancelFrame();
        }
        this.clients.delete(client);
    }
    beginRendering<D, I>(renderFn: RFN<D, I>, callback: ServerCallback<D, I>, client: Client) {
        if (this.regl) {
            const clientFrame = this.clients.get(client);
            let image: REGL.Framebuffer2D | null = null;
            let copyBuffer: ArrayBuffer | null = null;
            if (clientFrame) {
                // we keep a client as the key to a map, however
                // clients are potentially mutable! we need to handle what happens if one is resized
                // TODO
                // maybe cancel the existing frame
                clientFrame.frame?.cancelFrame();
                image = clientFrame.image;

            }
            // either way - 
            const resolution = Vec2.min(this.maxSize, [client.width, client.height])
            const target = image ? image : this.regl.framebuffer(...resolution)
            copyBuffer = copyBuffer ? copyBuffer : new ArrayBuffer(resolution[0] * resolution[1] * 4);
            const hijack: RenderCallback<D, I> = (e) => {
                callback({ ...e, target, server: { copyToClient: () => { this.requestCopyToClient(client) } } });
                if (e.status === 'finished' || e.status === 'cancelled') {
                    this.clientFrameFinished(client);
                }
            }
            this.clients.set(client, {
                frame: renderFn(target, this.cache, hijack),
                image: target,
                copyBuffer,
                updateRequested: false
            })
        }

    }


}