/** biome-ignore-all lint/suspicious/noConsole: <its tests> */
import { beforeEach, describe, expect, test } from 'vitest';
import { PriorityCache, type Resource } from './priority-cache';
import { FakeStore, PayloadFactory, PromiseFarm } from './test-utils';

let factory = new PayloadFactory();

function setupTestEnv(limit: number, fetchLimit: number) {
    const promises = new PromiseFarm();
    const fetchSpies: Set<Promise<unknown>> = new Set();
    const resolveFetches = () => promises.resolveAll();
    const fakeFetchItem = (id: string) => (_sig: AbortSignal) => {
        console.log('request: ', id);
        return promises.promiseMe(() => factory.create(id, 33));
    };
    factory = new PayloadFactory();
    const fakeStore: FakeStore = new FakeStore();
    const cache: PriorityCache = new PriorityCache(fakeStore, () => 0, limit, fetchLimit);
    return { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises };
}
describe('basics', () => {
    let env = setupTestEnv(5, 10);
    beforeEach(() => {
        env = setupTestEnv(5, 10);
    });
    test('put 5 things in, see them in the store', async () => {
        const { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises } = env;
        const enq = (id: string) => cache.enqueue(id, fakeFetchItem(id));
        // enqueue 5 things, get them all back
        const things = ['a', 'b', 'c', 'd', 'e'];
        things.forEach(enq);
        await resolveFetches();
        things.forEach((id) => expect(cache.has(id)));
    });
    test('when evicting and fetching, priority is respected', async () => {
        const score = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 };
        env = setupTestEnv(5, 1);
        const { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises } = env;
        const resolveAndRequestNext = async () => {
            await resolveFetches();
            await resolveFetches();
        };
        const enq = (id: string) => cache.enqueue(id, fakeFetchItem(id));
        cache.reprioritize((x) => score[x] ?? 0);
        const things = ['a', 'b', 'c', 'd', 'e'];
        // this cache can only resolve one fetch at a time
        // so we can see that the fetching happens in priority order, regardless of the enq order
        things.forEach(enq);
        expect(factory.resources).toEqual({});
        await resolveFetches(); // resolves all pending fetches - there should be only one
        expect(factory.resources).toEqual({ a: 'created' });
        // at the time a was enqueued, one fetch-slot was available, and a was the highest priority item
        // before it could resolve, we enqueued b,c,d,e in that order
        await resolveAndRequestNext();
        expect(factory.resources).toEqual({ a: 'created', e: 'created' });
        await resolveAndRequestNext();
        expect(factory.resources).toEqual({ a: 'created', e: 'created', d: 'created' });
        await resolveAndRequestNext();
        expect(factory.resources).toEqual({ a: 'created', e: 'created', d: 'created', c: 'created' });
        await resolveAndRequestNext();
        expect(factory.resources).toEqual({ a: 'created', e: 'created', d: 'created', c: 'created', b: 'created' });
        // the cache is full - we'd expect to evict a and b, as the lowest priority items
        enq('f');
        enq('g');
        await resolveAndRequestNext();
        await resolveAndRequestNext();
        expect(factory.resources).toEqual({
            a: 'destroyed',
            e: 'created',
            d: 'created',
            c: 'created',
            b: 'destroyed',
            f: 'created',
            g: 'created',
        });
    });
});

