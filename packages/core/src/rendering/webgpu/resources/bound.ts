/**
 * Defines `BoundSlot` — a `ResourceSlot` that has been assigned a `{group, binding}` pair via
 * a binding-graph traversal. The wrapper is frozen (immutable) and carries a working `__gen()`
 * that produces the WGSL declaration by delegating to the existing `$s.uniform / $s.texture /
 * $s.sampler / $s.storage` constructors in `shaders/declarations.ts`.
 *
 * Producing a `BoundSlot` does NOT mutate the original `ResourceSlot` — the source descriptor
 * stays metadata-only and can be reused across multiple binding layouts.
 */

import type { BindGroupLayoutEntry, ShaderStageFlags } from '../native-types';
import { sampler as samplerDecl, storage as storageDecl, texture as textureDecl, uniform as uniformDecl } from '../shaders';
import type { ResourceSlot } from './resource';

/**
 * A `BoundSlot` is a `ResourceSlot` extended with `{group, binding}` and a working `__gen()`.
 * It is the value the shader-source generator actually emits WGSL for.
 *
 * The generic parameter narrows to the underlying `ResourceSlot` variant so consumers can
 * pattern-match on `kind` and access kind-specific metadata.
 */
export type BoundSlot<R extends ResourceSlot = ResourceSlot> = Readonly<
    R & {
        readonly group: number;
        readonly binding: number;
        __gen(): string;
    }
>;

/**
 * Wraps a `ResourceSlot` with a `{group, binding}` and a working `__gen()`. The returned object
 * is frozen. The original `ResourceSlot` is not mutated.
 */
export function bind<R extends ResourceSlot>(slot: R, group: number, binding: number): BoundSlot<R> {
    const gen = makeGenFor(slot, group, binding);
    const bound = {
        ...slot,
        group,
        binding,
        __gen: gen,
    };
    return Object.freeze(bound) as BoundSlot<R>;
}

/**
 * Builds the `__gen` thunk for a bound slot by delegating to the existing declaration
 * constructors. This keeps WGSL formatting in a single place (`shaders/declarations.ts`).
 */
function makeGenFor(r: ResourceSlot, group: number, binding: number): () => string {
    switch (r.kind) {
        case 'uniform':
            return uniformDecl(r.name, r.type, group, binding, r.attributes).__gen;
        case 'storage':
            return storageDecl(r.name, r.type, group, binding, r.accessMode, r.attributes).__gen;
        case 'texture':
            return textureDecl(r.name, r.type, group, binding, r.attributes).__gen;
        case 'storageTexture':
            // Storage textures share the WGSL `var` declaration syntax with sampled textures;
            // the texel-format/access metadata is encoded in the type identifier (e.g.,
            // `texture_storage_2d<rgba8unorm, write>`) which the caller supplied as `r.type`.
            return textureDecl(r.name, r.type, group, binding, r.attributes).__gen;
        case 'sampler':
            return samplerDecl(r.name, r.type, group, binding, r.attributes).__gen;
        case 'externalTexture':
            return textureDecl(
                r.name,
                'texture_external' as `texture_${string}`,
                group,
                binding,
                r.attributes
            ).__gen;
    }
}

/**
 * Derives a `GPUBindGroupLayoutEntry` for a bound slot. The `visibility` argument lets the
 * caller (typically the binding-graph traversal) supply the union of stages from every pipeline
 * that references this slot; pass `bound.visibility` directly when no traversal is involved.
 */
export function toBindGroupLayoutEntry(bound: BoundSlot, visibility: ShaderStageFlags): BindGroupLayoutEntry {
    const base = { binding: bound.binding, visibility };
    switch (bound.kind) {
        case 'uniform':
            return {
                ...base,
                buffer: {
                    type: 'uniform',
                    ...(bound.hasDynamicOffset !== undefined && { hasDynamicOffset: bound.hasDynamicOffset }),
                    ...(bound.minBindingSize !== undefined && { minBindingSize: bound.minBindingSize }),
                },
            };
        case 'storage':
            return {
                ...base,
                buffer: {
                    type: bound.accessMode === 'read' ? 'read-only-storage' : 'storage',
                    ...(bound.hasDynamicOffset !== undefined && { hasDynamicOffset: bound.hasDynamicOffset }),
                    ...(bound.minBindingSize !== undefined && { minBindingSize: bound.minBindingSize }),
                },
            };
        case 'texture':
            return {
                ...base,
                texture: {
                    ...(bound.sampleType !== undefined && { sampleType: bound.sampleType }),
                    ...(bound.viewDimension !== undefined && { viewDimension: bound.viewDimension }),
                    ...(bound.multisampled !== undefined && { multisampled: bound.multisampled }),
                },
            };
        case 'storageTexture':
            return {
                ...base,
                storageTexture: {
                    format: bound.format,
                    ...(bound.access !== undefined && { access: bound.access }),
                    ...(bound.viewDimension !== undefined && { viewDimension: bound.viewDimension }),
                },
            };
        case 'sampler':
            return {
                ...base,
                sampler: {
                    ...(bound.bindingType !== undefined && { type: bound.bindingType }),
                },
            };
        case 'externalTexture':
            return { ...base, externalTexture: {} };
    }
}
