

// // the api we want a client component to have:

// import type { vec2 } from "@alleninstitute/vis-geometry";
// import type { AsyncDataCache, FrameLifecycle, ReglCacheEntry, RenderCallback, RenderFn } from "@alleninstitute/vis-scatterbrain";
// import { uniqueId } from "lodash";
// import REGL from "regl";

// /*
// // client-vis.tsx

// const server = useContext(scatterbrainServer)
//     type RendererConstructor = (regl)=>(...props)=>Frame
//     const myRendererHandle = server.buildRenderer(RenderConstructor)
    
//     //....//
//     const canvas = useRef()
//     server.render(myRenderHandle, props, (bitmap:ImageBitmap)=>{...do whatever, then canvas.current.transferFromBitmap(bitmap); }))

//     return (<canvas ref=canvas/>)
// */

// // yeah, this is way to tied up in our little pseudo rendering framework...
// // it should be safe to hand out the cache as whole, as well as the regl context, as its mostly not stateful
// // the only problem is how to multiplex the shared canvas itself - after our clients have done some rendering
// // they want to (easily) draw that rendering in their own canvas with client.tranferFromBitmap(server.transferToBitmap)
// // so...

// type RSVR = {
//     regl: REGL.Regl;
//     cache: AsyncDataCache<string, string, ReglCacheEntry>
//     doRender: (rFn: (target: REGL.Framebuffer2D,) => FrameLifecycle, target: ImageBitmapRenderingContext)
// }


// // a stateful server that manages a shared canvas, supporting multiple client renderers
// // rendering is initiated manually by a client, however its expected for rendering to be an
// // asynchronous process, so frames are a long-lived "saga" that may write themselves to their
// // client repeatedly
// type RenderConstructor<D, S> = (regl: REGL.Regl) => RenderFn<D, S>

// type Renderer<Data, Settings> = {
//     destroy: (regl: REGL.Regl) => void;
//     render: (target: REGL.Framebuffer2D | null, data: Data, settings: Settings, callback: RenderCallback, cache: AsyncDataCache<) => FrameLifecycle
// }
// class RenderServer {
//     canvas: OffscreenCanvas;
//     regl: REGL.Regl | null;
//     // clients: Record<string, RenderFn<unknown,unknown>>
//     // renderers: Set<RenderConstructor<unknown,unknown>>
//     constructor(maxSize: vec2) {
//         this.canvas = new OffscreenCanvas(...maxSize);
//         const gl = this.canvas.getContext('webgl', {
//             alpha: true,
//             preserveDrawingBuffer: true,
//             antialias: true,
//             premultipliedAlpha: true,
//         });
//         if (!gl) {
//             throw new Error('WebGL not supported!');
//         }
//         const regl = REGL({
//             gl,
//             extensions: ['ANGLE_instanced_arrays', 'OES_texture_float', 'WEBGL_color_buffer_float'],
//         });
//         this.regl = regl;
//         // this.clients = {}
//         // this.renderers = new Set();
//     }

//     registerClient<Data, Settings>(renderBuilder: RenderConstructor<Data, Settings>, resolution: vec2) {
//         if (this.regl) {
//             const renderer = renderBuilder(this.regl);
//             const screen = this.regl.framebuffer(...resolution)
//             let runningFrame: FrameLifecycle | null = null;
//             // return a thing our client can call to initiate rendering, and handle its stages...
//             return (data: Data, settings: Readonly<Settings>) => {
//                 // todo: check data and settings for shallow equality - abort in-progress frames as needed...
//                 if (runningFrame) {
//                     runningFrame.cancelFrame('new frame!');
//                 }
//                 runningFrame = renderer(screen, data, settings);
//             }
//         }
//         return null;
//     }
// }