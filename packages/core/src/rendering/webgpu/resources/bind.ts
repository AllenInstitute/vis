/**
 * `bindShader` substitutes every `Resource` in a `WgslShader`'s declarations array with a
 * `BoundResource` (using `{group, binding}` entries supplied by the caller, typically produced
 * by a binding-graph traversal). Non-Resource declarations pass through unchanged.
 *
 * After `bindShader`, the returned shader is fully renderable via `asSource()`.
 */

import type { DeclarationGenerator, WgslShader } from '../shaders';
import { bind } from './bound';
import { isResource, type Resource } from './resource';

/**
 * Maps each `Resource` referenced by a shader to its assigned `{group, binding}`. The keys are
 * the original `Resource` object references — identity-based lookup, no name matching.
 */
export type BindingMap = ReadonlyMap<Resource, { group: number; binding: number }>;

/**
 * Returns a new `WgslShader` whose `Resource` declarations have been replaced with `BoundResource`
 * wrappers carrying the assigned `{group, binding}`. Other declarations are passed through by
 * reference.
 *
 * Throws if any `Resource` in the shader has no entry in `bindings`. The error lists every
 * unbound resource name so the caller can diagnose all gaps in a single pass.
 */
export function bindShader(shader: WgslShader, bindings: BindingMap): WgslShader {
    const missing: string[] = [];
    const declarations: DeclarationGenerator[] = shader.declarations.map((d) => {
        if (!isResource(d)) return d;
        const entry = bindings.get(d);
        if (!entry) {
            missing.push(d.name);
            return d;
        }
        return bind(d, entry.group, entry.binding);
    });
    if (missing.length > 0) {
        throw new Error(`bindShader: no binding provided for resources: ${missing.join(', ')}`);
    }
    return { declarations };
}
