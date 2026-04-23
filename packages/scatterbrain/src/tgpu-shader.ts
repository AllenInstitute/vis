
// lets try and make not a full-fledged scatterbrain shader,
// with all its fancy filtering, hovering, dot sizes, etc
// but instead, some subplot shaders - so we render the dots,
// but we have no fancy filtering, just a simple highlight value,
// and a color-by attribute


// and lets try it with typeGPU generating our shaders for us... which I must admit seems pretty good...

import tgpu, { d, std, type TgpuRoot } from 'typegpu';
import { buildScatterbrainCacheClient } from './cache-client';
import type { ShaderSettings } from './shader';
import type { ColumnRequest, ScatterbrainDataset, SlideviewScatterbrainDataset } from './types';
import { uniq } from 'lodash';
import { SharedPriorityCache, type Cacheable } from '@alleninstitute/vis-core';
import type { WebGLSafeBasicType } from './typed-array';
import { getVisibleItems, loadDataset, type NodeWithBounds } from './dataset';
import { Box2D, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import { pl } from 'zod/locales';




// it seems like we can define a shader (and it will get actually created lazily)
// without needing an upfront instance of a gpu device... thats handy.

// except... realistically, main functions will probably need uniforms!
// we can pull those in, but you need a root to even have one...
// so - 

// uh ok this is hard to read, but tgpu.vertexFn({in,out})
// returns a function which we call immediately,
// passing it another function, which is given the things in in, and must return the things in out
// type wtf = d.unstruct({clip:d.vec2f,position:d.vec2f,colorBy:d.u16,highlightBy:d.u16 })
// const wtf = d.unstruct({clip:d.vec2f,position:d.vec2f,colorBy:d.u32,highlightBy:d.u32 })
// const vmain = tgpu.vertexFn({
//   in: {clip:d.vec2f,position:d.vec2f,colorBy:d.u32,highlightBy:d.u32},
//   out: { pos: d.builtin.position, uv: d.vec2f },
//   uniform: {}
// })(({clip,position,highlightBy,colorBy}) => {
//   const pos = [d.vec2f(0, 0.8), d.vec2f(-0.8, -0.8), d.vec2f(0.8, -0.8)];
//   const uv = [d.vec2f(0.5, 1), d.vec2f(0, 0), d.vec2f(1, 0)];

//   return {
//     pos: d.vec4f(1,0, 0, 1),
//     uv: d.vec2f(0.5,0.5),
//   };
// });

// lets find this after the build step runs?
// export function whatever() {
//     const View = d.struct({ min: d.vec2f, max: d.vec2f })
//     const myLayout = tgpu.bindGroupLayout({ view: { uniform: View }, highlight: { uniform: d.u32 } });
//     // function vmain() {
//     //     'use gpu';

//     // }
//     const vmain = tgpu.vertexFn({
//         in: { clip: d.vec2f, position: d.vec2f, colorBy: d.u32, highlightBy: d.u32 },
//         out: { pos: d.builtin.position, color: d.vec4f },
//     })(function ({ clip, position, highlightBy, colorBy }) {
//         'use gpu';
//         const size = std.sub(myLayout.$.view.max, myLayout.$.view.min)
//         const p = std.div(std.sub(position, myLayout.$.view.min), size);
//         const clr = std.mix(d.vec4f(0, 0, 0, 1), d.vec4f(1, 0, 0, 1), std.abs(std.sub(highlightBy, myLayout.$.highlight)))
//         return {
//             pos: d.vec4f(p.xy, 0, 1),
//             color: clr,
//         };
//     });

//     const { code, usedBindGroupLayouts, catchall } = tgpu.resolveWithContext({
//         externals: { vmain }, template:
//     /*wgsl*/`
//     @vertex
//     vmain
//     ` })

//     console.log(code)
//     console.log(usedBindGroupLayouts)
//     console.log(catchall)
// }
// whatever();


// lets build an oh-so-basic typeGPU renderer for scatterbrain data...
export type SimpleSettings = {
    dataset: ScatterbrainDataset | SlideviewScatterbrainDataset;
    highlightBy: { kind: 'metadata', column: string }; // the name of a categorical feature by which to highlight
    colorBy: { kind: 'metadata', column: string }
}
class VBO implements Cacheable {
    constructor(readonly buffer: GPUBuffer) {
    }
    destroy() {
        this.buffer.destroy();
    }
    sizeInBytes() {
        return this.buffer.size;
    }
}
// const dType = {
//     uint8: d.uint8,
//     uint16: d.u16,
//     uint32: d.u32,
//     int8: d.i32,
//     int16: d.sint16,
//     int32: d.i32,
//     float: d.f32,
// } as const;

// annoying hurdle 1 - I dont know how to use root.createBuffer() correctly to upload my raw bytes
type RenderProps = {
    camera: { view: box2D, screenResolution: vec2 }
    dataset: ScatterbrainDataset | SlideviewScatterbrainDataset;
    client: ReturnType<typeof buildScatterbrainCacheClient<VBO>>;
    visibilityThresholdPx: number;
    ctx: GPUCanvasContext
};

export function buildScatterbrainTGPU(root: TgpuRoot, settings: SimpleSettings) {
    const toGpuBuffer = (buffer: ArrayBuffer, _type: WebGLSafeBasicType) => {
        const B = root.device.createBuffer({ size: buffer.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX });
        root.device.queue.writeBuffer(B, 0, buffer);
        return new VBO(B);
    }
    const prepareQtCell = columnsForItem<NodeWithBounds>(settings);
    const drawQtCell = buildRenderFn(root);
    const render = (props: RenderProps) => {
        const { camera, dataset, client, visibilityThresholdPx } = props;
        const visibilityThreshold = (visibilityThresholdPx * Box2D.size(camera.view)[0]) / camera.screenResolution[0]; // (units*pixel)/pixel ==> units
        const visibleQtNodes = getVisibleItems(dataset, camera, visibilityThreshold).map(prepareQtCell);
        client.setPriorities(visibleQtNodes, []);
        console.log("visible: ", visibleQtNodes.length)
        for (const node of visibleQtNodes) {
            if (client.has(node)) {
                const drawable = client.get(node);
                if (drawable) {
                    console.log('draw it: ', node.node.file)
                    drawQtCell({
                        count: node.node.numSpecimens / 2, // todo this is bug, I cant figure out how to set the attrib layout correctly... I think
                        columns: drawable,
                        ctx: props.ctx,
                        highlight: 22,
                        radius: .05,
                        view: props.camera.view,
                    })
                    // drawQtCell({
                    //     ...props,
                    //     item: {
                    //         columnData: drawable,
                    //         count: node.node.numSpecimens,
                    //     },
                    // });
                }
            }
        }
    }

    const connectToCache = (cache: SharedPriorityCache, onDataArrived: () => void) => {
        return buildScatterbrainCacheClient(['position', 'colorBy', 'highlightBy'], cache, toGpuBuffer, onDataArrived);
    };

    return { render, connectToCache };

}

function columnsForItem<T extends object>(
    config: SimpleSettings,
) {
    const columns: Record<string, ColumnRequest> = {
        position: { type: 'METADATA', name: config.dataset.metadata.spatialColumn },
        colorBy: { type: 'METADATA', name: config.colorBy.column },
        highlightBy: { type: 'METADATA', name: config.highlightBy.column }
    };

    return (item: T) => {
        return { ...item, dataset: config.dataset, columns };
    };
}

function buildRenderFn(root: TgpuRoot) {
    // ok - heres where we do the thing, which is to create a pipeline
    // and return a function that invokes it...

    const View = d.struct({ min: d.vec2f, max: d.vec2f })
    const Vertex = { vIndex: d.builtin.vertexIndex, position: d.vec2f, highlightBy: d.u32 }
    const unis = tgpu.bindGroupLayout({ view: { uniform: View }, highlight: { uniform: d.u32 }, radius: { uniform: d.f32 } });

    // ok because we dont use interleaved buffers
    // we have to hand-roll the layouts - do we need locations here?
    const pLayout = tgpu.vertexLayout(d.arrayOf(d.vec2f), 'instance')
    const hLayout = tgpu.vertexLayout(d.arrayOf(d.u32), 'instance')

    const vmain = tgpu.vertexFn({
        in: Vertex,
        out: { pos: d.builtin.position, color: d.vec4f },
    })(function ({ vIndex, position, highlightBy }) {
        'use gpu';
        const clip = [d.vec2f(1, -1), d.vec2f(1, 1), d.vec2f(-1, -1), d.vec2f(-1, 1)];
        const size = std.sub(unis.$.view.max, unis.$.view.min);
        const dP = std.add(position, std.mul(clip[vIndex], unis.$.radius));
        const p = std.sub(std.mul(std.div(std.sub(dP, unis.$.view.min), size), 2), 1);
        const clr = std.mix(d.vec4f(1, 0, 0, 1), d.vec4f(0.5, 0.5, 0.5, 1), std.step(0.001, std.abs(std.sub(highlightBy, unis.$.highlight))))
        return {
            pos: d.vec4f(p.xy, 0, 1),
            color: clr,
        };
    });

    const fmain = tgpu.fragmentFn({ in: { pos: d.builtin.position, color: d.vec4f }, out: d.vec4f })(function ({ color }) {
        return color;
    });

    // lets create some uniforms...
    const view = root.createUniform(View)
    const highlight = root.createUniform(d.u32)
    const radius = root.createUniform(d.f32)

    const bg = root.createBindGroup(unis, {
        view: view.buffer,
        highlight: highlight.buffer,
        radius: radius.buffer
    })
    // this next part - it does pick up the types from
    // the vertex shader... but some other stuff is mysterious
    // also raw createPipeline has a fair bit of type-safety, although its
    // true it cant line up named attribs, it only works by location index
    const pipeline = root.createRenderPipeline({
        vertex: vmain,
        fragment: fmain,
        attribs: {
            highlightBy: hLayout.attrib,
            position: pLayout.attrib,
        },
        primitive: { topology: 'triangle-strip', cullMode: 'back' },
        // depthStencil: {
        //     format: 'depth24plus',
        //     depthWriteEnabled: true,
        //     depthCompare: 'less',
        // },
    })
    console.log(root.unwrap(pipeline))
    return (props: { view: box2D, radius: number, highlight: number, count: number, ctx: GPUCanvasContext, columns: Record<string, VBO> }) => {
        // write the unis...
        const { position, highlightBy } = props.columns;
        view.patch({ min: props.view.minCorner, max: props.view.maxCorner }); // ugh
        highlight.patch(props.highlight);
        radius.patch(props.radius);
        pipeline
            .with(bg)
            .withColorAttachment({ view: props.ctx, loadOp: 'load', })
            .with(pLayout, position.buffer)
            .with(hLayout, highlightBy.buffer)
            .draw(4, props.count);
    }
}


const tenx =
    'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json';
const Class = 'FS00DXV0T9R1X9FJ4QE'

async function loadRawJson() {
    return await (await fetch(tenx)).json();
}

export async function whatever() {
    const root = await tgpu.init()
    // const r = buildRenderFn(root)
    const dataset = await loadDataset(await loadRawJson())
    if (!dataset) {
        throw new Error('blerg this data is toast')
    }
    const cache = new SharedPriorityCache(new Map(), 1024 * 1024 * 2000);
    const { render, connectToCache } = buildScatterbrainTGPU(root, { colorBy: { kind: 'metadata', column: Class }, highlightBy: { kind: 'metadata', column: Class }, dataset })
    // const toGpuBuffer = (buffer: ArrayBuffer, _type: WebGLSafeBasicType) => {
    //     const B = root.device.createBuffer({ size: buffer.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX });
    //     root.device.queue.writeBuffer(B, 0, buffer);
    //     return new VBO(B);
    // }

    const cnvs: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
    cnvs.width = 1500;
    cnvs.height = 1500;
    const ctx = cnvs.getContext('webgpu')
    ctx?.configure({
        device: root.device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied'
    })
    const bound = (dataset as ScatterbrainDataset).metadata.tightBoundingBox;
    const view = Box2D.create([bound.lx, bound.ly], [bound.ux, bound.uy]);
    const client = connectToCache(cache, () => {
        // redraw?
        console.log('new data arrived...')
        requestAnimationFrame(() => {
            console.log('re render!')
            render({ camera: { view, screenResolution: [1500, 1500] }, client, ctx: ctx!, dataset, visibilityThresholdPx: 10 })
        })
    })
    render({ camera: { view, screenResolution: [1500, 1500] }, client, ctx: ctx!, dataset, visibilityThresholdPx: 10 })

    // const position = toGpuBuffer(new Float32Array([3, 3, 40, 10, 25, 40]).buffer, 'float')
    // const highlightBy = toGpuBuffer(new Uint32Array([0, 1, 3]).buffer, 'uint32')
    // const columns = {
    //     position,
    //     highlightBy,
    // }
    // r({ ctx: ctx!, columns, count: 3, highlight: 3, radius: 4, view: { minCorner: [0, 0], maxCorner: [50, 50] } })
}
whatever();