// these tests are nice to think about, but not suitable to run on CI
describe.skip('throughput', () => {
    test('performs well under non-stop puts with random prioritization values', () => {
        // because puts get called as the result of a promise resolution, its hard to isolate the cost
        // using a "realistic" example - lets just call put in a loop?
        const fakeStore: FakeStore = new FakeStore();
        const priorities: Record<string, number> = {};
        let numEvicted = 0;
        const cache: PriorityCache = new PriorityCache(
            fakeStore,
            (item) => {
                return priorities[item] ?? 0;
            },
            1000,
            20,
        );
        const newItem = (ID: string): Resource => {
            priorities[ID] = Math.random() * 100;
            return {
                sizeInBytes: () => 1,
                destroy: () => {
                    delete priorities[ID];
                    numEvicted += 1;
                },
            };
        };
        let putOverheadMS = 0;
        const onemil = 1_000_000;
        for (let i = 0; i < onemil; i++) {
            const ID = `item_${i}`;
            const item = newItem(ID);
            const begin = performance.now();
            cache.put(ID, item);
            putOverheadMS += performance.now() - begin;
        }
        console.log('1 million puts,', numEvicted, 'evictions,', putOverheadMS, 'ms total');
        console.log('each put (avg ms): ', putOverheadMS / onemil);
        expect(putOverheadMS / onemil).toBeLessThan(0.001); // yup, we are expecting this call to take less than one microsecond on average.
        // a photon travels about 1000 feet in that time
        expect(numEvicted).toBe(999000);
    });
    test(
        'performs well under non-stop puts with random prioritization values, and intermittant re-prioritizations',
        { timeout: 10000 },
        () => {
            // because puts get called as the result of a promise resolution, its hard to isolate the cost
            // using a "realistic" example - lets just call put in a loop?
            const fakeStore: FakeStore = new FakeStore();
            const priorities: Record<string, number> = {};
            let numEvicted = 0;
            const score = (k: string) => priorities[k] ?? 0;
            const cache: PriorityCache = new PriorityCache(fakeStore, score, 1000, 20);
            const newItem = (ID: string): Resource => {
                priorities[ID] = Math.random() * 100;
                return {
                    sizeInBytes: () => 1,
                    destroy: () => {
                        delete priorities[ID];
                        numEvicted += 1;
                    },
                };
            };
            let putOverheadMS = 0;
            let rePrioritizeOverheadMS = 0;
            let rePrioritizeEvents = 0;
            const onemil = 1_000_000;
            for (let i = 0; i < onemil; i++) {
                const ID = `item_${i}`;
                const item = newItem(ID);
                const begin = performance.now();
                cache.put(ID, item);
                putOverheadMS += performance.now() - begin;
                if (i % 100 === 0) {
                    // this is the same score function, but we changed all the numbers... that is exactly what we want
                    for (const k in priorities) {
                        priorities[k] = Math.random() * 100;
                    }
                    rePrioritizeEvents += 1;
                    const begin = performance.now();
                    cache.reprioritize(score);
                    rePrioritizeOverheadMS += performance.now() - begin;
                }
            }
            console.log('1 million puts,', numEvicted, 'evictions,', putOverheadMS, 'ms total');
            console.log('each put (avg ms): ', putOverheadMS / onemil);
            console.log('avg ms to reprioritize 1000 items: ', rePrioritizeOverheadMS / rePrioritizeEvents);
            expect(putOverheadMS / onemil).toBeLessThan(0.01); // yup, we are expecting this call to take less than 10 microseconds on average.
            // a photon travels about 10,000 feet in that time
            expect(numEvicted).toBe(999000);
            expect(rePrioritizeEvents).toBe(onemil / 100);
            expect(rePrioritizeOverheadMS / rePrioritizeEvents).toBeLessThan(0.1);
        },
    );
    test('enqueue with instant fetching - overall speed', { timeout: 10000 }, async () => {
        const promises = new PromiseFarm();
        const fakeStore: FakeStore = new FakeStore();
        const fakeFetchItem = (id: string) => (_sig: AbortSignal) => {
            return promises.promiseMe(() => factory.create(id, 33));
        };
        factory = new PayloadFactory();
        const priorities: Record<string, number> = {};
        const score = (k: string) => priorities[k] ?? 0;
        const cache: PriorityCache = new PriorityCache(fakeStore, score, 1000, 20);

        const onemil = 100_000;
        const begin = performance.now();
        for (let i = 0; i < onemil; i++) {
            const ID = `item_${i}`;
            priorities[ID] = Math.random() * 100;
            const fetchme = fakeFetchItem(ID);
            cache.enqueue(ID, fetchme);
            // allow the queue promises to resolve:
            if (i % 100 === 0) {
                // this is the same score function, but we changed all the numbers... that is exactly what we want
                for (const k in priorities) {
                    priorities[k] = Math.random() * 100;
                }
                cache.reprioritize(score);
            }
            await promises.resolveAll();
        }
        const totalTime = performance.now() - begin;
        // adding a million things with reprioritization took about 3.4 seconds.
        // with promises and the event loop... adding 100k is taking 3X longer than previous tests (which did 10x more)
        // so the whole (more realistic) overhead of promises and the event loop adding a factor of 30
        // what this goes to show is that the overhead of these little parts is nothing compared to the actual bottlenecks.
        // to say nothing of waiting entire seconds for fetches on a real network.
        expect(Object.values(factory.resources).filter((v) => v === 'destroyed').length).toBe(onemil - 1000);
        expect(totalTime).toBeLessThan(9000);
    });
});
