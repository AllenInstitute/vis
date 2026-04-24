
// lets try and make not a full-fledged scatterbrain shader,
// with all its fancy filtering, hovering, dot sizes, etc
// but instead, some subplot shaders - so we render the dots,
// but we have no fancy filtering, just a simple highlight value,
// and a color-by attribute


// and lets try it with typeGPU generating our shaders for us... which I must admit seems pretty good...

import { buildScatterbrainCacheClient } from './cache-client';
import type { ColumnRequest, ScatterbrainDataset, SlideviewScatterbrainDataset } from './types';
import { uniq } from 'lodash';
import { SharedPriorityCache, type Cacheable } from '@alleninstitute/vis-core';
import type { WebGLSafeBasicType } from './typed-array';
import { getVisibleItems, loadDataset, type NodeWithBounds } from './dataset';
import { Box2D, type box2D, type vec2, type vec4 } from '@alleninstitute/vis-geometry';
import { pl } from 'zod/locales';
import type { F32 } from 'typegpu/data';
// import { buildRenderFn as OldSchool, VBO } from './wgpu-shader';
import { generate } from './render/webgpu/generated';
import { beginValidate, endValidate } from './render/webgpu/validate';
import { buildRenderFrameFn, type ShaderSettings } from './render/webgpu/renderer';




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
// type RenderProps = {
//     camera: { view: box2D, screenResolution: vec2 }
//     dataset: ScatterbrainDataset | SlideviewScatterbrainDataset;
//     client: ReturnType<typeof buildScatterbrainCacheClient<VBO>>;
//     visibilityThresholdPx: number;
//     ctx: GPUCanvasContext
// };

// export function buildScatterbrainTGPU(root: TgpuRoot, settings: SimpleSettings) {
//     const toGpuBuffer = (buffer: ArrayBuffer, type: WebGLSafeBasicType) => {
//         if (type === 'uint16') {
//             // seems like uint16 is cursed - vertex buffers have to have a stride of at least 4...
//             // this is probably why the typeGPU thing didnt work right either...
//             const B = root.device.createBuffer({ size: buffer.byteLength * 2, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX });
//             // now we have to copy the uint16 buffer and sorta kinda expand each value...
//             const u32 = new Uint32Array(new Uint16Array(buffer))
//             root.device.queue.writeBuffer(B, 0, u32.buffer);
//             return new VBO(B);
//         }
//         const B = root.device.createBuffer({ size: buffer.byteLength, usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.VERTEX });
//         root.device.queue.writeBuffer(B, 0, buffer, 0, buffer.byteLength);
//         return new VBO(B);
//     }
//     const prepareQtCell = columnsForItem<NodeWithBounds>(settings);
//     const drawQtCell = buildRenderFn(root);
//     const drawQtCells = OldSchool(root.device);
//     const render = (props: RenderProps) => {
//         const { camera, dataset, client, visibilityThresholdPx } = props;
//         const visibilityThreshold = (visibilityThresholdPx * Box2D.size(camera.view)[0]) / camera.screenResolution[0]; // (units*pixel)/pixel ==> units
//         const visibleQtNodes = getVisibleItems(dataset, camera, visibilityThreshold).map(prepareQtCell);
//         client.setPriorities(visibleQtNodes, []);
//         // console.log("visible: ", visibleQtNodes.length)
//         const blocks: Array<{ columns: Record<string, VBO>, count: number }> = []
//         for (const node of visibleQtNodes) {
//             if (client.has(node)) {
//                 const drawable = client.get(node);
//                 if (drawable) {
//                     // // console.log('draw it: ', node.node.file)
//                     // drawQtCell({
//                     //     count: node.node.numSpecimens,
//                     //     columns: drawable,
//                     //     ctx: props.ctx,
//                     //     highlight: 4,
//                     //     radius: .05,
//                     //     view: props.camera.view,
//                     // })
//                     blocks.push({ count: node.node.numSpecimens, columns: drawable })
//                 }
//             }
//         }
//         drawQtCells({ ctx: props.ctx, highlight: 4, radius: 0.05, view: props.camera.view, blocks })
//     }

//     const connectToCache = (cache: SharedPriorityCache, onDataArrived: () => void) => {
//         return buildScatterbrainCacheClient(['position', 'colorBy', 'highlightBy'], cache, toGpuBuffer, onDataArrived);
//     };

