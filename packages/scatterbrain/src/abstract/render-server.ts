import { AsyncDataCache } from '../dataset-cache';
import type { ReglCacheEntry } from './types';
import type { vec2 } from '@alleninstitute/vis-geometry'
import REGL from 'regl';
import { type RenderCallback } from './async-frame';
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
// todo... something less silly
function sizeOf(item: ReglCacheEntry) {
    return 1;
}
type ClientEntry = {
    frame: FrameLifecycle | null;
    image: REGL.Framebuffer2D;
}
type RFN = (target: REGL.Framebuffer2D | null, cache: AsyncDataCache<string, string, ReglCacheEntry>, callback: RenderCallback) => FrameLifecycle | null;
type Client = HTMLCanvasElement
export class RenderServer {
    private canvas: OffscreenCanvas;
    regl: REGL.Regl | null;
    cache: AsyncDataCache<string, string, ReglCacheEntry>
    private clients: Map<Client, ClientEntry>;
    private imageCopy: ReturnType<typeof buildImageCopy>
    constructor(maxSize: vec2, cacheEntryLimit: number = 4000) {
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
        this.cache = new AsyncDataCache<string, string, ReglCacheEntry>(destroyer, sizeOf, cacheEntryLimit)
    }
    private copyToClient(image: REGL.Framebuffer2D, client: Client) {
        try {
            // apocrapha: clearing a buffer before you draw to it can sometimes make things go faster
            this.regl?.clear({ framebuffer: null, color: [0, 0, 0, 0], depth: 1 })
            // regl command to draw the image to our actual canvas!
            this.imageCopy({ target: null, img: image })
            // then:
            // todo: I'm interested to see what happens when the source and dest are not the same size...
            // client.transferFromImageBitmap(this.canvas.transferToImageBitmap());
            /*
            const img = this.canvas.transferToImageBitmap()
            const ctx: CanvasRenderingContext2D = client.getContext('2d')!
            ctx.drawImage(img, 0, 0, client.width, client.height);
            img.close();
            */
            client.getContext('bitmaprenderer')!.transferFromImageBitmap(this.canvas.transferToImageBitmap());
        } catch (err) {
            console.error('hey - we tried to copy to a client buffer, but maybe it got unmounted? that can happen, its ok')
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
    beginRendering(renderFn: RFN, callback: RenderCallback, client: Client) {
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
            const hijack: RenderCallback = (e) => {
                switch (e.status) {
                    case 'begun':
                    case 'progress':
                        // copy the private buffer to the given canvas!
                        this.copyToClient(target, client)
                        break;
                    case 'finished':
                    case 'finished_synchronously':
                        // copy, and also clean up!
                        this.copyToClient(target, client)
                        this.clientFrameFinished(client);
                        break;
                }
                // call the user's callback...
                callback(e);
            }
            this.clients.set(client, {
                frame: renderFn(target, this.cache, hijack),
                image: target
            })
        }

    }


}