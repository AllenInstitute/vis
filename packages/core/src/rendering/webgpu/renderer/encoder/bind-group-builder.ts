import type {
    BufferResource,
    ExternalTextureResource,
    RawBufferResource,
    Resource,
    ResourceSlot,
    SamplerResource,
    StorageTextureResource,
    TextureResource,
} from '../../resources';
import type { Drawable } from '../drawable';
import type { BuiltPipeline } from '../pipelines/build';

/** Storage shape the bind-group builder consults. Lives on `RenderingContext`. */
export interface BindGroupCacheStore {
    /** Map of cache key → assembled `GPUBindGroup`. The cache is unbounded; callers
     *  invalidate selectively via `sweepBindGroupCache` or wholesale via `cache.clear()`
     *  (e.g. `ctx.dispose()`). */
    readonly cache: Map<string, GPUBindGroup>;
    /** Forward index: cache key → the (deduped) resources whose id+version composed it. Used
     *  to clean the reverse index when an entry is swept. */
    readonly keyToResources: Map<string, readonly Resource[]>;
    /** Reverse index: resource → the set of cache keys referencing it. `WeakMap` so a resource
     *  that becomes unreachable drops out automatically without an explicit reset. */
    readonly resourceToKeys: WeakMap<Resource, Set<string>>;
}

/** Per-call inputs assembled by the encoder before calling into the builder. */
export interface BindGroupBuildArgs {
    readonly device: GPUDevice;
    readonly pipeline: BuiltPipeline;
    readonly drawable: Drawable;
    /** Stack of binding-override maps from outermost (root-ward) to innermost (draw-ward). The
     *  innermost map that contains a given slot wins; slots not in any map fall through to
     *  `drawable.bindings`. */
    readonly overrideStack: readonly ReadonlyMap<ResourceSlot, Resource>[];
    readonly store: BindGroupCacheStore;
}

/** The set of bind groups + their cache keys for one drawable + override-stack combination. */
export interface ResolvedBindGroups {
    /** Bind groups keyed by group index (0..bindGroupLayouts.length-1). */
    readonly groups: ReadonlyMap<number, GPUBindGroup>;
    /** Parallel cache-key vector for testing / instrumentation. */
    readonly keys: ReadonlyMap<number, string>;
}

/** Resolve every bind group required by `pipeline` for `drawable`, honoring the override
 *  stack. Cached: identical (pipeline, drawable bindings, overrides, resource versions) returns
 *  the same `GPUBindGroup` instance from the store on subsequent calls. */
export function buildBindGroupsForDraw(args: BindGroupBuildArgs): ResolvedBindGroups {
    const { device, pipeline, drawable, overrideStack, store } = args;
    const groups = new Map<number, GPUBindGroup>();
    const keys = new Map<number, string>();

    // Bucket the pipeline's slots by group index. We use `pipeline.slotIndex` (which carries
    // {group, binding} per slot used by the shader), pre-built at pipeline-build time.
    const slotsByGroup = new Map<number, Array<{ slot: ResourceSlot; binding: number }>>();
    for (const [slot, { group, binding }] of pipeline.slotIndex) {
        let arr = slotsByGroup.get(group);
        if (arr === undefined) {
            arr = [];
            slotsByGroup.set(group, arr);
        }
        arr.push({ slot, binding });
    }

    for (const [groupIdx, slotEntries] of slotsByGroup) {
        // Sort by binding so the entries array order matches WebGPU's expectation (the order
        // doesn't strictly matter — `binding` is what the driver indexes by — but a stable
        // order makes the cache key deterministic).
        slotEntries.sort((a, b) => a.binding - b.binding);

        const tokens: string[] = [];
        const overrideTags: string[] = [];
        const entries: GPUBindGroupEntry[] = [];
        const groupResources: Resource[] = [];

        for (const { slot, binding } of slotEntries) {
            const resolved = resolveBinding(slot, drawable, overrideStack);
            const r = resolved.resource;
            const token = `${r.id}.${r.version}`;
            tokens.push(token);
            if (resolved.fromOverride) {
                overrideTags.push(`${binding}:${token}`);
            }
            groupResources.push(r);
            entries.push(makeBindGroupEntry(binding, r, slot));
        }

        // Cache key: `${fingerprint}|g${groupIdx}|${tokens}|${overrideTags}`, where each token is
        // `${resource.id}.${resource.version}` (stable UUID + mutation version) in ascending
        // binding order, and overrideTags additionally records `${binding}:${token}` for slots
        // supplied by the override stack. Including the resource `id` (not just version) keeps the
        // key identity-unique — two resources sharing a slot+version can't collide onto one
        // `GPUBindGroup` — and lets `sweepBindGroupCache` map an invalidated resource back to its
        // entries. The fingerprint is used (not a per-build id) because the pipeline cache
        // guarantees fingerprint ↔ `BuiltPipeline` uniqueness and is stable across rebuilds.
        const key = `${pipeline.fingerprint}|g${groupIdx}|${tokens.join(',')}|${overrideTags.join(';')}`;
        let bg = store.cache.get(key);
        if (bg === undefined) {
            const layout = pipeline.bindGroupLayouts[groupIdx];
            if (layout === undefined) {
                throw new Error(
                    `buildBindGroupsForDraw: pipeline '${pipeline.fingerprint}' has no bindGroupLayout for group ${groupIdx}.`
                );
            }
            bg = device.createBindGroup({
                layout,
                entries,
                label: `${drawable.label ?? drawable.id}.bg${groupIdx}`,
            });
            store.cache.set(key, bg);
            indexBindGroupKey(store, key, groupResources);
        }
        groups.set(groupIdx, bg);
        keys.set(groupIdx, key);
    }

    return { groups, keys };
}

