/**
 * This file defines the `WgslShader` type, which represents a shader program in WGSL.
 * Also included are methods for serializing and deserializing the shader definition, as
 * well as generating the WGSL source code from a `WgslShader` object and its declarations.
 * The `shader` function is a simple helper function for creating a new `WgslShader`
 * object from an array of declarations.
 */

import type { Declaration } from './declarations';

export type WgslShader = {
    declarations: Declaration[];
};

// NOTE: In the future, we may want to add further typeguards for the different declarations
// so that we can confirm the structure of the whole shader; for now, this is sufficient for
// some basic type safety for shader string rendering, deserialization, etc.
export function isWgslShader(value: unknown): value is WgslShader {
    return typeof value === 'object' && value !== null && 'declarations' in value && Array.isArray(value.declarations);
}

export function asSource(shader: WgslShader): string {
    if (isWgslShader(shader)) {
        return shader.declarations.map((d) => d.__gen()).join(';\n');
    } else {
        throw new Error('Invalid shader object');
    }
}

export function shader(declarations: Declaration[]): WgslShader {
    return { declarations };
}

export function serializeShader(shader: WgslShader): string {
    return JSON.stringify(shader);
}

export function deserializeShader(serialized: string): WgslShader {
    const parsed = JSON.parse(serialized);
    if (isWgslShader(parsed)) {
        return parsed;
    } else {
        throw new Error('Invalid serialized shader');
    }
}