//     return { render, connectToCache };

// }

// function columnsForItem<T extends object>(
//     config: SimpleSettings,
// ) {
//     const columns: Record<string, ColumnRequest> = {
//         position: { type: 'METADATA', name: config.dataset.metadata.spatialColumn },
//         colorBy: { type: 'METADATA', name: config.colorBy.column },
//         highlightBy: { type: 'METADATA', name: config.highlightBy.column }
//     };

//     return (item: T) => {
//         return { ...item, dataset: config.dataset, columns };
//     };
// }

// so this version has problems
//  I cannot figure out for the life of me how to get uint16 buffer in as a vertex attribute....
//  I think I'm gonna try (again) to just make the meat of the shader, then feed it to a template via resolveWithContext
//  that will mean I'll roll the pipeline by hand, but honestly I dont see how else to make this work...
// function buildRenderFn(root: TgpuRoot) {
//     // ok - heres where we do the thing, which is to create a pipeline
//     // and return a function that invokes it...

//     const View = d.struct({ min: d.vec2f, max: d.vec2f })
//     const Vertex = { vIndex: d.builtin.vertexIndex, position: d.vec2f, highlightBy: d.u32 }
//     const unis = tgpu.bindGroupLayout({ view: { uniform: View }, highlight: { uniform: d.u32 }, radius: { uniform: d.f32 } });

//     // ok because we dont use interleaved buffers
//     // we have to hand-roll the layouts - do we need locations here?
//     const pLayout = tgpu.vertexLayout(d.arrayOf(d.vec2f), 'instance')
//     const hLayout = tgpu.vertexLayout(d.arrayOf(d.u32), 'instance')
//     // const hLayout: GPUVertexBufferLayout = {
//     //     ...wLayout,
//     //     arrayStride: 0,
//     // }

//     const vmain = tgpu.vertexFn({
//         in: Vertex,
//         out: { pos: d.builtin.position, color: d.vec4f },
//     })(function ({ vIndex, position, highlightBy }) {
//         'use gpu';
//         const clip = [d.vec2f(1, -1), d.vec2f(1, 1), d.vec2f(-1, -1), d.vec2f(-1, 1)];
//         const size = std.sub(unis.$.view.max, unis.$.view.min);
//         const dP = std.add(position, std.mul(clip[vIndex], unis.$.radius));
//         const p = std.sub(std.mul(std.div(std.sub(dP, unis.$.view.min), size), 2), 1);
//         const clr = std.mix(d.vec4f(1, 0, 0, 1), d.vec4f(0.5, 0.5, 0.5, 1), std.step(0.001, std.abs(std.sub(highlightBy, unis.$.highlight))))
//         return {
//             pos: d.vec4f(p.xy, 0, 1),
//             color: clr,
//         };
//     });

//     const fmain = tgpu.fragmentFn({ in: { pos: d.builtin.position, color: d.vec4f }, out: d.vec4f })(function ({ color }) {
//         return color;
//     });

//     // lets create some uniforms...
//     const view = root.createUniform(View)
//     const highlight = root.createUniform(d.u32)
//     const radius = root.createUniform(d.f32)

//     const bg = root.createBindGroup(unis, {
//         view: view.buffer,
//         highlight: highlight.buffer,
//         radius: radius.buffer
//     })
//     // this next part - it does pick up the types from
//     // the vertex shader... but some other stuff is mysterious
//     // also raw createPipeline has a fair bit of type-safety, although its
//     // true it cant line up named attribs, it only works by location index
//     const pipeline = root.createRenderPipeline({
//         vertex: vmain,
//         fragment: fmain,
//         attribs: {
//             highlightBy: hLayout.attrib,
//             position: pLayout.attrib,
//         },
//         primitive: { topology: 'triangle-strip', cullMode: 'back' },
//         // depthStencil: {
//         //     format: 'depth24plus',
//         //     depthWriteEnabled: true,
//         //     depthCompare: 'less',
//         // },
//     })
//     // console.log(root.unwrap(pipeline))
//     return (props: { view: box2D, radius: number, highlight: number, count: number, ctx: GPUCanvasContext, columns: Record<string, VBO> }) => {
//         // write the unis...
//         const { position, highlightBy } = props.columns;
//         view.patch({ min: props.view.minCorner, max: props.view.maxCorner }); // ugh
//         highlight.patch(props.highlight);
//         radius.patch(props.radius);
//         pipeline
//             .with(bg)

