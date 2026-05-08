// wrappings around webgpu-utils
// utilities for creating new shaders
// utilities for reusing shader code
// utilities for creating pipelines

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

/*

attributes:
    @align(x: i32 | u32 that is a power of 2 > 0) [can only be applied to a member of a struct]
    @binding(num >= 0) [can only be applied to a Resource variable]
    @blend_src(0 | 1) [only valid in specific feature-triggered scenarios; must be on a struct member with @location]
    @builtin(builtin-name) [only valid on a struct member, entrypoint argument, or entrypoint return type]
    @const [only allowed on non-user-defined functions; not relevant to our use case]
    @diagnostic(ShaderSeverityControlName, string)
    @group(num >= 0) [can only be applied to a Resource variable]
    @id(num >= 0) [can only be applied to an override variable with a scalar type]
    @interpolate(ShaderIntroplationType, ShaderInterpolationSamplingType?) [can only be applied to declarations with a @location attribute]
    @invariant [can only be applied to a @builtin(position) declaration; only has effect if applied to vertex position output]
    @location(num >= 0) [structure members or entrypoint inputs/outputs only; numeric scalar or vector declarations only; not allowed in compute shaders]
    @must_use [function declarations with return types only]
    @size(num >= 1) [only applicable to struct members with a size known at shader creation time]
    @workgroup_size(x: u32 >= 1, [y?: u32 >= 1, [z?: u32 >= 1]]) [only on compute shader entry points]

        Shader Stage indicator attributes:
            @vertex
            @fragment
            @compute

builtins:
    clip_distances
    frag_depth
    front_facing
    global_invocation_id
    global_invocation_index
    instance_index
    local_invocation_id
    local_invocation_index
    num_workgroups
    position
    primitive_index
    sample_index
    sample_mask
    vertex_index
    workgroup_id
    workgroup_index
    subgroup_invocation_id
    subgroup_size
    subgroup_id
    num_subgroups


*/

import * as wgh from 'webgpu-utils';

type ShaderSeverityControlName = 'error' | 'warning' | 'info' | 'off';
const SHADER_SEVERITY_CONTROL_NAMES: ShaderSeverityControlName[] = ['error', 'warning', 'info', 'off'];

type ShaderIntroplationType = 'perspective' | 'linear' | 'flat';
const SHADER_INTERPOLATION_TYPES: ShaderIntroplationType[] = ['perspective', 'linear', 'flat'];

type ShaderInterpolationSamplingType = 'center' | 'centroid' | 'sample' | 'first' | 'either';
const SHADER_INTERPOLATION_SAMPLING_TYPES: ShaderInterpolationSamplingType[] = [
    'center',
    'centroid',
    'sample',
    'first',
    'either',
];

type ShaderBuiltins =
    | 'clip_distances'
    | 'frag_depth'
    | 'front_facing'
    | 'global_invocation_id'
    | 'global_invocation_index'
    | 'instance_index'
    | 'local_invocation_id'
    | 'local_invocation_index'
    | 'num_workgroups'
    | 'position'
    | 'primitive_index'
    | 'sample_index'
    | 'sample_mask'
    | 'vertex_index'
    | 'workgroup_id'
    | 'workgroup_index'
    | 'subgroup_invocation_id'
    | 'subgroup_size'
    | 'subgroup_id'
    | 'num_subgroups';

const SHADER_BUILTINS: ShaderBuiltins[] = [
    'clip_distances',
    'frag_depth',
    'front_facing',
    'global_invocation_id',
    'global_invocation_index',
    'instance_index',
    'local_invocation_id',
    'local_invocation_index',
    'num_workgroups',
    'position',
    'primitive_index',
    'sample_index',
    'sample_mask',
    'vertex_index',
    'workgroup_id',
    'workgroup_index',
    'subgroup_invocation_id',
    'subgroup_size',
    'subgroup_id',
    'num_subgroups',
];

type AlignAttribute = {
    align: number;
};
type BindingAttribute = {
    binding: number;
};
type BlendSrcAttribute = {
    blend_src: 0 | 1;
};
type BuiltinAttribute = {
    builtin: ShaderBuiltins;
};
type ConstAttribute = {
    const: true;
};
type DiagnosticAttribute = {
    diagnostic: [ShaderSeverityControlName, string];
};
type GroupAttribute = {
    group: number;
};
type IdAttribute = {
    id: number;
};
type InterpolateAttribute = {
    interpolate: [ShaderIntroplationType, ShaderInterpolationSamplingType?];
};
type InvariantAttribute = {
    invariant: true;
};
type LocationAttribute = {
    location: number;
};
type MustUseAttribute = {
    must_use: true;
};
type SizeAttribute = {
    size: number;
};
type WorkgroupSizeAttribute = {
    workgroup_size: [number] | [number, number] | [number, number, number];
};
type VertexAttribute = {
    vertex: true;
};
type FragmentAttribute = {
    fragment: true;
};
type ComputeAttribute = {
    compute: true;
};

