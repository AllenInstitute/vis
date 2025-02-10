import { AsyncDataCache } from '../dataset-cache';
import type { ReglCacheEntry } from './types';
import { Vec2, type vec2 } from '@alleninstitute/vis-geometry';
import REGL from 'regl';
import { type AsyncFrameEvent, type RenderCallback } from './async-frame';
import { type FrameLifecycle } from '../render-queue';

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
    resolution: vec2;
    copyBuffer: ArrayBuffer;
    updateRequested: Compositor | null;
};
type ServerActions = {
    copyToClient: (composite: Compositor) => void;
};
type Compositor = (ctx: CanvasRenderingContext2D, glImage: ImageData) => void;
type RenderEvent<D, I> = AsyncFrameEvent<D, I> & {
    target: REGL.Framebuffer2D | null;
    server: ServerActions;
};
type ServerCallback<D, I> = (event: RenderEvent<D, I>) => void;
type RenderFrameFn<D, I> = (
    target: REGL.Framebuffer2D | null,
    cache: AsyncDataCache<string, string, ReglCacheEntry>,
    callback: RenderCallback<D, I>,
) => FrameLifecycle | null;

type Client = HTMLCanvasElement;
export class RenderServer {
    private canvas: OffscreenCanvas;
    private refreshRequested: boolean;
    regl: REGL.Regl | null;
    cache: AsyncDataCache<string, string, ReglCacheEntry>;
    private clients: Map<Client, ClientEntry>;
    private maxSize: vec2;
    constructor(maxSize: vec2, extensions: string[], cacheByteLimit: number = 2000 * oneMB) {
        this.canvas = new OffscreenCanvas(10, 10); // we always render to private buffers, so we dont need a real resolution here...
        this.clients = new Map();
        this.maxSize = maxSize;
        this.refreshRequested = false;
        const gl = this.canvas.getContext('webgl', {
            alpha: true,
            preserveDrawingBuffer: false,
            antialias: true,
            premultipliedAlpha: true,
        });
        if (!gl) {
            throw new Error('WebGL not supported!');
        }
        const regl = REGL({
            gl,
            extensions,
        });
        this.regl = regl;
        this.cache = new AsyncDataCache<string, string, ReglCacheEntry>(destroyer, sizeOf, cacheByteLimit);
    }
    private copyToClient(frameInfo: ClientEntry, client: Client) {
        // note: compared transferImageFromBitmap(transferImageToBitmap()), drawImage(canvas) and a few other variations
        // this method seems to have the most consistent performance across various browsers
        const { resolution, copyBuffer, image, updateRequested } = frameInfo;
        const [width, height] = resolution;
        if (updateRequested) {
            try {
                // read directly from the framebuffer to which we render:
                this.regl?.read({
                    framebuffer: image,
                    x: 0,
                    y: 0,
                    width,
                    height,
                    data: new Uint8Array(copyBuffer),
                });
                // then put those bytes in the client canvas:
                const ctx: CanvasRenderingContext2D = client.getContext('2d')!;
                const img = new ImageData(new Uint8ClampedArray(copyBuffer), width, height);
                updateRequested(ctx, img);
            } catch (err) {
                console.error(
                    'error - we tried to copy to a client buffer, but maybe it got unmounted? that can happen, its ok',
                );
            }
        }
    }
    private onAnimationFrame() {
        if (this.refreshRequested) {
            for (const [client, entry] of this.clients) {
                if (entry.updateRequested) {
                    this.copyToClient(entry, client);
                    // mark our progress:
                    entry.updateRequested = null;
                }
            }
            this.refreshRequested = false;
        }
    }
    private requestComposition(client: Client, composite: Compositor) {
        const c = this.clients.get(client);
        if (c) {
            if (!c.updateRequested) {
                c.updateRequested = composite;
                if (!this.refreshRequested) {
                    this.refreshRequested = true;
                    // as of 2023, requestAnimationFrame should be generally available globally in both workers* and a window
                    // if this becomes an issue, we can have our caller pass requestAnimationFrame in to the constructor
                    requestAnimationFrame(() => this.onAnimationFrame());
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
    private prepareToRenderToClient(client: Client) {
        const previousEntry = this.clients.get(client);
        if (previousEntry) {
            previousEntry.updateRequested = null;
            // the client is mutable - so every time we get a request, we have to check to see if it got resized
            if (client.width !== previousEntry.resolution[0] || client.height !== previousEntry.resolution[1]) {
                // handle resizing by deleting previously allocated resources:
                previousEntry.image.destroy();
                // the rest will get GC'd normally
            } else {
                // use the existing resources!
                return previousEntry;
            }
        }
        const resolution = Vec2.min(this.maxSize, [client.width, client.height]);
        const copyBuffer = new ArrayBuffer(resolution[0] * resolution[1] * 4);
        const image = this.regl!.framebuffer(...resolution);
        return { resolution, copyBuffer, image };
    }
    beginRendering<D, I>(renderFn: RenderFrameFn<D, I>, callback: ServerCallback<D, I>, client: Client) {
        if (this.regl) {
            const clientFrame = this.clients.get(client);
            if (clientFrame && clientFrame.frame) {
                clientFrame.frame.cancelFrame();
                this.regl.clear({
                    framebuffer: clientFrame.image,
                    color: [0, 0, 0, 0],
                    depth: 0,
                });
                clientFrame.updateRequested = null;
            }
            const { image, resolution, copyBuffer } = this.prepareToRenderToClient(client);
            const hijack: RenderCallback<D, I> = (e) => {
                callback({
                    ...e,
                    target: image,
                    server: {
                        copyToClient: (compose: Compositor) => {
                            this.requestComposition(client, compose);
                        },
                    },
                });
                if (e.status === 'finished' || e.status === 'cancelled') {
                    this.clientFrameFinished(client);
                }
            };
            this.clients.set(client, {
                frame: null,
                image,
                copyBuffer,
                resolution,
                updateRequested: null,
            });
            // this is worded rather awkwardly, because sometimes the frameLifecycle object returned by renderFn() represents
            // a frame that is already finished!
            // this is a good thing for performance, but potentially confusing - so we do our book-keeping before we actually start rendering:
            const aboutToStart = this.clients.get(client); // this is the record we just put into the clients map - TS just wants to be sure it really exists:
            if (aboutToStart) {
                const frame = renderFn(image, this.cache, hijack);
                if (frame) {
                    aboutToStart.frame = {
                        cancelFrame: (reason?: string) => {
                            frame.cancelFrame(reason);
                            aboutToStart.updateRequested = null;
                        },
                    };
                }
            }
        }
    }
}
