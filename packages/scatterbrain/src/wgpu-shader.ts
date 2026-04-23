
// like the webGL shader, but in wgsl (webGPU)
import type { Cacheable } from '@alleninstitute/vis-core';
import type { box2D } from '@alleninstitute/vis-geometry';
import { mapValues } from 'lodash';
import * as wgh from 'webgpu-utils'

const VALIDATE = true; // todo turn me off for prod...
export function beginValidate(device: GPUDevice) {
    if (VALIDATE) {
        device.pushErrorScope('validation')
    }
}
export function endValidate(device: GPUDevice) {
    if (VALIDATE) {
        device.popErrorScope().then((errs) => {
            if (errs) {
                console.error(errs)
            }
        })
    }
}

type Config = {}
export function buildHighlightShader(config: Config) {
    return /*wgsl*/`

    struct View {
        min: vec2f,
        max: vec2f,
    };
    struct Uniforms {
        view: View,
        pointSize: vec2f, // in data space <regular, highlighted>
        highlight: u32,
    };

    struct Vertex {
        // location(0) clip: vec2f, // indexed clip-space vertex, to make points bigger than 1px
        @builtin(vertex_index) vIndex: u32,
        @location(0) position: vec2f,
        @location(1) colorBy: u32,
        @location(2) highlightBy: u32,
    }

    

    fn isHighlighted(v:Vertex,u:Uniforms)->bool{
        return v.highlightBy == u.highlight;
    }
    fn highlightMix(v:Vertex,u:Uniforms)->f32 {
        return 1.0-step(0.01, clamp(0.0,1.0, f32(abs(v.highlightBy-u.highlight))));
    }
    // get the clip-space position of this vertex
    fn applyCamera(v:Vertex, u:Uniforms)->vec2f {
        let clip = array(
            vec2f(1, -1), 
            vec2f(1, 1),  
            vec2f(-1, -1),
            vec2f(-1, 1)
        );
        let view = u.view;
        let pointSize = u.pointSize; 

        let S = view.max-view.min;
        let R = mix(pointSize.x,pointSize.y, highlightMix(v,u));
        let dPos = clip[v.vIndex]*R + v.position;
        let uPos =(dPos-view.min)/S;
        // now clip space
        return (uPos*2.0)-1.0;
    }
    fn getColor(v:Vertex, u:Uniforms)->vec4f {
        return mix(vec4f(0.5,f32(v.colorBy)/40.0,0.5,1.0),vec4f(1.0,0.,0.,1.0),highlightMix(v,u));
    }

    struct VsOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
    };

    @group(0) @binding(0)
    var<uniform> unis: Uniforms;
    // todo: bind a buffer (or texture) for coloring...

    
    @vertex
    fn vmain(vert: Vertex)->VsOutput{
        var out: VsOutput;
        
        out.color = getColor(vert,unis);
        out.position = vec4f(applyCamera(vert,unis),0.5,1.0);
        return out;
    }

    @fragment
    fn fmain(v:VsOutput)->@location(0) vec4f{
        return v.color;
    }
    `
}

export function buildRenderFn(device: GPUDevice) {
    beginValidate(device);
    const prgm = buildHighlightShader({});
    const module = device.createShaderModule({
        code: prgm,
        label: 'simple scatterplot highlighting'
    })
    endValidate(device);

    const defs = wgh.makeShaderDataDefinitions(prgm)
    console.dir(defs)
    beginValidate(device);
    const pipeline = device.createRenderPipeline({
        label: 'scatterplot render pipe',
        layout: 'auto',
        vertex: {
            module,
            entryPoint: 'vmain',
            // not using interleaved buffers, so we need 3 entries...
            buffers: [{//position
                stepMode: 'instance',
                arrayStride: 8,
                attributes: [{
                    format: 'float32x2',
                    offset: 0,
                    shaderLocation: 0,
                }]
            }, {//colorBy
                stepMode: 'instance',
                arrayStride: 4, // the stride of an array may not be less than 4, so uint16 is basically only supported for interleaved arrays, which we cant really use! thanks WebGPU!
                attributes: [{
                    format: 'uint16',
                    offset: 0,
                    shaderLocation: 1,
                }]
            },
            {   // highlightBy
                stepMode: 'instance',
                arrayStride: 4,
                attributes: [{
                    format: 'uint16',
                    offset: 0,
                    shaderLocation: 2,
                }]
            }
            ]
        },
        fragment: {
            module,
            entryPoint: 'fmain',
            targets: [{
                format: 'bgra8unorm',
                blend: {
                    alpha: {
                        operation: 'add',
                        srcFactor: 'one',
                        dstFactor: 'one',
                    },
                    color: {
                        operation: 'add',
                        srcFactor: 'src-alpha',
                        dstFactor: 'one-minus-src-alpha',
                    },
                },
            }]
        },
        primitive: {
            topology: 'triangle-strip',
        },
    })
    endValidate(device);
    const { binding, size } = defs.uniforms['unis'];
    const uniformView = wgh.makeStructuredView(defs.uniforms.unis);
    const uniBuffer = device.createBuffer({
        size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        label: 'scatterbrin uniform buffer',
    });
    const bg0 = pipeline.getBindGroupLayout(0);
    const bg = device.createBindGroup({
        layout: bg0,
        label: 'scatterplot bindgroup 0',
        entries: [{ binding, resource: uniBuffer }]
    })
    // can I re-use an encoder? ANSWER: NO! what the hell is the point of all these if you cant keep them?
    return (props: {
        view: box2D, radius: number, highlight: number, ctx: GPUCanvasContext, blocks: ReadonlyArray<{
            columns: Record<string, VBO>,
            count: number,
        }>
    }) => {
        const { view, ctx, highlight, radius, blocks } = props;
        uniformView.set({
            view: { min: view.minCorner, max: view.maxCorner },
            pointSize: [radius / 2, radius * 2],
            highlight
        });
        // now copy the typed array to the actual gpu buffer:
        device.queue.writeBuffer(uniBuffer, 0, uniformView.arrayBuffer)
        const enc = device.createCommandEncoder({ label: 'scatterbrain encoder' })

        const pass = enc.beginRenderPass({
            colorAttachments: [
                {
                    clearValue: [0, 0, 0.5, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                    view: ctx.getCurrentTexture().createView(),
                }
            ]
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bg);

        for (const block of blocks) {
            const { count, columns } = block
            pass.setVertexBuffer(0, columns.position.buffer)
            pass.setVertexBuffer(1, columns.colorBy.buffer)
            pass.setVertexBuffer(2, columns.highlightBy.buffer)
            pass.draw(4, count);
        }

        pass.end();
        device.queue.submit([enc.finish()]);
    }
}
export class VBO implements Cacheable {
    constructor(readonly buffer: GPUBuffer) {
    }
    destroy() {
        this.buffer.destroy();
    }
    sizeInBytes() {
        return this.buffer.size;
    }
}