type VariableOrValueAttribute =
    | AlignAttribute
    | BindingAttribute
    | BlendSrcAttribute
    | BuiltinAttribute
    | DiagnosticAttribute
    | GroupAttribute
    | IdAttribute
    | InterpolateAttribute
    | InvariantAttribute
    | LocationAttribute
    | SizeAttribute
    | WorkgroupSizeAttribute;

type FunctionAttribute = ConstAttribute | MustUseAttribute | VertexAttribute | FragmentAttribute | ComputeAttribute;

export const isAlignAttribute = (attr: unknown): attr is AlignAttribute =>
    attr !== null &&
    typeof attr === 'object' &&
    'align' in attr &&
    typeof attr.align === 'number' &&
    attr.align > 0 &&
    (attr.align & (attr.align - 1)) === 0;

export function align(n: number): AlignAttribute {
    if (n <= 0 || (n & (n - 1)) !== 0) {
        throw new Error('Alignment must be a positive power of 2');
    }
    return { align: n };
}

export const isBindingAttribute = (attr: unknown): attr is BindingAttribute =>
    attr !== null &&
    typeof attr === 'object' &&
    'binding' in attr &&
    typeof attr.binding === 'number' &&
    attr.binding >= 0;

export function binding(n: number): BindingAttribute {
    if (n < 0) {
        throw new Error('Binding number must be a non-negative integer');
    }
    return { binding: n };
}

export const isBlendSrcAttribute = (attr: unknown): attr is BlendSrcAttribute =>
    attr !== null && typeof attr === 'object' && 'blend_src' in attr && (attr.blend_src === 0 || attr.blend_src === 1);

export function blendSrc(value: 0 | 1): BlendSrcAttribute {
    if (value !== 0 && value !== 1) {
        throw new Error('blend_src value must be either 0 or 1');
    }
    return { blend_src: value };
}

export const isBuiltinAttribute = (attr: unknown): attr is BuiltinAttribute =>
    attr !== null &&
    typeof attr === 'object' &&
    'builtin' in attr &&
    typeof attr.builtin === 'string' &&
    SHADER_BUILTINS.includes(attr.builtin as ShaderBuiltins);

export function builtin(name: ShaderBuiltins): BuiltinAttribute {
    if (!SHADER_BUILTINS.includes(name)) {
        throw new Error(`Invalid builtin name: ${name}`);
    }
    return { builtin: name };
}

export const isConstAttribute = (attr: unknown): attr is ConstAttribute =>
    attr !== null && typeof attr === 'object' && 'const' in attr;

// skipping const constructor for now since it's not relevant to our use case

export const isDiagnosticAttribute = (attr: unknown): attr is DiagnosticAttribute =>
    attr !== null &&
    typeof attr === 'object' &&
    'diagnostic' in attr &&
    Array.isArray(attr.diagnostic) &&
    attr.diagnostic.length === 2 &&
    typeof attr.diagnostic[0] === 'string' &&
    SHADER_SEVERITY_CONTROL_NAMES.includes(attr.diagnostic[0] as ShaderSeverityControlName) &&
    typeof attr.diagnostic[1] === 'string' &&
    attr.diagnostic[1].length > 0;

export function diagnostic(severity: ShaderSeverityControlName, message: string): DiagnosticAttribute {
    if (!SHADER_SEVERITY_CONTROL_NAMES.includes(severity)) {
        throw new Error(`Invalid shader severity control name: ${severity}`);
    }
    if (typeof message !== 'string' || message.length === 0) {
        throw new Error('Diagnostic message must be a non-empty string');
    }
    return { diagnostic: [severity, message] };
}

export const isGroupAttribute = (attr: unknown): attr is GroupAttribute =>
    attr !== null && typeof attr === 'object' && 'group' in attr && typeof attr.group === 'number' && attr.group >= 0;

export function group(n: number): GroupAttribute {
    if (n < 0) {
        throw new Error('Group number must be a non-negative integer');
    }
    return { group: n };
}

export const isIdAttribute = (attr: unknown): attr is IdAttribute =>
    attr !== null && typeof attr === 'object' && 'id' in attr && typeof attr.id === 'number' && attr.id >= 0;

export function id(n: number): IdAttribute {
    if (n < 0) {
        throw new Error('ID number must be a non-negative integer');
    }
    return { id: n };
}

