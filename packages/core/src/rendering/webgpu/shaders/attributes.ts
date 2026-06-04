/**
 * This file defines TypeScript types and helper functions for representing WGSL shader attributes in a type-safe way.
 * Each attribute is represented as an object with a specific shape, and includes a __gen method that generates the
 * corresponding WGSL syntax for that attribute. The file also includes type guards for each attribute type, as well as
 * constructors that validate input and create the attribute objects.
 *
 * Summary of Attributes:
 *   - align(x: i32 | u32 that is a power of 2 > 0) [can only be applied to a member of a struct]
 *   - binding(num >= 0) [can only be applied to a Resource variable]
 *   - blend_src(0 | 1) [only valid in specific feature-triggered scenarios; must be on a struct member with @location]
 *   - builtin(builtin-name) [only valid on a struct member, entrypoint argument, or entrypoint return type]
 *   - const [only allowed on non-user-defined functions; not relevant to our use case]
 *   - diagnostic(ShaderSeverityControlName, string)
 *   - group(num >= 0) [can only be applied to a Resource variable]
 *   - id(num >= 0) [can only be applied to an override variable with a scalar type]
 *   - interpolate(ShaderIntroplationType, ShaderInterpolationSamplingType?) [can only be applied to declarations with a @location attribute]
 *   - invariant [can only be applied to a @builtin(position) declaration; only has effect if applied to vertex position output]
 *   - location(num >= 0) [structure members or entrypoint inputs/outputs only; numeric scalar or vector declarations only; not allowed in compute shaders]
 *   - must_use [function declarations with return types only]
 *   - size(num >= 1) [only applicable to struct members with a size known at shader creation time]
 *   - workgroup_size(x: u32 >= 1, [y?: u32 >= 1, [z?: u32 >= 1]]) [only on compute shader entry points]
 *
 *   Shader Stage indicator attributes:
 *     - vertex
 *     - fragment
 *     - compute
 */

/// TYPES

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

export type DeclarationAttribute = {
    __gen: () => string;
};

export type AlignAttribute = DeclarationAttribute & {
    align: number;
};

/*
 * NOTE: The `binding` attribute is intentionally omitted from the public API for now,
 * as its usage is handled by setting the `binding` property on a Resource variable
 * declaration.
 **/
// export type BindingAttribute = DeclarationAttribute & {
//     binding: number;
// };

export type BlendSrcAttribute = DeclarationAttribute & {
    blend_src: 0 | 1;
};

export type BuiltinAttribute = DeclarationAttribute & {
    builtin: ShaderBuiltins;
};

export type ConstAttribute = DeclarationAttribute & {
    const: true;
};

export type DiagnosticAttribute = DeclarationAttribute & {
    diagnostic: [ShaderSeverityControlName, string];
};

/*
 * NOTE: The `group` attribute is intentionally omitted from the public API for now,
 * as its usage is handled by setting the `group` property on a Resource variable
 * declaration.
 **/
// export type GroupAttribute = DeclarationAttribute & {
//     group: number;
// };

export type IdAttribute = DeclarationAttribute & {
    id: number;
};

export type InterpolateAttribute = DeclarationAttribute & {
    interpolate: [ShaderIntroplationType, ShaderInterpolationSamplingType?];
};

export type InvariantAttribute = DeclarationAttribute & {
    invariant: true;
};

export type LocationAttribute = DeclarationAttribute & {
    location: number;
};

export type MustUseAttribute = DeclarationAttribute & {
    must_use: true;
};

export type SizeAttribute = DeclarationAttribute & {
    size: number;
};

export type WorkgroupSizeAttribute = DeclarationAttribute & {
    workgroup_size: [number] | [number, number] | [number, number, number];
};

export type VertexAttribute = DeclarationAttribute & {
    vertex: true;
};

export type FragmentAttribute = DeclarationAttribute & {
    fragment: true;
};

export type ComputeAttribute = DeclarationAttribute & {
    compute: true;
};

export type VariableOrValueAttribute =
    | AlignAttribute
    | BlendSrcAttribute
    | BuiltinAttribute
    | DiagnosticAttribute
    | IdAttribute
    | InterpolateAttribute
    | InvariantAttribute
    | LocationAttribute
    | SizeAttribute
    | WorkgroupSizeAttribute;

export type FunctionAttribute =
    | ConstAttribute
    | MustUseAttribute
    | VertexAttribute
    | FragmentAttribute
    | ComputeAttribute;

/// CONSTRUCTORS

export function align(n: number): AlignAttribute {
    if (n <= 0 || (n & (n - 1)) !== 0) {
        throw new Error('Alignment must be a positive power of 2');
    }
    return { align: n, __gen: () => `@align(${n})` };
}

