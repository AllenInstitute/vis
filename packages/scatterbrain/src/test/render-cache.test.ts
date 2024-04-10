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
            // resolve one first so that we can be sure its value lives in the cache
            await Promise.resolve()
            expect(cache.isCached(toCacheKey('position'))).toBeTruthy()
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
        it('evicts data after the soft limit is hit', async () => {
            // each of our tasks requests two chunks of data
            // the cache has a limit of 10 items (see beforeEach)
            let allKeysSoFar: string[] = []
            for (let i = 0; i < 5; i++) {
                const { fetchers, id, spies } = fetchFakeItem(i, [255, 0, i], [1, 2 * i, 3 * i])
                const toCacheKey = partial(cacheKey, { id })
                const result = cache.cacheAndUse(fetchers, render, toCacheKey)
                // store all the cache keys so we can expect them later
                allKeysSoFar.push(toCacheKey('color'), toCacheKey('position'))
                await resolveFakePromises(spies)
            }
            // so after making 5 requests, we should have a full cache
            expect(cache.areKeysAllCached(allKeysSoFar)).toBe(true);
            expect(cache.getNumPendingTasks()).toBe(0);
            // now request a new thing - this should cause the cache to remove at least one item
            const { fetchers, id, spies } = fetchFakeItem(99, [99, 99, 99], [9, 9, 9])
            const toCacheKey = partial(cacheKey, { id })
            const result = cache.cacheAndUse(fetchers, render, toCacheKey);
            await resolveFakePromises(spies)
            // we would expect the items with id=0 to have been removed, as they are the oldest
            expect(cache.isCached(toCacheKey('color'))).toBeTruthy()
            expect(cache.isCached(toCacheKey('position'))).toBeTruthy()
            // and the old ones:
            expect(cache.isCached(cacheKey({ id: 0 }, 'color'))).toBeFalsy()
            expect(cache.isCached(cacheKey({ id: 0 }, 'position'))).toBeFalsy()
        })
        it('does not evict data if it is marked as critical for a pending request', async () => {
            // almost the same scenario as the previous test, except we're going to intentionally NOT
            // resolve the task with id=0. Because its still pending, we would like to see that it does not get evicted!

            // each of our tasks requests two chunks of data
            // the cache has a limit of 10 items (see beforeEach)
            let allKeysSoFar: string[] = []
            let reallySlowRequest: Promise<unknown>;
            for (let i = 0; i < 6; i++) {
                const { fetchers, id, spies } = fetchFakeItem(i, [255, 0, i], [1, 2 * i, 3 * i])
                const toCacheKey = partial(cacheKey, { id })
                const result = cache.cacheAndUse(fetchers, render, toCacheKey)
                if (i !== 0) {
                    // dont resolve the stuff for the first task!
                    allKeysSoFar.push(toCacheKey('color'), toCacheKey('position'))
                    await resolveFakePromises(spies)
                } else {
                    allKeysSoFar.push(toCacheKey('color'))
                    await resolveFakePromises([spies[0]])
                    reallySlowRequest = spies[1];
                    // intentionally not resolving position!
                }
            }
            // so after making 5 requests, we should have an almost full cache
            expect(cache.areKeysAllCached(allKeysSoFar)).toBe(true);
            expect(cache.getNumPendingTasks()).toBe(1); // the first task is still pending, because we didn't resolve its position request

            // now request a new thing - this should cause the cache to remove at least one item
            const { fetchers, id, spies } = fetchFakeItem(99, [99, 99, 99], [9, 9, 9])

            const result = cache.cacheAndUse(fetchers, render, partial(cacheKey, { id }));
            await resolveFakePromises(spies)

            expect(cache.isCached(cacheKey({ id: 99 }, 'color'))).toBeTruthy()
            expect(cache.isCached(cacheKey({ id: 99 }, 'position'))).toBeTruthy()

            // we would expect the items with id=0 to have been removed, as they are the oldest, HOWEVER
            // we never resolved (position,id:0) so we expect to not have removed 
            expect(cache.isCached(cacheKey({ id: 0 }, 'color'))).toBeTruthy() // its still in the cache
            expect(cache.isCached(cacheKey({ id: 0 }, 'position'))).toBeFalsy() // its never been resolved, so it cant be in the cache (yet)

            expect(cache.isCached(cacheKey({ id: 1 }, 'color'))).toBeFalsy()
            expect(cache.isCached(cacheKey({ id: 1 }, 'position'))).toBeFalsy()

            // finally, resolve that first stalled request, and observe us fulfilling our first render task:
            await resolveFakePromises([reallySlowRequest!])
            expect(cache.getNumPendingTasks()).toBe(0)
            // expect everything to have been rendered, regardless of all this cache nonsense
            expect(rendered.length).toEqual(7) // id=0...5, 99
            // spot check the last two rendered things:
            rendered[rendered.length - 2].data.color[1] = 99
            rendered[rendered.length - 1].data.position[2] = 0 // 3*(i=0)
        })
        it('evicts data after the soft limit is hit, while prioritizing Least-recently used entries', async () => {
            // each of our tasks requests two chunks of data
            // the cache has a limit of 10 items (see beforeEach)
            let allKeysSoFar: string[] = []
            let first: ReturnType<typeof fetchFakeItem> & { toCacheKey: (rq: Columns) => string }
            for (let i = 0; i < 5; i++) {
                const { fetchers, id, spies } = fetchFakeItem(i, [255, 0, i], [1, 2 * i, 3 * i])
                const toCacheKey = partial(cacheKey, { id })
                if (i === 0) {
                    first = { fetchers, id, spies, toCacheKey }
                }
                const result = cache.cacheAndUse(fetchers, render, toCacheKey)
                // store all the cache keys so we can expect them later
                allKeysSoFar.push(toCacheKey('color'), toCacheKey('position'))
                await resolveFakePromises(spies)
            }
            // so after making 5 requests, we should have a full cache
            expect(cache.areKeysAllCached(allKeysSoFar)).toBe(true);
            expect(cache.getNumPendingTasks()).toBe(0);
            // now - re-request the first task (pretend to 'render' it again)
            const again = first!; // renaming first as again to avoid many copies of the ! operator
            cache.cacheAndUse(again.fetchers, render, again.toCacheKey);
            await resolveFakePromises(again.spies);
            expect(cache.getNumPendingTasks()).toBe(0);
            // now request a new thing - this should cause the cache to remove at least one item
            const { fetchers, id, spies } = fetchFakeItem(99, [99, 99, 99], [9, 9, 9])
            const toCacheKey = partial(cacheKey, { id })
            const result = cache.cacheAndUse(fetchers, render, toCacheKey);
            await resolveFakePromises(spies)
            // we would expect the items with id=1 to have been removed (not id=0 because we re-requested it)
            expect(cache.isCached(toCacheKey('color'))).toBeTruthy()
            expect(cache.isCached(toCacheKey('position'))).toBeTruthy()

            expect(cache.isCached(cacheKey({ id: 0 }, 'color'))).toBeTruthy()
            expect(cache.isCached(cacheKey({ id: 0 }, 'position'))).toBeTruthy()
            // these are gone - they would have been the second oldest (and thus safe) - but we re-requested the id=0 items
            // so they get updated as having been used most-recently - the idea being they'll be requested again and maybe other things would be better to evict
            expect(cache.isCached(cacheKey({ id: 1 }, 'color'))).toBeFalsy()
            expect(cache.isCached(cacheKey({ id: 1 }, 'position'))).toBeFalsy()
        })
    })
})