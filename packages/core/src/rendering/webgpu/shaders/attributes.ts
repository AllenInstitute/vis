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
 * The `binding` attribute is intentionally omitted from the public API; its value is set via the
 * `binding` property on a Resource variable declaration.
 */

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
 * The `group` attribute is intentionally omitted from the public API; its value is set via the
 * `group` property on a Resource variable declaration.
 */

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
 * The `binding` attribute is intentionally omitted from the public API; its value is set via the
 * `binding` property on a Resource variable declaration.
 */

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
 * The `group` attribute is intentionally omitted from the public API; its value is set via the
 * `group` property on a Resource variable declaration.
 */

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

const constructors = {
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

export const $a = constructors;