export const isInterpolateAttribute = (attr: unknown): attr is InterpolateAttribute =>
    attr !== null &&
    typeof attr === 'object' &&
    'interpolate' in attr &&
    Array.isArray(attr.interpolate) &&
    (attr.interpolate.length === 1 || attr.interpolate.length === 2) &&
    typeof attr.interpolate[0] === 'string' &&
    SHADER_INTERPOLATION_TYPES.includes(attr.interpolate[0] as ShaderIntroplationType) &&
    (attr.interpolate.length === 1 ||
        (typeof attr.interpolate[1] === 'string' &&
            SHADER_INTERPOLATION_SAMPLING_TYPES.includes(attr.interpolate[1] as ShaderInterpolationSamplingType)));

export const isInvariantAttribute = (attr: unknown): attr is InvariantAttribute =>
    attr !== null && typeof attr === 'object' && 'invariant' in attr;

export const isLocationAttribute = (attr: unknown): attr is LocationAttribute =>
    attr !== null &&
    typeof attr === 'object' &&
    'location' in attr &&
    typeof attr.location === 'number' &&
    attr.location >= 0;

export const isMustUseAttribute = (attr: unknown): attr is MustUseAttribute =>
    attr !== null && typeof attr === 'object' && 'must_use' in attr;

export const isSizeAttribute = (attr: unknown): attr is SizeAttribute =>
    attr !== null && typeof attr === 'object' && 'size' in attr && typeof attr.size === 'number' && attr.size > 0;

export const isWorkgroupSizeAttribute = (attr: unknown): attr is WorkgroupSizeAttribute =>
    attr !== null &&
    typeof attr === 'object' &&
    'workgroup_size' in attr &&
    Array.isArray(attr.workgroup_size) &&
    attr.workgroup_size.length >= 1 &&
    attr.workgroup_size.length <= 3 &&
    attr.workgroup_size.every((n) => typeof n === 'number' && n > 0);

type IdentifierDeclaration = {
    readonly name: string;
};

type ConstValueDeclaration = IdentifierDeclaration & {
    __identType: 'value';
    readonly assignmentType: 'const';
    readonly type?: string;
    readonly initializer: unknown;
};

type OverrideValueDeclaration = IdentifierDeclaration & {
    __identType: 'value';
    readonly assignmentType: 'override';
    readonly attributes?: VariableOrValueAttribute[];
} & (
        | {
              readonly type: string;
              readonly initializer?: unknown;
          }
        | {
              readonly type?: string;
              readonly initializer: unknown;
          }
    );

type ValueDeclaration = ConstValueDeclaration | OverrideValueDeclaration;

type StructMemberDeclaration = IdentifierDeclaration & {
    type: string;
    attributes?: VariableOrValueAttribute[];
};

type StructDeclaration = IdentifierDeclaration & {
    __identType: 'struct';
    name: string;
    fields: StructMemberDeclaration[];
};

type FunctionParameterDeclaration = IdentifierDeclaration & {
    type: string;
    attributes?: VariableOrValueAttribute[];
};

type FunctionReturnTypeDeclaration = {
    type: string;
    attributes?: VariableOrValueAttribute[];
};

type FunctionDeclaration = IdentifierDeclaration & {
    __identType: 'function';
    parameters: FunctionParameterDeclaration[];
    returnType?: FunctionReturnTypeDeclaration;
    attributes?: FunctionAttribute[];
    body: string;
};

type Declaration = ValueDeclaration | StructDeclaration | FunctionDeclaration;

type ShaderDefinition = {
    declarations: Declaration[];
    entryPoints: {
        vertex: string;
        fragment?: string;
    };
};

function shader(declarations: Declaration[]): Shader {
    // Implementation goes here
}

class Shader {
    constructor(public definition: ShaderDefinition) {}

    static deserialize(serialized: string): Shader {
        const definition = JSON.parse(serialized);
        return new Shader(definition);
    }

    serialize(): string {
        // Implementation goes here
        return JSON.stringify(this.definition);
    }

    asSource(): string {
        // Implementation goes here
        return '';
    }
}

const makePipeline = (device: GPUDevice) => {
    const code = `
        @group(0) @binding(0) var<uniform> mat: mat4x4f;

        struct MyVSOutput {
            @builtin(position) position: vec4f,
            @location(1) texcoord: vec2f,
        };

        @vertex
        fn myVSMain(v: MyVSInput) -> MyVSOutput {
            var vsOut: MyVSOutput;
            vsOut.position = mat * v.position;
            vsOut.texcoord = v.texcoord;
            return vsOut;
        }

        @group(0) @binding(2) var diffuseSampler: sampler;
        @group(0) @binding(3) var diffuseTexture: texture_2d<f32>;

        @fragment
            fn myFSMain(v: MyVSOutput) -> @location(0) vec4f {
            return textureSample(diffuseTexture, diffuseSampler, v.texcoord);
        }
    `;

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
