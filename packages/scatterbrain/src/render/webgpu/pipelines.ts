/**************************************************************************************************************
 * NOTE: THIS FILE IS VERY MUCH A WORK IN PROGRESS; WILL BE REMOVED/MODIFIED MASSIVELY BEFORE FINAL PR IS READY 
 **************************************************************************************************************/

// wrappings around webgpu-utils - pending
// utilities for creating new shaders - DONE
// utilities for reusing shader code - in progress
// utilities for creating pipelines - in progress

// RenderPasses define the order of operations in a rendering pipeline, which includes the mapping of specific bindings at specific points in the process
// Pipelines define how to transform data between stages of the rendering pipeline

// a way of associating shader modules with their bind groups so that we can reuse them across pipelines

/* okay, what are the real problems I'm trying to solve here?
    - I want a simple way to declare bind groups and their associated data, so that they can just be "attached" to a shader without having to write and maintain the shader code itself
    - I want a simple way of associating data interfaces to particular drawables, similar in some respects to a scene graph
    - I want the render pass to be generated automatically from this drawable "graph"
    - I want to be able to generalize the renderer so that it's not totally Scatterbrain-specific (some of it obviously has to be, but ideally as little as necessary)

*/

/*
WebGPU workflow:

- define shader logic (functions, entrypoints, modules)
    = a collection of functions
    = some functions are marked as entrypoints (one of each type allowed per shader module)
    = vertex inputs
        = direct arguments or structs
            = structs are defined as objects
    = vertex outputs
        = a struct defined as an object
    = fragment inputs
    = fragment outputs
- define shader data interface
    = handled with makeShaderDataDefinitions from webgpu-utils
- define bind group layout
    = also handled with makeShaderDataDefinitions
- define pipeline layout
- define render pipeline
- create bind group
- create render pass
- draw

Some simplifying assumptions:
- all types and other syntactic elements are going to be strings ONLY, and must be valid shader code in their own right; NO TYPECHECKING (at least not yet)
- no checking of validity of bind group matches, etc. First responsibility for accuracy remains with the coder!
*/

import * as wgh from 'webgpu-utils';
import {
    builtin,
    fragmentEntry,
    location,
    member,
    param,
    returns,
    sampler,
    shader,
    struct,
    texture,
    uniform,
    vertexEntry,
} from './shaders';

const makeResourceInterface = () => {
    return [ // groups
        [ // bindings
            { resourceType: 'buffer' as const, visibility: GPUShaderStage.VERTEX },
            { resourceType: 'sampler' as const, visibility: GPUShaderStage.FRAGMENT },
            { resourceType: 'texture' as const, visibility: GPUShaderStage.FRAGMENT },
        ]
    ]
}

const makePipeline = (device: GPUDevice) => {
    const code = shader([
        uniform('mat', 'mat4x4f', 0, 0),
        struct('MyVSInput', [
            member('position', 'vec4f', [builtin('position')]),
            member('texcoord', 'vec2f', [location(0)]),
        ]),

        vertexEntry(
            'myVSMain',
            [param('v', 'MyVSInput')],
            /*wgsl*/ `
            var vsOut: MyVSOutput;
            vsOut.position = mat * v.position;
            vsOut.texcoord = v.texcoord;
            return vsOut;
        `,
            returns('MyVSOutput')
        ),

        sampler('diffuseSampler', 'sampler', 0, 2),
        texture('diffuseTexture', 'texture_2d<f32>', 0, 3),

        fragmentEntry(
            'myFSMain',
            [param('v', 'MyVSOutput')],
            /*wgsl*/ `
            return textureSample(diffuseTexture, diffuseSampler, v.texcoord);
        `,
            returns('vec4f')
        ),
    ]).asSource();

    // const code = `
    //     @group(0) @binding(0) var<uniform> mat: mat4x4f;

    //     struct MyVSOutput {
    //         @builtin(position) position: vec4f,
    //         @location(1) texcoord: vec2f,
    //     };

    //     @vertex
    //     fn myVSMain(v: MyVSInput) -> MyVSOutput {
    //         var vsOut: MyVSOutput;
    //         vsOut.position = mat * v.position;
    //         vsOut.texcoord = v.texcoord;
    //         return vsOut;
    //     }

    //     @group(0) @binding(2) var diffuseSampler: sampler;
    //     @group(0) @binding(3) var diffuseTexture: texture_2d<f32>;

    //     @fragment
    //         fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
    //         return textureSample(diffuseTexture, diffuseSampler, v.texcoord);
    //     }
    // `;

    const module = device.createShaderModule({ code });
    const defs = wgh.makeShaderDataDefinitions(code);

    const pipelineDesc = {
        vertex: {
            module,
            entryPoint: 'myVSMain',
        },
        fragment: {
            module,
            entryPoint: 'myFSMain',
            targets: [{ format: 'rgba8unorm' as GPUTextureFormat }],
        },
    };

    const descriptors = wgh.makeBindGroupLayoutDescriptors(defs, pipelineDesc);
    const bindGroupLayouts = descriptors.map((desc) => device.createBindGroupLayout(desc));
    const layout = device.createPipelineLayout({ bindGroupLayouts });
    const pipelineDescriptor: GPURenderPipelineDescriptor = {
        layout,
        ...pipelineDesc,
    };
    const pipeline = device.createRenderPipeline(pipelineDescriptor);
};