/** Record which resources composed `key` so `sweepBindGroupCache` can find and drop the entry
 *  when any of them is mutated or destroyed. `resources` is deduped first (a resource bound to
 *  two slots of the same group must not be double-counted). */
function indexBindGroupKey(store: BindGroupCacheStore, key: string, resources: readonly Resource[]): void {
    const unique = resources.length > 1 ? Array.from(new Set(resources)) : resources;
    store.keyToResources.set(key, unique);
    for (const r of unique) {
        let set = store.resourceToKeys.get(r);
        if (set === undefined) {
            set = new Set();
            store.resourceToKeys.set(r, set);
        }
        set.add(key);
    }
}

/** Drop exactly the cached bind groups that reference any of `invalidatedResources`, using the
 *  reverse index (`resource → keys`) built at bind-group creation. Cross-references in the
 *  forward index (`key → resources`) are cleaned so no stale entries linger. Returns the number
 *  of `GPUBindGroup`s actually removed from the cache. Bind groups not touched by these
 *  resources are left intact, so the next submit only rebuilds what changed. */
export function sweepBindGroupCache(store: BindGroupCacheStore, invalidatedResources: readonly Resource[]): number {
    if (invalidatedResources.length === 0) return 0;
    let removed = 0;
    for (const r of invalidatedResources) {
        const keys = store.resourceToKeys.get(r);
        if (keys === undefined) continue;
        for (const key of keys) {
            if (store.cache.delete(key)) removed += 1;
            // Detach this key from every *other* resource that fed it, then drop the forward
            // entry. `r`'s own reverse entry is removed wholesale below.
            const others = store.keyToResources.get(key);
            if (others !== undefined) {
                for (const o of others) {
                    if (o === r) continue;
                    store.resourceToKeys.get(o)?.delete(key);
                }
                store.keyToResources.delete(key);
            }
        }
        store.resourceToKeys.delete(r);
    }
    return removed;
}

// ---- internals --------------------------------------------------------------------------------

/** Walk the override stack from innermost to outermost; return the first match (or the
 *  drawable's own binding when no override covers `slot`). */
function resolveBinding(
    slot: ResourceSlot,
    drawable: Drawable,
    overrideStack: readonly ReadonlyMap<ResourceSlot, Resource>[]
): { resource: Resource; fromOverride: boolean } {
    for (let i = overrideStack.length - 1; i >= 0; i--) {
        const m = overrideStack[i];
        if (m === undefined) continue;
        const r = m.get(slot);
        if (r !== undefined) return { resource: r, fromOverride: true };
    }
    const own = drawable.bindings.get(slot);
    if (own === undefined) {
        throw new Error(
            `buildBindGroupsForDraw: drawable '${drawable.label ?? drawable.id}' is missing a binding ` +
                `for slot '${slot.name}' required by pipeline '${drawable.pipeline.fingerprint}'.`
        );
    }
    return { resource: own, fromOverride: false };
}

function makeBindGroupEntry(binding: number, resource: Resource, slot: ResourceSlot): GPUBindGroupEntry {
    switch (resource.kind) {
        case 'uniform':
        case 'storage': {
            const buf = resource as BufferResource<unknown>;
            return {
                binding,
                resource: {
                    buffer: buf.handle.gpu,
                    offset: buf.handle.offset,
                    size: buf.handle.size,
                },
            };
        }
        case 'rawBuffer': {
            // raw buffer used as a uniform/storage binding (validated by drawable construction)
            const raw = resource as RawBufferResource;
            return {
                binding,
                resource: {
                    buffer: raw.handle.gpu,
                    offset: raw.handle.offset,
                    size: raw.handle.size,
                },
            };
        }
        case 'texture': {
            const t = resource as TextureResource;
            return { binding, resource: t.view };
        }
        case 'storageTexture': {
            const t = resource as StorageTextureResource;
            return { binding, resource: t.view };
        }
        case 'sampler': {
            const s = resource as SamplerResource;
            return { binding, resource: s.sampler };
        }
        case 'externalTexture': {
            const e = resource as ExternalTextureResource;
            return { binding, resource: e.external };
        }
        default: {
            const _exhaustive: never = resource; // intentionally marked as never being used, as a compile-time check for exhaustiveness
            void _exhaustive; // marked as "used" so that the compiler does not complain about an unused variable
            throw new Error(`makeBindGroupEntry: unmapped resource kind on slot '${slot.name}'.`);
        }
    }
}
