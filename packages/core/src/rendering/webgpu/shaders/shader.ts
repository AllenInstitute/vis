/**
 * This file defines the `WgslShader` type, which represents a shader program in WGSL.
 * Also included is a method for generating the WGSL source code from a `WgslShader`
 * object and its declarations. The `shader` function is a simple helper function for
 * creating a new `WgslShader` object from an array of declarations.
 *
 * NOTE: `WgslShader.declarations` is intentionally typed as `DeclarationGenerator[]`
 * (the minimal `{ __gen(): string }` interface) rather than the concrete `Declaration`
 * union. This lets higher-level modules (e.g., `resources/`) define their own objects
 * that satisfy the declaration interface and drop them directly into a shader without
 * `shaders/` needing to know about them — preserving a one-way dependency.
 */

import type { DeclarationGenerator } from './declarations';

export type WgslShader = {
    declarations: DeclarationGenerator[];
};

// NOTE: In the future, we may want to add further typeguards for the different declarations
// so that we can confirm the structure of the whole shader; for now, this is sufficient for
// some basic type safety for shader string rendering, deserialization, etc.
export function isWgslShader(value: unknown): value is WgslShader {
    return typeof value === 'object' && value !== null && 'declarations' in value && Array.isArray(value.declarations);
}

export function asSource(shader: WgslShader): string {
    if (isWgslShader(shader)) {
        return shader.declarations.map((d) => d.__gen()).join('\n');
    }
    throw new Error('Invalid shader object');
}

export function shader(declarations: DeclarationGenerator[]): WgslShader {
    return { declarations };
}
