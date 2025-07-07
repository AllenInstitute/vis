import { type Resource } from './priority-cache';
import { type ClientSpec } from './shared-cache';

// some utils for tracking changing priorities in our priority cache

export function prioritizeCacheKeys<Item, ItemContent extends Record<string, Resource>>(
    spec: ClientSpec<Item, ItemContent>,
    items: Iterable<Item>,
    priority: 1 | 2,
) {
    let pri: Record<string, number> = {};
    for (const item of items) {
        const keys = spec.cacheKeys(item);
        for (const cacheKey of Object.values(keys)) {
            pri[cacheKey] = (pri[cacheKey] ?? 0) + priority;
        }
    }
    return pri;
}
export function mergeAndAdd(A: Record<string, number>, B: Record<string, number>) {
    const sum: Record<string, number> = {};
    for (const a in A) {
        sum[a] = A[a] + (B[a] ?? 0);
    }
    for (const b in B) {
        if (!(b in A)) {
            sum[b] = B[b];
        } // else we've already dealt with it
    }
    return sum;
}
export function priorityDelta(
    old: Record<string, number>,
    current: Record<string, number>,
    update: (key: string, value: number) => void,
) {
    for (const o in old) {
        const curPri = current[o] ?? 0;
        const prevPri = old[o];
        update(o, curPri - prevPri);
    }
    for (const c in current) {
        if (!(c in old)) {
            update(c, current[c]);
        } // else we've already dealt with the diff
    }
}
