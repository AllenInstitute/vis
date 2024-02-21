import { reduce } from "lodash";

type MaybePromise<D> = D | Promise<D>;

export function promisify<D>(thing: D | Promise<D>) {
    return thing instanceof Promise ? thing : Promise.resolve(thing);
}
export function mapify<D>(results: ReadonlyArray<{ key: string; result: D }>): Record<string, D> {
    return results.reduce((attrs, cur) => ({ ...attrs, [cur.key]: cur.result }), {});
}

export interface AsyncCache<K, D> {
    isCached(k: K): boolean;
    getCached(k: K): D | undefined;
    cache(key: K, getter: () => Promise<D>): Promise<D> | D;
    finished(key: K): void;
}
type MutableCacheEntry<D> = {
    pendingRequests: number;
    data: MaybePromise<D>;
    lastRequestedTimestamp: number;
}
export class AsyncDataCache<D> implements AsyncCache<string, D> {
    private limit: number;
    private size: (d: D) => number;
    private destroyer: (d: D) => void;
    private entries: Map<string, MutableCacheEntry<D>>;
    constructor(
        destroy: (data: D) => void,
        size: (data: D) => number,
        cacheLimit: number
    ) {
        this.size = size;
        this.destroyer = destroy;
        this.limit = cacheLimit;
        this.entries = new Map<string, MutableCacheEntry<D>>();
    }
    private usedSpace() {
        // Map uses iterators, so we're in for-loop teritorry here
        let sum = 0;
        this.entries.forEach((entry) => sum += entry.data instanceof Promise ? 0 : this.size(entry.data));
        return sum;
    }
    oustandingCacheEntries() {
        let sum = 0;
        this.entries.forEach((entry) => sum += (entry.pendingRequests >= 1 ? 1 : 0));
        return sum;
    }
    report() {
        this.entries.forEach((entry, key) => console.log(key, entry.pendingRequests))
        // console.log('thus: ', this.oustandingCacheEntries())
    }
    private evictIfFull() {
        // find entries which have 0 pending requests, and are not themselves promises...
        let used = this.usedSpace();
        const candidates: { key: string, data: D, lastRequestedTimestamp: number }[] = [];
        if (used > this.limit) {
            this.entries.forEach((entry, key) => {
                if (!(entry.data instanceof Promise) && entry.pendingRequests < 1) {
                    candidates.push({ key, data: entry.data, lastRequestedTimestamp: entry.lastRequestedTimestamp })
                }
            });
        }
        const priority = candidates.sort((a, b) => a.lastRequestedTimestamp - b.lastRequestedTimestamp)
        for (const evictMe of priority) {
            used -= this.size(evictMe.data);
            this.destroyer(evictMe.data);
            this.entries.delete(evictMe.key);
            if (used < this.limit) {
                return;
            }
        }
        // of those, find the least-recently requested
        // remove them from the cache until sum(size(entries
    }
    isCached(key: string) {
        // the key exists, and the value associated is not a promise
        return this.entries.has(key) && !(this.entries.get(key)?.data instanceof Promise);
    }
    // return D, or if its not (yet) present, undefined
    getCached(key: string): D | undefined {
        const entry = this.entries.get(key);
        if (!entry) return undefined;

        entry.lastRequestedTimestamp = performance.now();
        return entry.data instanceof Promise ? undefined : entry?.data;
    }
    finished(key: string): void {
        const entry = this.entries.get(key);
        if (entry) {
            entry.pendingRequests = Math.max(0, entry.pendingRequests - 1);
        }
    }
    cache(key: string, getter: () => Promise<D>) {
        if (!this.entries.has(key)) {
            // make an effort to have room in the cache:
            this.evictIfFull();
            const setWhenFetched = getter().then((actual) => {
                // get the entry and mutate it:
                const entry = this.entries.get(key)
                if (!entry) {
                    // this should be impossible...
                    return actual;
                }
                entry.data = actual;
                return actual;
            })
            setWhenFetched.catch((_reason) => {
                // its often the case that these requests get rejected - thats fine
                const cancelledRequest = this.entries.get(key);
                if (cancelledRequest) {
                    cancelledRequest.pendingRequests = Math.max(0, cancelledRequest.pendingRequests - 1);
                }
            });

            this.entries.set(key, { data: setWhenFetched, lastRequestedTimestamp: performance.now(), pendingRequests: 0 });
        }
        // we know it exists:
        const alreadyCached = this.entries.get(key)!;
        if (alreadyCached.data instanceof Promise) {
            // increment the request count
            alreadyCached.pendingRequests += 1;
            alreadyCached.lastRequestedTimestamp = performance.now();
        }
        return alreadyCached.data;
    }
}
