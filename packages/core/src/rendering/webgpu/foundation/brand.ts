/**
 * Shared runtime brand check used by every `is*` discriminator in the WebGPU renderer. Each
 * branded value carries a `__brand` symbol; this narrows `unknown` to objects stamped with the
 * given brand.
 */
export function isBranded<B extends symbol>(value: unknown, brand: B): value is { readonly __brand: B } {
    return (
        typeof value === 'object' &&
        value !== null &&
        '__brand' in value &&
        (value as { __brand: unknown }).__brand === brand
    );
}
