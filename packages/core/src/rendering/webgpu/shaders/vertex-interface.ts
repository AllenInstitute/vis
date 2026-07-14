import type { BuiltinAttribute, LocationAttribute, VariableOrValueAttribute } from './attributes';
import { isBranded } from '../brand';
import {
    type FunctionDeclaration,
    type FunctionParameterDeclaration,
    type FunctionReturnTypeDeclaration,
    param,
    type StructDeclaration,
    type TypeIdentifier,
    vertexEntry,
} from './declarations';
import { type WgslDataType, wgslTypeName } from './wgsl-types';

/** The `@builtin`s valid as *vertex-stage inputs*. (`position` is a vertex *output*; the rest are
 *  compute/fragment builtins.) */
export const VERTEX_INPUT_BUILTINS = ['vertex_index', 'instance_index'] as const;
export type VertexInputBuiltinName = (typeof VERTEX_INPUT_BUILTINS)[number];

/** A buffer-backed `@location` leaf of the interface. Carries the WGSL type only — the wire
 *  `GPUVertexFormat` is handled separately (see file header). */
export interface VertexInputAttribute {
    readonly name: string;
    readonly location: number;
    readonly wgslType: string;
    /** Source struct name when the leaf came from a struct member; omitted for loose params. */
    readonly struct?: string;
}

/** A `@builtin` leaf of the interface (driver-generated; never buffer-backed). */
export interface VertexInputBuiltin {
    readonly name: string;
    readonly builtin: VertexInputBuiltinName;
    readonly wgslType: string;
    readonly struct?: string;
}

/** Brand marking a validated vertex input interface. */
export const VERTEX_INPUT_BRAND: unique symbol = Symbol.for('vis-core.webgpu.VertexInput');

/** A validated vertex shader input interface: the entry parameter list, the struct declarations it
 *  references (for top-level emission), and the classified `@location` / `@builtin` leaves. */
export interface VertexInputInterface {
    readonly __brand: typeof VERTEX_INPUT_BRAND;
    /** Parameters to hand to the vertex entry function's signature. */
    readonly params: readonly FunctionParameterDeclaration[];
    /** Struct declarations referenced by the interface (drop these into `shader([...])`). */
    readonly structs: readonly StructDeclaration[];
    /** Buffer-backed attributes (`@location` leaves), in declaration order. */
    readonly attributes: readonly VertexInputAttribute[];
    /** Builtin leaves (`@builtin(vertex_index | instance_index)`). */
    readonly builtins: readonly VertexInputBuiltin[];
    /** Convenience: build the `@vertex` entry function using this interface's parameters. */
    entry(name: string, body: () => string, returnType?: FunctionReturnTypeDeclaration): FunctionDeclaration;
}

// ---- internals ------------------------------------------------------------------------------

function isLocationAttr(a: VariableOrValueAttribute): a is LocationAttribute {
    return 'location' in a;
}
function isBuiltinAttr(a: VariableOrValueAttribute): a is BuiltinAttribute {
    return 'builtin' in a;
}
function isStructDeclaration(t: unknown): t is StructDeclaration {
    return (
        typeof t === 'object' &&
        t !== null &&
        (t as { __identType?: unknown }).__identType === 'struct'
    );
}

/** Render a `TypeIdentifier` to its WGSL source string (mirror of the private helper in
 *  `declarations.ts`). */
function renderType(type: TypeIdentifier): string {
    if (typeof type === 'string') return type;
    if (!('kind' in type)) return type.name; // StructDeclaration | AliasDeclaration
    return wgslTypeName(type as WgslDataType);
}

/** Derive an entry-param name for a bare struct input (`VertexIn` → `vertexIn`). Pass an explicit
 *  `param(name, struct)` instead if you need to control the name used in the shader body. */
function deriveParamName(structName: string): string {
    return structName.length > 0 ? structName.charAt(0).toLowerCase() + structName.slice(1) : 'input';
}

// ---- builder --------------------------------------------------------------------------------

