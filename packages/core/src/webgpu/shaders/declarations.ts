/**
 * This file defines the various types of declarations that can be used in our shader generation system,
 * including variables, constants, structs, and functions. Each declaration type includes a __gen method
 * that generates the corresponding WGSL code for that declaration.
 */

import {
    compute,
    fragment,
    vertex,
    type DeclarationAttribute,
    type FunctionAttribute,
    type VariableOrValueAttribute,
} from './attributes';

function renderAttrs(attrs: DeclarationAttribute[] | undefined): string {
    return attrs && attrs.length > 0 ? attrs.map((attr) => `${attr.__gen()}`).join(' ') + ' ' : '';
}

function renderTypeIdentifier(type: TypeIdentifier): string {
    if (typeof type === 'string') {
        return type;
    }
    return type.name;
}

/// TYPES

export type DeclarationGenerator = {
    __gen: () => string;
};

export type IdentifierDeclaration = {
    readonly name: string;
};

export type StructMemberDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        type: TypeIdentifier;
        attributes?: VariableOrValueAttribute[];
    };

export type StructDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        __identType: 'struct';
        name: string;
        fields: StructMemberDeclaration[];
    };

export type AliasDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        __identType: 'alias';
        aliasedType: TypeIdentifier;
    };

export type TypeIdentifier = string | StructDeclaration | AliasDeclaration;

export type FunctionParameterDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        type: TypeIdentifier;
        attributes?: VariableOrValueAttribute[];
    };

export type FunctionReturnTypeDeclaration = DeclarationGenerator & {
    type: TypeIdentifier;
    attributes?: VariableOrValueAttribute[];
};

export type FunctionDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        __identType: 'function';
        parameters: FunctionParameterDeclaration[];
        body: () => string;
        returnType?: FunctionReturnTypeDeclaration;
        attributes?: FunctionAttribute[];
    };

export type ConstValueDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        __identType: 'value';
        readonly assignmentType: 'const';
        readonly type?: TypeIdentifier;
        readonly initializer: unknown;
    };

export type OverrideValueDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        __identType: 'value';
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
        __identType: 'variable';
        readonly assignmentType: 'private';
        readonly type?: TypeIdentifier;
        readonly initializer?: unknown;
    };

export type WorkgroupVariableDeclaration = IdentifierDeclaration &
    DeclarationGenerator & {
        __identType: 'variable';
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
        __identType: 'variable';
        readonly assignmentType: 'uniform';
        readonly type: TypeIdentifier;
        readonly attributes?: VariableOrValueAttribute[];
    };

export type TextureVariableDeclaration = IdentifierDeclaration &
    ResourceIdentifierDeclaration &
    DeclarationGenerator & {
        __identType: 'variable';
        readonly assignmentType: 'texture';
        readonly type: `texture_${string}`;
        readonly attributes?: VariableOrValueAttribute[];
    };

export type SamplerVariableDeclaration = IdentifierDeclaration &
    ResourceIdentifierDeclaration &
    DeclarationGenerator & {
        __identType: 'variable';
        readonly assignmentType: 'sampler';
        readonly type: 'sampler' | 'sampler_comparison';
        readonly attributes?: VariableOrValueAttribute[];
    };

export type StorageVariableDeclaration = IdentifierDeclaration &
    ResourceIdentifierDeclaration &
    DeclarationGenerator & {
        __identType: 'variable';
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
        __identType: 'value',
        assignmentType: 'const',
        name,
        ...(type !== undefined && { type }),
        initializer,
        __gen: () => `const ${name}${type !== undefined ? `: ${renderTypeIdentifier(type)}` : ''} = ${initializer};`,
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
    const __gen = () =>
        `${renderAttrs(attributes)}var<override> ${name}${type !== undefined ? `: ${renderTypeIdentifier(type)}` : ''}${initializer !== undefined ? ` = ${initializer}` : ''};`;
    if (type === undefined) {
        return {
            __identType: 'value',
            assignmentType: 'override',
            name,
            initializer,
            ...(attributes !== undefined && { attributes }),
            __gen,
        };
    }
    return {
        __identType: 'value' as const,
        assignmentType: 'override' as const,
        name,
        type,
        ...(initializer !== undefined && { initializer }),
        ...(attributes !== undefined && { attributes }),
        __gen,
    };
}

