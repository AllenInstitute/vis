/**
 * Shared runtime brand check used by every `is*` discriminator in the WebGPU renderer. Each
 * branded value carries a `brand` symbol; this narrows `unknown` to objects stamped with the
 * given brand.
 */
export function isBranded<B extends symbol>(value: unknown, brand: B): value is { readonly brand: B } {
    return (
        typeof value === 'object' &&
        value !== null &&
        'brand' in value &&
        (value as { brand: unknown }).brand === brand
    );
}