/**
 * Compose + validate a vertex shader input interface from ordinary `struct` declarations and/or
 * loose entry `param`s (including `@builtin(vertex_index | instance_index)`). Throws (aggregating
 * every problem) if any leaf is invalid: each must carry exactly one of `@location` or a
 * vertex-stage `@builtin`, and all `@location`s must be unique across the interface.
 *
 * This is the shader-side vertex-input surface: it yields the `@vertex` entry's parameter list
 * (via `.entry(...)`) plus the classified `@location` / `@builtin` leaves (the latter are
 * driver-generated and never buffer-backed). The complementary buffer-side concerns — per-attribute
 * `GPUVertexFormat`, buffer grouping, and `stepMode` — are added by `vertexLayout(vin, ...)`, which
 * consumes the returned interface.
 */
export function vertexInput(
    inputs: readonly (StructDeclaration | FunctionParameterDeclaration)[]
): VertexInputInterface {
    const params: FunctionParameterDeclaration[] = [];
    const structs: StructDeclaration[] = [];
    const attributes: VertexInputAttribute[] = [];
    const builtins: VertexInputBuiltin[] = [];
    const seenLocations = new Map<number, string>();
    const errors: string[] = [];

    const classifyLeaf = (
        leafName: string,
        attrs: readonly VariableOrValueAttribute[] | undefined,
        wgslType: string,
        structName?: string
    ): void => {
        const loc = attrs?.find(isLocationAttr);
        const bi = attrs?.find(isBuiltinAttr);
        if (loc !== undefined && bi !== undefined) {
            errors.push(`'${leafName}' has both @location and @builtin — a vertex input leaf must declare exactly one.`);
            return;
        }
        if (loc === undefined && bi === undefined) {
            errors.push(`'${leafName}' has neither @location nor @builtin — every vertex input leaf must declare one.`);
            return;
        }
        if (bi !== undefined) {
            if (!VERTEX_INPUT_BUILTINS.includes(bi.builtin as VertexInputBuiltinName)) {
                errors.push(
                    `'${leafName}' uses @builtin(${bi.builtin}) — only ${VERTEX_INPUT_BUILTINS.join(' / ')} are valid vertex-stage inputs.`
                );
                return;
            }
            builtins.push({
                name: leafName,
                builtin: bi.builtin as VertexInputBuiltinName,
                wgslType,
                ...(structName !== undefined && { struct: structName }),
            });
            return;
        }
        // location leaf
        const prior = seenLocations.get((loc as LocationAttribute).location);
        const locNum = (loc as LocationAttribute).location;
        if (prior !== undefined) {
            errors.push(`duplicate @location(${locNum}) on '${prior}' and '${leafName}' — vertex locations must be unique.`);
        } else {
            seenLocations.set(locNum, leafName);
        }
        attributes.push({
            name: leafName,
            location: locNum,
            wgslType,
            ...(structName !== undefined && { struct: structName }),
        });
    };

    const addStruct = (s: StructDeclaration): void => {
        if (!structs.includes(s)) structs.push(s);
        for (const f of s.fields) classifyLeaf(f.name, f.attributes, renderType(f.type), s.name);
    };

    for (const input of inputs) {
        if (isStructDeclaration(input)) {
            params.push(param(deriveParamName(input.name), input));
            addStruct(input);
        } else {
            params.push(input);
            if (isStructDeclaration(input.type)) {
                addStruct(input.type);
            } else {
                classifyLeaf(input.name, input.attributes, renderType(input.type));
            }
        }
    }

    if (errors.length > 0) {
        throw new Error(`vertexInput: invalid vertex input interface:\n  - ${errors.join('\n  - ')}`);
    }

    return {
        __brand: VERTEX_INPUT_BRAND,
        params,
        structs,
        attributes,
        builtins,
        entry(name, body, returnType) {
            return vertexEntry(name, params, body, returnType);
        },
    };
}

/** Runtime discriminator for a `VertexInputInterface`. */
export function isVertexInput(value: unknown): value is VertexInputInterface {
    return isBranded(value, VERTEX_INPUT_BRAND);
}
