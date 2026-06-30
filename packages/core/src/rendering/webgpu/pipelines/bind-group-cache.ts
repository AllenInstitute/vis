/**
 * Cache-key helpers for assembled `GPUBindGroup` objects.
 *
 * The actual bind-group cache lives in the encoder layer (see
 * `packages/core/src/rendering/webgpu/plan-2026-06-01.md`); this module just declares the agreed
 * key shape so the encoder and any provider-aware caller produce identical keys for the same
 * `(layout, drawable, content)` triple.
 *
 * What the key encodes (and what it does not). The key must change whenever the assembled
 * `GPUBindGroup` would change. That happens when:
 *   1. The drawable identity changes (`ctx.drawableId`).
 *   2. The layout shape changes (which group, which binding count) - captured as a layout
 *      fingerprint computed from `LayoutResult.layouts`.
 *   3. The content backing any binding changes - captured by the caller-supplied
 *      `contentVersions` parallel array.
 *
 * The key does NOT encode bind-group-layout entry contents (sample types, formats, etc.) - those
 * are static for the lifetime of the `LayoutResult`. If the caller swaps in a new `LayoutResult`
 * (e.g., after a layout-shape change), keys minted against the new layout are naturally distinct
 * from keys minted against the old one because the layout fingerprint changes.
 *
 * Phase 1 ships these declarations only; no consumer wires them up. The encoder PR (see
 * `plan-2026-06-01.md`) will be the first consumer.
 */

import type { DrawContext } from './draw-context';
import type { LayoutResult } from './traversal';

/** Stable string identifier for an assembled `GPUBindGroup`. Suitable as a `Map` key. */
export type BindGroupCacheKey = string;

/**
 * Per-slot content version vector parallel to `LayoutResult.slots`. `contentVersions[g][b]` is a
 * monotonically increasing number bumped by the owner of the binding's data whenever that data
 * changes in a way the cached `GPUBindGroup` would not see (typically: the provider returns a
 * different `GPUBuffer` object, or the underlying texture view is recreated).
 *
 * For fixed slots whose data never changes, the caller may pass `0` indefinitely.
 */
export type ContentVersions = ReadonlyArray<ReadonlyArray<number>>;

/**
 * Compute the stable cache key for the bind groups assembled from `layout` against `ctx` with
 * the given per-slot `contentVersions`. The function is pure: identical inputs produce an
 * identical key string.
 *
 * Throws if `contentVersions` does not match the shape of `layout.slots`.
 */
export function computeBindGroupCacheKey(
    layout: LayoutResult,
    ctx: DrawContext,
    contentVersions: ContentVersions
): BindGroupCacheKey {
    if (contentVersions.length !== layout.slots.length) {
        throw new Error(
            `computeBindGroupCacheKey: contentVersions has ${contentVersions.length} groups, ` +
                `but layout has ${layout.slots.length}.`
        );
    }

    const layoutFingerprint = layout.layouts.map((entries) => entries.length).join(',');
    const versionParts: string[] = [];
    for (let g = 0; g < layout.slots.length; g++) {
        const groupSlots = layout.slots[g];
        const groupVersions = contentVersions[g];
        if (groupSlots === undefined || groupVersions === undefined) {
            throw new Error(`computeBindGroupCacheKey: missing entry at group ${g}.`);
        }
        if (groupVersions.length !== groupSlots.length) {
            throw new Error(
                `computeBindGroupCacheKey: contentVersions[${g}] has ${groupVersions.length} entries, ` +
                    `but layout group ${g} has ${groupSlots.length} bindings.`
            );
        }
        versionParts.push(groupVersions.join(','));
    }

    return `${ctx.drawableId}#L:${layoutFingerprint}#V:${versionParts.join('|')}`;
}
