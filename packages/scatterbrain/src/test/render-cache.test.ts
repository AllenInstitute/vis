import { beforeEach, describe, expect, it } from "vitest";
import { AsyncDataCache } from "../dataset-cache";
import { fakeFetch } from "./test-utils";
import { delay, partial, partialRight, uniqueId } from "lodash";
type Columns = 'color' | 'position'
type vec3 = readonly [number, number, number]
type Data = { pretend: vec3 }

type Entry = {
    resolveMe: () => void;
    rejectMe: (reason?: any) => void;
}
class PromiseFarm {
    entries: Map<Promise<unknown>, Entry>
    staging: Record<string, Entry>;
    constructor() {
        this.entries = new Map();
        this.staging = {};
    }
    promiseMe<T>(t: T) {
        const reqId = uniqueId('rq');
        const prom = new Promise<T>((resolve, reject) => {
            this.staging[reqId] =
            {
                resolveMe: () => resolve(t),
                rejectMe: (reason: any) => reject(reason)
            }
        });
        this.entries.set(prom, this.staging[reqId]);
        delete this.staging[reqId];
        return prom;
    }
    mockResolve(p: Promise<unknown>) {
        const found = this.entries.get(p);
        if (found) {
            found.resolveMe();
            return true;
        }
        return false;
    }
    mockReject(p: Promise<unknown>, reason: any) {
        const found = this.entries.get(p);
        if (found) {
            found.rejectMe(reason);
            return true;
        }
        return false;
    }
}

type SpyOnRenderer = {
    data: Record<Columns, Data>;
}
function cacheKey(item: { id: number }, rq: Columns) {
    return `api:4000/${rq}_${item.id}.bin`;
}
describe('async cache', () => {
    let mockPromises = new PromiseFarm();
    const fetchFakeItem = (id: number, color: vec3, pos: vec3) => {
        const c = mockPromises.promiseMe({ pretend: color })
        const p = mockPromises.promiseMe({ pretend: pos })
        return {
            fetchers: {
                color: () => c,
                position: () => p,
            },
            spies: [c, p],
            id
        } as const;
    }
    const resolveFakePromises = async (lies: readonly Promise<unknown>[]): Promise<void> => {
        lies.forEach((p) => { mockPromises.mockResolve(p) })
        // because the promises are mega hackified, even though we call resolve, the event system hasn't had a chance to catch up
        // so - we have to inject a fake wait in here to give all the promises we just resolved a chance to run for realsies
        await Promise.resolve()
        return Promise.resolve();

    }

    let cache = new AsyncDataCache<Columns, string, Data>((item: Data) => { }, () => 1, 10);
    let disposed: Data[] = []
    let rendered: SpyOnRenderer[] = [] // these are just for spying
    const render = (data: Record<Columns, Data>) => {
        rendered.push({ data });
    }
    beforeEach(() => {
        cache = new AsyncDataCache<Columns, string, Data>((item: Data) => { disposed.push(item) }, () => 1, 10);
        disposed = []
        rendered = []
    })

    describe('cacheAndUse', () => {
        it('calls the use fn once all requested data is available', async () => {
            const { fetchers, id, spies } = fetchFakeItem(1, [255, 0, 0], [1, 2, 3])
            const toCacheKey = partial(cacheKey, { id });
            const result = cache.cacheAndUse(fetchers, render, toCacheKey)
            expect(result).toBeDefined();
            // the promises for our fake data never resolve until we tell them to
            expect(cache.getNumPendingTasks()).toBe(1)
            expect(rendered.length).toBe(0);

            await resolveFakePromises(spies);

            expect(cache.getNumPendingTasks()).toBe(0)
            expect(rendered.length).toBe(1);
        })
        it('behaves correctly when a fetch fails', async () => {
            const { fetchers, id, spies } = fetchFakeItem(1, [255, 0, 0], [1, 2, 3])
            const toCacheKey = partial(cacheKey, { id });
            const result = cache.cacheAndUse(fetchers, render, toCacheKey)
            expect(result).toBeDefined();
            // fail one, resolve the other
            let boom = false;
            // this little catch represents passing our deep error up to someone smarter:
            spies[0].catch(() => boom = true)


            mockPromises.mockResolve(spies[1])
            // resolve one so that we can be sure its value lives in the cache
            await Promise.resolve()
            expect(cache.isCached(toCacheKey('position'))).toBeTruthy()
            console.dir(cache)
            // then reject the other to fail the overall task
            mockPromises.mockReject(spies[0], 'fetch failed for reals')
            await Promise.resolve()
            await Promise.resolve()

            expect(cache.getNumPendingTasks()).toBe(0)
            expect(rendered.length).toBe(0);
            expect(boom).toBeTruthy()
            // the one that failed of course is missing from the cache
            expect(cache.isCached(toCacheKey('color'))).toBeFalsy()
        })
    })
})