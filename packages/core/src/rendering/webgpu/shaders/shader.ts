import { v4 as uuidv4 } from 'uuid';
import type { DeclarationGenerator } from './declarations';

export type WgslShader = {
    /** Opaque stable identity (UUID v4) assigned by `shader()`; usable as a stable key by downstream
     *  caches (pipeline cache, `webgpu-utils` reflection, binding-graph traversal). Callers generally
     *  should not generate it themselves (use `shader()` below) or read structural meaning into it. */
    readonly id: string;
    /** Typed as the minimal `DeclarationGenerator` (`{ __gen(): string }`) rather than the concrete
     *  `Declaration` union, so higher-level modules (e.g. `binding/`) can define their own objects
     *  that satisfy the interface and drop them in without `shaders/` depending on them. */
    declarations: DeclarationGenerator[];
};

export function isWgslShader(value: unknown): value is WgslShader {
    return (
        typeof value === 'object' &&
        value !== null &&
        'declarations' in value &&
        Array.isArray((value as { declarations: unknown }).declarations) &&
        'id' in value &&
        typeof (value as { id: unknown }).id === 'string'
    );
}

export function asSource(shader: WgslShader): string {
    if (isWgslShader(shader)) {
        return shader.declarations.map((d) => d.__gen()).join('\n');
    }
    throw new Error('Invalid shader object');
}

/** Create a `WgslShader` from an array of declarations, stamping a fresh opaque `id`. */
export function shader(declarations: DeclarationGenerator[]): WgslShader {
    return { id: uuidv4(), declarations };
}
