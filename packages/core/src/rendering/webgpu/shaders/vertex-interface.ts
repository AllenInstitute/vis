/**
 * PROTOTYPE — declarative vertex shader *input interface*.
 *
 * Where `vertex-input.ts` models a special `vertexStruct`, this explores the more general shape:
 * a `vertexInput([...])` that accepts ordinary `struct` declarations AND loose entry `param`s
 * (including `@builtin(vertex_index | instance_index)`), validates that every leaf is a
 * well-formed vertex-stage input, and hands its parameter list to `vertexEntry(...)`. No special
 * "vertex struct" type is required — a plain `struct(...)` simply *works as* a vertex input.
 *
 * This deliberately covers only concern (1) from the design discussion — the WGSL input
 * *interface* + validation. The two orthogonal concerns are left as follow-ups:
 *   - per-attribute wire **format** (`GPUVertexFormat`) — a plain `member('c','vec4f',[location(1)])`
 *     can't say whether `c` is `unorm8x4` vs `float32x4`; the derived `attributes` here expose the
 *     WGSL type only.
 *   - **buffer grouping + stepMode** — not encoded by the WGSL interface at all.
 *
 * Example (mixed struct + loose @location + builtin):
 * ```ts
 * const VertexIn = struct('VertexIn', [
 *     member('position', 'vec3f', [location(0)]),
 *     member('color',    'vec4f', [location(1)]),
 * ]);
 * const vin = vertexInput([
 *     VertexIn,                                   // struct → flattened @location members
 *     param('instanceOffset', 'vec3f', [location(2)]), // loose per-instance-ish attribute
 *     param('vertIdx', 'u32', [builtin('vertex_index')]), // builtin (no buffer)
 * ]);
 * const shader = shader([...vin.structs, vin.entry('vs_main', () => '...', returns('vec4f', [builtin('position')]))]);
 * ```
 */

import type { BuiltinAttribute, LocationAttribute, VariableOrValueAttribute } from './attributes';
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
 *  `GPUVertexFormat` is a follow-up concern (see file header). */
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

/** Compose + validate a vertex shader input interface from ordinary `struct` declarations and/or
 *  loose entry `param`s. Throws (aggregating every problem) if any leaf is not a valid vertex
 *  input: each leaf must carry exactly one of `@location` or a vertex-stage `@builtin`, and all
 *  `@location`s must be unique across the whole interface. */
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
    return (
        typeof value === 'object' &&
        value !== null &&
        (value as { __brand?: unknown }).__brand === VERTEX_INPUT_BRAND
    );
}
