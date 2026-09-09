import type { DeclarationGenerator, WgslShader } from '../../shaders';
import { bind } from './bound';
import { isResourceSlot, type ResourceSlot } from './slot';

/**
 * Maps each `ResourceSlot` referenced by a shader to its assigned `{group, binding}`. The keys
 * are the original `ResourceSlot` object references — identity-based lookup, no name matching.
 */
export type BindingMap = ReadonlyMap<ResourceSlot, { group: number; binding: number }>;

/**
 * Returns a new `WgslShader` whose `ResourceSlot` declarations have been replaced with `BoundSlot`
 * wrappers carrying the assigned `{group, binding}`. Other declarations are passed through by
 * reference.
 *
 * Throws if any `ResourceSlot` in the shader has no entry in `bindings`. The error lists every
 * unbound slot name so the caller can diagnose all gaps in a single pass.
 */
export function bindShader(shader: WgslShader, bindings: BindingMap): WgslShader {
    const missing: string[] = [];
    const declarations: DeclarationGenerator[] = shader.declarations.map((d) => {
        if (!isResourceSlot(d)) return d;
        const entry = bindings.get(d);
        if (!entry) {
            missing.push(d.name);
            return d;
        }
        return bind(d, entry.group, entry.binding);
    });
    if (missing.length > 0) {
        throw new Error(`bindShader: no binding provided for slots: ${missing.join(', ')}`);
    }
    // Preserve the original shader's identity: bound and unbound forms reflect the same
    // logical shader, so downstream caches keyed on `id` (pipeline cache, reflection cache)
    // continue to hit. Only the slot declarations have been rewritten.
    return { id: shader.id, declarations };
}