//             .withColorAttachment({ view: props.ctx, loadOp: 'load', })
//             .with(pLayout, position.buffer)
//             .with(hLayout, highlightBy.buffer)
//             .draw(4, props.count);
//     }
// }


const tenx =
    'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json';
const Class = 'FS00DXV0T9R1X9FJ4QE'

async function loadRawJson() {
    return await (await fetch(tenx)).json();
}
// function buildTest(device: GPUDevice) {

//     const yay = generate({ categoricalColumns: ['Class', 'subclass', 'cellId'], categoricalTable: 'lookupTexture', colorByColumn: 'Class', gradientTable: 'gradientTexture', highlightByColumn: 'cellId', mode: 'color', positionColumn: 'umapxy', quantitativeColumns: ['gaba'], samplerName: 'smpl', tableSize: [2, 40] })
//     beginValidate(device);
//     const module = device.createShaderModule({ code: yay, label: 'test shader' })
//     endValidate(device);
// }
const makeFakeColors = (n: number) => {
    const stuff: Record<number, { color: vec4; filteredIn: boolean }> = {};
    for (let i = 0; i < n; i++) {
        stuff[i] = {
            color: [Math.random(), Math.random(), Math.random(), 1],
            // 80% of either category are filtered in, at random:
            filteredIn: Math.random() > 0.2,
        };
    }
    return stuff;
};


export async function whatever() {

    const gradientData = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i += 4) {
        gradientData[i * 4 + 0] = i;
        gradientData[i * 4 + 1] = i;
        gradientData[i * 4 + 2] = i;
        gradientData[i * 4 + 3] = 255;
    }
    const adapter = await navigator.gpu.requestAdapter()
    const device = await adapter?.requestDevice()!;
    // buildTest(root.device)

    const categories = {
        '4MV7HA5DG2XJZ3UD8G9': makeFakeColors(40), // nt type
        FS00DXV0T9R1X9FJ4QE: makeFakeColors(40), // class
    };

    const settings: Omit<ShaderSettings, 'dataset'> = {
        categoricalFilters: { '4MV7HA5DG2XJZ3UD8G9': 40, FS00DXV0T9R1X9FJ4QE: 40 },
        colorBy: { kind: 'metadata', column: 'FS00DXV0T9R1X9FJ4QE' },
        // an alternative color-by setting, swap it to see quantitative coloring
        // colorBy: { kind: 'quantitative', column: '27683', gradient: 'viridis', range: { min: 0, max: 10 } },
        mode: 'color',
        quantitativeFilters: [],
        highlightByColumn: { kind: 'metadata', column: 'FS00DXV0T9R1X9FJ4QE' }
    };

    // const r = buildRenderFn(root.device);
    // const r = buildRenderFn(root)
    const dataset = await loadDataset(await loadRawJson())
    if (!dataset) {
        throw new Error('blerg this data is toast')
    }
    const cache = new SharedPriorityCache(new Map(), 1024 * 1024 * 2000);
    const { render, connectToCache } = buildRenderFrameFn(device, { ...settings, dataset })
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
        device: device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied'
    })

    const bound = (dataset as ScatterbrainDataset).metadata.tightBoundingBox;
    const view = Box2D.create([bound.lx, bound.ly], [bound.ux, bound.uy]);
    const client = connectToCache(cache, () => {
        // redraw?
        // console.log('new data arrived...')
        requestAnimationFrame(() => {
            console.log('re render!')

            render({
                categories,
                client,
                gradient: gradientData,
                target: ctx!.getCurrentTexture().createView(),
                uniforms: {
                    camera: { view, screenResolution: [1500, 1500] },
                    filteredOutColor: [0.5, 0.5, 0.5, 1.0],
                    highlightedValue: 22,
                    offset: [0, 0],
                    quantitativeRangeFilters: {},
                    spatialFilterBox: view,
                }
            })
        });
    });
    render({
        categories,
        client,
        gradient: gradientData,
        target: ctx!.getCurrentTexture().createView(),
        uniforms: {
            camera: { view, screenResolution: [1500, 1500] },
            filteredOutColor: [0.5, 0.5, 0.5, 1.0],
            highlightedValue: 22,
            offset: [0, 0],
            quantitativeRangeFilters: {},
            spatialFilterBox: view,
        }
    })
}
whatever();