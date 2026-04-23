import { beginValidate, endValidate } from "./validate";
import * as wgh from 'webgpu-utils'

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
    fn getColor(v:Vertex, u:Uniforms, tex: texture_2d, smpl:sampler)->vec4f {
        const clr = textureSample(tex, smpl, );
        return mix(vec4f(0.5,f32(v.colorBy)/40.0,0.5,1.0),vec4f(1.0,0.,0.,1.0),highlightMix(v,u));
    }

    struct VsOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
    };

    @group(0) @binding(0)
    var<uniform> unis: Uniforms;
    @group(0) @binding(1) var tex: sampler;
    @group(0) @binding(2) var lookup: texture_2d<f32>;
    
    @vertex
    fn vmain(vert: Vertex)->VsOutput{
        var out: VsOutput;
        
        out.color = getColor(vert,unis,tex);
        out.position = vec4f(applyCamera(vert,unis),0.5,1.0);
        return out;
    }

    @fragment
    fn fmain(v:VsOutput)->@location(0) vec4f{
        return v.color;
    }
    `
}

// the shader is very directly connected to the pipeline, so lets export that too...
export function buildHighlightPipeline(device: GPUDevice, config: Config) {
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

    // return the pipeline, plus hand-made, typesafe info to make it easy to bind:
    // also - lets just go ahead and set up the buffer for the uniforms...

    return { pipeline, defs }
}



export function buildScatterbrainRenderer(device: GPUDevice, config: Config) {

}