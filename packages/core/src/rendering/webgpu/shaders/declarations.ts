import {
    compute,
    type DeclarationAttribute,
    type FunctionAttribute,
    fragment,
    type VariableOrValueAttribute,
    vertex,
} from './attributes';
import type { WgslDataType, WgslSampler, WgslSamplerComparison, WgslTextureDataType } from './wgsl-types';
import { wgslTypeName } from './wgsl-types';

function renderAttrs(attrs: DeclarationAttribute[] | undefined): string {
    return attrs && attrs.length > 0 ? attrs.map((attr) => `${attr.gen()}`).join(' ') + ' ' : '';
}

function renderTypeIdentifier(type: TypeIdentifier): string {
    if (typeof type === 'string') {
        return type;
    }
    if (!('kind' in type)) {
        // StructDeclaration or AliasDeclaration — both extend IdentifierDeclaration
        return type.name;
    }
    return wgslTypeName(type as WgslDataType);
}

/// TYPES

export type DeclarationGenerator = {
    readonly gen: () => string;
};

export type IdentifierDeclaration = {
    readonly name: string;
};

export type StructMemberDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        readonly type: TypeIdentifier;
        readonly attributes?: VariableOrValueAttribute[];
    };

export type StructDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'struct';
        readonly name: string;
        readonly fields: StructMemberDeclaration[];
    };

/**
 * `StructDecl<TsShape>` is a `StructDeclaration` annotated with a phantom TypeScript
 * shape describing the host-side representation of the struct's contents.
 *
 * The phantom is consumed by typed slot factories (e.g. `slot.uniform<T>`) so that
 * downstream resources can expose strongly-typed `set(values)` APIs without runtime
 * cost. When `TsShape` is `unknown` (the default), the struct behaves like an
 * untyped `StructDeclaration` and slots fall back to `unknown`-keyed updates.
 *
 * Example:
 * ```ts
 * type MyUniforms = { time: number; color: readonly number[] };
 * const U = struct<MyUniforms>('U', [member('time', 'f32'), member('color', 'vec3f')]);
 * const u = slot.uniform('u', U); // `u` carries `MyUniforms` through to `set()`
 * ```
 */
export type StructDecl<TsShape = unknown> = StructDeclaration & {
    readonly __tsShape?: TsShape;
};

export type AliasDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'alias';
        readonly aliasedType: TypeIdentifier;
    };

export type WgslType = string | WgslDataType;

export type TypeIdentifier = WgslType | StructDeclaration | AliasDeclaration;

export type FunctionParameterDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        readonly type: TypeIdentifier;
        readonly attributes?: VariableOrValueAttribute[];
    };

export type FunctionReturnTypeDeclaration = DeclarationGenerator & {
    readonly type: TypeIdentifier;
    readonly attributes?: VariableOrValueAttribute[];
};

export type FunctionDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'function';
        readonly parameters: FunctionParameterDeclaration[];
        readonly body: () => string;
        readonly returnType?: FunctionReturnTypeDeclaration;
        readonly attributes?: FunctionAttribute[];
    };

export type ConstValueDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'value';
        readonly assignmentType: 'const';
        readonly type?: TypeIdentifier;
        readonly initializer: unknown;
    };

export type OverrideValueDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'value';
        readonly assignmentType: 'override';
        readonly attributes?: VariableOrValueAttribute[];
    } & (
        | {
              readonly type: TypeIdentifier;
              readonly initializer?: unknown;
          }
        | {
              readonly type?: TypeIdentifier;
              readonly initializer: unknown;
          }
    );

// NOTE: skipping function-scoped vars because those are handled entirely within a function body and have no direct
// relationship to the resource interface of a shader, nor are they defined outside of function bodies so we don't
// need to include them for the sake of generating the shader itself
export type ValueDeclaration = ConstValueDeclaration | OverrideValueDeclaration;

export type PrivateVariableDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'variable';
        readonly assignmentType: 'private';
        readonly type?: TypeIdentifier;
        readonly initializer?: unknown;
    };

export type WorkgroupVariableDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'variable';
        readonly assignmentType: 'workgroup';
        readonly type: TypeIdentifier;
    };

// NOTE: currently, these "Resource Interface" declarations hard-code their group and binding, but
// at least in theory these could also be specified in the "attributes" array, which is not ideal.
// Need to revisit this at some point to reduce the duplication.
export type ResourceIdentifierDeclaration = {
    group: number;
    binding: number;
};

export type UniformVariableDeclaration = IdentifierDeclaration &
    ResourceIdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'variable';
        readonly assignmentType: 'uniform';
        readonly type: TypeIdentifier;
        readonly attributes?: VariableOrValueAttribute[];
    };