/*
 * NOTE: The `binding` attribute is intentionally omitted from the public API for now,
 * as its usage is handled by setting the `binding` property on a Resource variable
 * declaration.
 **/
// export function binding(n: number): BindingAttribute {
//     if (n < 0) {
//         throw new Error('Binding number must be a non-negative integer');
//     }
//     return { binding: n, __gen: () => `@binding(${n})` };
// }

export function blendSrc(value: 0 | 1): BlendSrcAttribute {
    if (value !== 0 && value !== 1) {
        throw new Error('blend_src value must be either 0 or 1');
    }
    return { blend_src: value, __gen: () => `@blend_src(${value})` };
}

export function builtin(name: ShaderBuiltins): BuiltinAttribute {
    if (!SHADER_BUILTINS.includes(name)) {
        throw new Error(`Invalid builtin name: ${name}`);
    }
    return { builtin: name, __gen: () => `@builtin(${name})` };
}

export function constAttr(): ConstAttribute {
    return { const: true, __gen: () => '@const' };
}

export function diagnostic(severity: ShaderSeverityControlName, message: string): DiagnosticAttribute {
    if (!SHADER_SEVERITY_CONTROL_NAMES.includes(severity)) {
        throw new Error(`Invalid shader severity control name: ${severity}`);
    }
    if (typeof message !== 'string' || message.length === 0) {
        throw new Error('Diagnostic message must be a non-empty string');
    }
    return { diagnostic: [severity, message], __gen: () => `@diagnostic(${severity}, "${message}")` };
}

/*
 * NOTE: The `group` attribute is intentionally omitted from the public API for now,
 * as its usage is handled by setting the `group` property on a Resource variable
 * declaration.
 **/
// export function group(n: number): GroupAttribute {
//     if (n < 0) {
//         throw new Error('Group number must be a non-negative integer');
//     }
//     return { group: n, __gen: () => `@group(${n})` };
// }

export function id(n: number): IdAttribute {
    if (n < 0) {
        throw new Error('ID number must be a non-negative integer');
    }
    return { id: n, __gen: () => `@id(${n})` };
}

export function interpolate(
    type: ShaderIntroplationType,
    samplingType?: ShaderInterpolationSamplingType
): InterpolateAttribute {
    if (!SHADER_INTERPOLATION_TYPES.includes(type)) {
        throw new Error(`Invalid interpolation type: ${type}`);
    }
    if (samplingType !== undefined && !SHADER_INTERPOLATION_SAMPLING_TYPES.includes(samplingType)) {
        throw new Error(`Invalid interpolation sampling type: ${samplingType}`);
    }
    return {
        interpolate: samplingType !== undefined ? [type, samplingType] : [type],
        __gen: () => `@interpolate(${type}${samplingType !== undefined ? `, ${samplingType}` : ''})`,
    };
}

export function invariant(): InvariantAttribute {
    return { invariant: true, __gen: () => '@invariant' };
}

export function location(n: number): LocationAttribute {
    if (n < 0) {
        throw new Error('Location number must be a non-negative integer');
    }
    return { location: n, __gen: () => `@location(${n})` };
}

export function mustUse(): MustUseAttribute {
    return { must_use: true, __gen: () => '@must_use' };
}

export function size(n: number): SizeAttribute {
    if (n <= 0) {
        throw new Error('Size must be a positive number');
    }
    return { size: n, __gen: () => `@size(${n})` };
}

export function workgroupSize(
    ...sizes: [number] | [number, number] | [number, number, number]
): WorkgroupSizeAttribute {
    if (sizes.length < 1 || sizes.length > 3) {
        throw new Error('Workgroup size must have 1 to 3 dimensions');
    }
    if (!sizes.every((n) => typeof n === 'number' && n > 0)) {
        throw new Error('Workgroup size dimensions must be positive numbers');
    }
    return { workgroup_size: sizes, __gen: () => `@workgroup_size(${sizes.join(', ')})` };
}

export function vertex(): VertexAttribute {
    return { vertex: true, __gen: () => '@vertex' };
}

export function fragment(): FragmentAttribute {
    return { fragment: true, __gen: () => '@fragment' };
}

export function compute(): ComputeAttribute {
    return { compute: true, __gen: () => '@compute' };
}

export const constructors = {
    align,
    blendSrc,
    builtin,
    constant: constAttr,
    diagnostic,
    id,
    interpolate,
    invariant,
    location,
    mustUse,
    size,
    workgroupSize,
    vertex,
    fragment,
    compute,
};
