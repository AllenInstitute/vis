/** biome-ignore-all lint/suspicious/noExplicitAny: <tests> */
import { beforeEach, describe, expect, test } from 'vitest';
import { FakeStore, type Payload, PayloadFactory, PromiseFarm } from './test-utils';
import { SharedPriorityCache } from './shared-cache';
function setupTestEnv(limit: number, fetchLimit: number) {
    const factory = new PayloadFactory();

    const promises = new PromiseFarm();
    const fetchSpies: Set<Promise<unknown>> = new Set();
    const resolveFetches = () => promises.resolveAll();
    const fakeFetchItem = (id: string) => (_sig: AbortSignal) => {
        return promises.promiseMe(() => factory.create(id, 33));
    };
    const fakeStore: FakeStore = new FakeStore();
    const cache = new SharedPriorityCache(fakeStore, limit, fetchLimit);
    return { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises, factory };
}
describe('shared cache priorities are the sum of all client priorities', () => {
    let env = setupTestEnv(10, 10);
    beforeEach(() => {
        env = setupTestEnv(10, 10);
    });
    type Item = {
        id: string;
    };
    type ItemData = { data: Payload };
    const Items = (...ids: string[]) => ids.map((id) => ({ id }));
    const ePri = (id: string, pri: number) => ({ [`fake.com/${id}`]: pri });
    test('one client with simple priorities', async () => {
        const { cache, fakeFetchItem } = env;

        const C = cache.registerClient({
            cacheKeys: (item: Item) => ({ data: `fake.com/${item.id}` }),
            fetch: (item: Item) => ({ data: fakeFetchItem(item.id) }),
            isValue: (v): v is ItemData => 'data' in v,
        });

        C.setPriorities(Items('a', 'b', 'c'), Items('p', 'q'));
        // this should immediately enqueue p,q,a,b,c
        // it would be great to be able to peek at the priorities!
        const spyCache = cache as any as { importance: Record<string, number> };
        expect(spyCache.importance).toEqual({
            ...ePri('a', 1),
            ...ePri('b', 1),
            ...ePri('c', 1),
            ...ePri('p', 2),
            ...ePri('q', 2),
        });
    });
    test('repeat items have priorities summed', () => {
        const { cache, fakeFetchItem } = env;
        const C = cache.registerClient({
            cacheKeys: (item: Item) => ({ data: `fake.com/${item.id}` }),
            fetch: (item: Item) => ({ data: fakeFetchItem(item.id) }),
            isValue: (v): v is ItemData => 'data' in v,
        });

        C.setPriorities(Items('a', 'b', 'b', 'c'), Items('a', 'q'));
        // this should immediately enqueue p,q,a,b,c
        // it would be great to be able to peek at the priorities!
        const spyCache = cache as any as { importance: Record<string, number> };
        expect(spyCache.importance).toEqual({
            ...ePri('a', 3), // low+high = 3
            ...ePri('b', 2), // low+low = high aka 2
            ...ePri('c', 1),
            ...ePri('q', 2),
        });
    });
    test('changing priorities works as expected', () => {
        const { cache, fakeFetchItem } = env;
        const C = cache.registerClient({
            cacheKeys: (item: Item) => ({ data: `fake.com/${item.id}` }),
            fetch: (item: Item) => ({ data: fakeFetchItem(item.id) }),
            isValue: (v): v is ItemData => 'data' in v,
        });

        C.setPriorities(Items('a', 'b', 'b', 'c'), Items('a', 'q'));
        C.setPriorities(Items('a'), Items('a', 'c'));
        // this should immediately enqueue p,q,a,b,c
        // it would be great to be able to peek at the priorities!
        const spyCache = cache as any as { importance: Record<string, number> };
        expect(spyCache.importance).toEqual({
            ...ePri('a', 3),
            ...ePri('b', 0),
            ...ePri('c', 2),
            ...ePri('q', 0),
        });
    });
    test('changing priorities over multiple clients', () => {
        const { cache, fakeFetchItem } = env;
        const A = cache.registerClient({
            cacheKeys: (item: Item) => ({ data: `fake.com/${item.id}` }),
            fetch: (item: Item) => ({ data: fakeFetchItem(item.id) }),
            isValue: (v): v is ItemData => 'data' in v,
        });
        const B = cache.registerClient({
            cacheKeys: (item: Item) => ({ data: `fake.com/${item.id}` }),
            fetch: (item: Item) => ({ data: fakeFetchItem(item.id) }),
            isValue: (v): v is ItemData => 'data' in v,
        });
        A.setPriorities(Items('a', 'b', 'c'), []);
        B.setPriorities(Items('p', 'q', 'c'), []);
        // this should immediately enqueue p,q,a,b,c
        // it would be great to be able to peek at the priorities!
        const spyCache = cache as any as { importance: Record<string, number> };
        expect(spyCache.importance).toEqual({
            ...ePri('a', 1),
            ...ePri('b', 1),
            ...ePri('c', 2),
            ...ePri('p', 1),
            ...ePri('q', 1),
        });
        // now, change just one client:
        B.setPriorities(Items('p'), Items('b'));
        expect(spyCache.importance).toEqual({
            ...ePri('a', 1),
            ...ePri('b', 3), // Added by B
            ...ePri('c', 1), // dropped by B, still present in A
            ...ePri('p', 1),
            ...ePri('q', 0), // dropped
        });
    });
});
