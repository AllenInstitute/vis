type MaybePromise<D> = D | Promise<D>;

export function promisify<D>(thing: D | Promise<D>) {
    return thing instanceof Promise ? thing : Promise.resolve(thing);
}
export function mapify<D>(results: ReadonlyArray<{ key: string; result: D }>): Record<string, D> {
    return results.reduce((attrs, cur) => ({ ...attrs, [cur.key]: cur.result }), {});
}

export class AsyncDataCache<D> {
    private entries: Map<string, MaybePromise<D>>;

    constructor() {
        this.entries = new Map<string, MaybePromise<D>>();
    }
    isCached(key: string) {
        // the key exists, and the value associated is not a promise
        return this.entries.has(key) && !(this.entries.get(key) instanceof Promise);
    }
    // return D, or if its not (yet) present, undefined
    getCached(key: string): D | undefined {
        const entry = this.entries.get(key);
        return entry instanceof Promise ? undefined : entry;
    }
    cache(key: string, getter: () => Promise<D>) {
        if (!this.entries.has(key)) {
            const setWhenFetched = getter().then((actual) => {
                this.entries.set(key, actual);
                // return actual so this can chain promises:
                return actual;
            });
            setWhenFetched.catch((_reason) => {
                // its often the case that these requests get rejected - thats fine
                // remove the promise from the cache in that case:
                this.entries.delete(key);
                // note - promises chained onto this promise will still get rejected,
                // so our caller of course has a chance to do something more smart
            });
            this.entries.set(key, setWhenFetched);
        }
        return this.entries.get(key);
    }
}