export function privateVar(name: string, type?: TypeIdentifier, initializer?: unknown): PrivateVariableDeclaration {
    return {
        __identType: 'variable',
        assignmentType: 'private',
        name,
        ...(type !== undefined && { type }),
        ...(initializer !== undefined && { initializer }),
        __gen: () =>
            `var<private> ${name}${type !== undefined ? `: ${renderTypeIdentifier(type)}` : ''}${initializer !== undefined ? ` = ${initializer}` : ''};`,
    };
}

export function workgroupVar(name: string, type: TypeIdentifier): WorkgroupVariableDeclaration {
    return {
        __identType: 'variable',
        assignmentType: 'workgroup',
        name,
        type,
        __gen: () => `var<workgroup> ${name}: ${renderTypeIdentifier(type)};`,
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
        __identType: 'variable',
        assignmentType: 'uniform',
        name,
        type,
        group,
        binding,
        ...(attributes !== undefined && { attributes }),
        __gen: () =>
            `${renderAttrs(attributes)}@group(${group}) @binding(${binding}) var<uniform> ${name}: ${renderTypeIdentifier(type)};`,
    };
}

export function texture(
    name: string,
    type: `texture_${string}`,
    group: number,
    binding: number,
    attributes?: VariableOrValueAttribute[]
): TextureVariableDeclaration {
    return {
        __identType: 'variable',
        assignmentType: 'texture',
        name,
        type,
        group,
        binding,
        ...(attributes !== undefined && { attributes }),
        __gen: () =>
            `${renderAttrs(attributes)}@group(${group}) @binding(${binding}) var ${name}: ${renderTypeIdentifier(type)};`,
    };
}

export function sampler(
    name: string,
    type: 'sampler' | 'sampler_comparison',
    group: number,
    binding: number,
    attributes?: VariableOrValueAttribute[]
): SamplerVariableDeclaration {
    return {
        __identType: 'variable',
        assignmentType: 'sampler',
        name,
        type,
        group,
        binding,
        __gen: () =>
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
        __identType: 'variable',
        assignmentType: 'storage',
        name,
        type,
        group,
        binding,
        ...(accessMode !== undefined && { accessMode }),
        ...(attributes !== undefined && { attributes }),
        __gen: () =>
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
        __gen: () => `${renderAttrs(attributes)}${name}: ${renderTypeIdentifier(type)}`,
    };
}

export function struct(name: string, fields: StructMemberDeclaration[]): StructDeclaration {
    return {
        __identType: 'struct',
        name,
        fields,
        __gen: () => `struct ${name} { ${fields.map((f) => f.__gen()).join(', ')} }`,
    };
}

export function alias(name: string, aliasedType: TypeIdentifier): AliasDeclaration {
    return {
        __identType: 'alias',
        name,
        aliasedType,
        __gen: () => `alias ${name} = ${renderTypeIdentifier(aliasedType)};`,
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
        __gen: () => `${renderAttrs(attributes)}${name}: ${renderTypeIdentifier(type)}`,
    };
}

export function returns(type: TypeIdentifier, attributes?: VariableOrValueAttribute[]): FunctionReturnTypeDeclaration {
    return {
        type,
        ...(attributes !== undefined && { attributes }),
        __gen: () => `${renderAttrs(attributes)}${renderTypeIdentifier(type)}`,
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
        __identType: 'function',
        name,
        parameters,
        body,
        ...(returnType !== undefined && { returnType }),
        ...(attributes !== undefined && { attributes }),
        __gen: () => {
            const params = parameters.map((p) => p.__gen()).join(', ');
            const ret = returnType ? ` -> ${returnType.__gen()}` : '';
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

export const constructors = {
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