export type TextureVariableDeclaration = IdentifierDeclaration &
    ResourceIdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'variable';
        readonly assignmentType: 'texture';
        readonly type: WgslTextureDataType | `texture_${string}`;
        readonly attributes?: VariableOrValueAttribute[];
    };

export type SamplerVariableDeclaration = IdentifierDeclaration &
    ResourceIdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'variable';
        readonly assignmentType: 'sampler';
        readonly type: WgslSampler | WgslSamplerComparison | 'sampler' | 'sampler_comparison';
        readonly attributes?: VariableOrValueAttribute[];
    };

export type StorageVariableDeclaration = IdentifierDeclaration &
    ResourceIdentifierDeclaration &
    DeclarationGenerator & {
        readonly identType: 'variable';
        readonly assignmentType: 'storage';
        readonly type: TypeIdentifier;
        readonly accessMode?: 'read' | 'write' | 'read_write';
        readonly attributes?: VariableOrValueAttribute[];
    };

export type ResourceDeclaration =
    | UniformVariableDeclaration
    | TextureVariableDeclaration
    | SamplerVariableDeclaration
    | StorageVariableDeclaration;

export type Declaration = ValueDeclaration | StructDeclaration | ResourceDeclaration | FunctionDeclaration;

/// CONSTRUCTORS

export function constant(name: string, initializer: unknown, type?: TypeIdentifier): ConstValueDeclaration {
    return {
        identType: 'value',
        assignmentType: 'const',
        name,
        ...(type !== undefined && { type }),
        initializer,
        gen: () => `const ${name}${type !== undefined ? `: ${renderTypeIdentifier(type)}` : ''} = ${initializer};`,
    };
}

export function override(
    name: string,
    type?: TypeIdentifier,
    initializer?: unknown,
    attributes?: VariableOrValueAttribute[]
): OverrideValueDeclaration {
    if (type === undefined && initializer === undefined) {
        throw new Error('Override declaration must have at least a type or an initializer');
    }
    const gen = () =>
        `${renderAttrs(attributes)}var<override> ${name}${type !== undefined ? `: ${renderTypeIdentifier(type)}` : ''}${initializer !== undefined ? ` = ${initializer}` : ''};`;
    if (type === undefined) {
        return {
            identType: 'value',
            assignmentType: 'override',
            name,
            initializer,
            ...(attributes !== undefined && { attributes }),
            gen,
        };
    }
    return {
        identType: 'value' as const,
        assignmentType: 'override' as const,
        name,
        type,
        ...(initializer !== undefined && { initializer }),
        ...(attributes !== undefined && { attributes }),
        gen,
    };
}

export function privateVar(name: string, type?: TypeIdentifier, initializer?: unknown): PrivateVariableDeclaration {
    return {
        identType: 'variable',
        assignmentType: 'private',
        name,
        ...(type !== undefined && { type }),
        ...(initializer !== undefined && { initializer }),
        gen: () =>
            `var<private> ${name}${type !== undefined ? `: ${renderTypeIdentifier(type)}` : ''}${initializer !== undefined ? ` = ${initializer}` : ''};`,
    };
}

export function workgroupVar(name: string, type: TypeIdentifier): WorkgroupVariableDeclaration {
    return {
        identType: 'variable',
        assignmentType: 'workgroup',
        name,
        type,
        gen: () => `var<workgroup> ${name}: ${renderTypeIdentifier(type)};`,
    };
}

export function uniform(
    name: string,
    type: TypeIdentifier,
    group: number,
    binding: number,
    attributes?: VariableOrValueAttribute[]
): UniformVariableDeclaration {
    return {
        identType: 'variable',
        assignmentType: 'uniform',
        name,
        type,
        group,
        binding,
        ...(attributes !== undefined && { attributes }),
        gen: () =>
            `${renderAttrs(attributes)}@group(${group}) @binding(${binding}) var<uniform> ${name}: ${renderTypeIdentifier(type)};`,
    };
}

export function texture(
    name: string,
    type: WgslTextureDataType | `texture_${string}`,
    group: number,
    binding: number,
    attributes?: VariableOrValueAttribute[]
): TextureVariableDeclaration {
    return {
        identType: 'variable',
        assignmentType: 'texture',
        name,
        type,
        group,
        binding,
        ...(attributes !== undefined && { attributes }),
        gen: () =>
            `${renderAttrs(attributes)}@group(${group}) @binding(${binding}) var ${name}: ${renderTypeIdentifier(type)};`,
    };
}

