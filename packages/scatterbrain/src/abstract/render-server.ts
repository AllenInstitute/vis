import { AsyncDataCache } from '../dataset-cache';
import type { ReglCacheEntry } from './types';
import type { vec2 } from '@alleninstitute/vis-geometry'
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
    regl: REGL.Regl | null;
    cache: AsyncDataCache<string, string, ReglCacheEntry>
    private clients: Map<Client, ClientEntry>;
    private imageCopy: ReturnType<typeof buildImageCopy>
    constructor(maxSize: vec2, cacheByteLimit: number = 2000 * oneMB) {
        this.canvas = new OffscreenCanvas(...maxSize);
        this.clients = new Map();
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
    private copyToClient(image: REGL.Framebuffer2D, client: Client) {
        try {
            // apocrapha: clearing a buffer before you draw to it can sometimes make things go faster
            this.regl?.clear({ framebuffer: null, color: [0, 0, 0, 0], depth: 1 })
            // regl command to draw the image to our actual canvas!
            this.imageCopy({ target: null, img: image })
            // then:
            // const ctx: CanvasRenderingContext2D = client.getContext('2d')!
            // ctx.globalCompositeOperation = 'copy'
            // ctx.drawImage(this.canvas, 0, 0, client.width, client.height);
            client.getContext('bitmaprenderer')!.transferFromImageBitmap(this.canvas.transferToImageBitmap());
        } catch (err) {
            console.error('error - we tried to copy to a client buffer, but maybe it got unmounted? that can happen, its ok')
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
            if (clientFrame) {
                // maybe cancel the existing frame
                clientFrame.frame?.cancelFrame();
                image = clientFrame.image;
            }
            // either way - 
            const target = image ? image : this.regl.framebuffer(this.canvas.width, this.canvas.height)
            const hijack: RenderCallback<D, I> = (e) => {
                callback({ ...e, target, server: { copyToClient: () => { this.copyToClient(target, client) } } });
                if (e.status === 'finished' || e.status === 'cancelled') {
                    this.clientFrameFinished(client);
                }
            }
            this.clients.set(client, {
                frame: renderFn(target, this.cache, hijack),
                image: target
            })
        }

    }


}