export function sampler(
    name: string,
    type: WgslSampler | WgslSamplerComparison | 'sampler' | 'sampler_comparison',
    group: number,
    binding: number,
    attributes?: VariableOrValueAttribute[]
): SamplerVariableDeclaration {
    return {
        identType: 'variable',
        assignmentType: 'sampler',
        name,
        type,
        group,
        binding,
        gen: () =>
            `${renderAttrs(attributes)}@group(${group}) @binding(${binding}) var ${name}: ${renderTypeIdentifier(type)};`,
        ...(attributes !== undefined && { attributes }),
    };
}

export function storage(
    name: string,
    type: TypeIdentifier,
    group: number,
    binding: number,
    accessMode?: 'read' | 'write' | 'read_write',
    attributes?: VariableOrValueAttribute[]
): StorageVariableDeclaration {
    return {
        identType: 'variable',
        assignmentType: 'storage',
        name,
        type,
        group,
        binding,
        ...(accessMode !== undefined && { accessMode }),
        ...(attributes !== undefined && { attributes }),
        gen: () =>
            `${renderAttrs(attributes)}@group(${group}) @binding(${binding}) var<storage${accessMode !== undefined ? `, ${accessMode}` : ''}> ${name}: ${renderTypeIdentifier(type)};`,
    };
}

export function member(
    name: string,
    type: TypeIdentifier,
    attributes?: VariableOrValueAttribute[]
): StructMemberDeclaration {
    return {
        name,
        type,
        ...(attributes !== undefined && { attributes }),
        gen: () => `${renderAttrs(attributes)}${name}: ${renderTypeIdentifier(type)}`,
    };
}

export function struct<TsShape = unknown>(name: string, fields: StructMemberDeclaration[]): StructDecl<TsShape> {
    return {
        identType: 'struct',
        name,
        fields,
        gen: () => `struct ${name} { ${fields.map((f) => f.gen()).join(', ')} }`,
    };
}

export function alias(name: string, aliasedType: TypeIdentifier): AliasDeclaration {
    return {
        identType: 'alias',
        name,
        aliasedType,
        gen: () => `alias ${name} = ${renderTypeIdentifier(aliasedType)};`,
    };
}

export function param(
    name: string,
    type: TypeIdentifier,
    attributes?: VariableOrValueAttribute[]
): FunctionParameterDeclaration {
    return {
        name,
        type,
        ...(attributes !== undefined && { attributes }),
        gen: () => `${renderAttrs(attributes)}${name}: ${renderTypeIdentifier(type)}`,
    };
}

export function returns(type: TypeIdentifier, attributes?: VariableOrValueAttribute[]): FunctionReturnTypeDeclaration {
    return {
        type,
        ...(attributes !== undefined && { attributes }),
        gen: () => `${renderAttrs(attributes)}${renderTypeIdentifier(type)}`,
    };
}

export function func(
    name: string,
    parameters: FunctionParameterDeclaration[],
    body: () => string,
    returnType?: FunctionReturnTypeDeclaration,
    attributes?: FunctionAttribute[]
): FunctionDeclaration {
    return {
        identType: 'function',
        name,
        parameters,
        body,
        ...(returnType !== undefined && { returnType }),
        ...(attributes !== undefined && { attributes }),
        gen: () => {
            const params = parameters.map((p) => p.gen()).join(', ');
            const ret = returnType ? ` -> ${returnType.gen()}` : '';
            return `${renderAttrs(attributes)}fn ${name}(${params})${ret} { ${body()} }`;
        },
    };
}

export function vertexEntry(
    name: string,
    parameters: FunctionParameterDeclaration[],
    body: () => string,
    returnType?: FunctionReturnTypeDeclaration
): FunctionDeclaration {
    return func(name, parameters, body, returnType, [vertex()]);
}

export function fragmentEntry(
    name: string,
    parameters: FunctionParameterDeclaration[],
    body: () => string,
    returnType?: FunctionReturnTypeDeclaration
): FunctionDeclaration {
    return func(name, parameters, body, returnType, [fragment()]);
}

export function computeEntry(
    name: string,
    parameters: FunctionParameterDeclaration[],
    body: () => string,
    returnType?: FunctionReturnTypeDeclaration
): FunctionDeclaration {
    return func(name, parameters, body, returnType, [compute()]);
}

const constructors = {
    constant,
    override,
    privateVar,
    workgroupVar,
    uniform,
    texture,
    sampler,
    member,
    struct,
    param,
    returns,
    func,
    vertexEntry,
    fragmentEntry,
    computeEntry,
};

export const decls = constructors;
