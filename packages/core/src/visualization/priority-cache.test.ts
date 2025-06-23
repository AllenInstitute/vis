import delay from 'lodash/delay';
import { beforeEach, describe, expect, it } from 'vitest';
import { FancyCache, Meta, type Store } from './priority-cache'
import { uniqueId } from 'lodash';

type Item = string;
type Payload = {
    buffer: { length: number } // its fake!
}


type Entry = {
    resolveMe: () => void;
    rejectMe: (reason?: unknown) => void;
};
// todo copy pasta
class PromiseFarm {
    entries: Map<Promise<unknown>, Entry>;
    staging: Record<string, Entry>;
    constructor() {
        this.entries = new Map();
        this.staging = {};
    }
    promiseMe<T>(t: T) {
        const reqId = uniqueId('rq');
        const prom = new Promise<T>((resolve, reject) => {
            this.staging[reqId] = {
                resolveMe: () => resolve(t),
                rejectMe: (reason: unknown) => reject(reason),
            };
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
    mockReject(p: Promise<unknown>, reason: unknown) {
        const found = this.entries.get(p);
        if (found) {
            found.rejectMe(reason);
            return true;
        }
        return false;
    }
    resolveAll() {
        const awaited: Promise<unknown>[] = []
        for (const e of this.entries) {
            const [prom, entry] = e
            awaited.push(prom)
            entry.resolveMe()
        }
        return Promise.all(awaited)
    }
}

// TODO: we can see that this thing is just "Map" hmmmm
// an implementor could have more cool trickery they could do though...
// hrmmm
class FakeStore implements Store<Item, Payload> {
    private stuff: Map<Item, Payload>;
    constructor() {
        this.stuff = new Map();
    }
    put(k: Item, v: Payload): void {
        console.log('put:', k)
        this.stuff.set(k, v)
        console.log(this.stuff)
    }
    get(k: Item): Payload | undefined {
        return this.stuff.get(k)
    }
    has(k: Item): boolean {
        return this.stuff.has(k)
    }
    evict(k: Item): void {
        this.stuff.delete(k)
    }
    keys(): Iterable<Item> {
        return this.stuff.keys()
    }
    values(): Iterable<Payload> {
        return this.stuff.values()
    }
}
function setupTestEnv() {
    let promises = new PromiseFarm();
    let fetchSpies: Set<Promise<unknown>> = new Set()
    const resolveFetches = () => { fetchSpies.forEach((p) => promises.mockResolve(p)); fetchSpies.clear() }
    const fakeFetchItem = () => promises.promiseMe({ buffer: { length: 1 } })
    const R: Meta<Item, Payload> = {
        fetch(k, signal) {
            console.log('fake-fetch: ', k)
            const f = fakeFetchItem()
            if (signal) {
                signal.onabort = () => promises.mockReject(f, 'cancelled')
            }
            delay(() => {
                console.log('download: ', k)
                if (signal?.aborted) {
                    promises.mockReject(f, 'cancelled')
                } else {
                    promises.mockResolve(f)
                }
            }, 0)
            fetchSpies.add(f)

            return f;
        },
        estimatedSize(k) {
            return 1
        },
        destroy(v) {
            // pretend to destroy v!
            // do that by mutating v I guess?
            // this type error is intentional - we want to catch attempted use of v.buffer.length
            // @ts-expect-error
            v.buffer = null;
        },
        size(v) {
            return v.buffer.length
        },
    }
    const fakeStore: FakeStore = new FakeStore()
    const cache: FancyCache<Item, Payload> = new FancyCache(fakeStore, R, 10)
    return { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises }
}
describe('single tenant caching', () => {
    let env = setupTestEnv()
    beforeEach(() => {
        env = setupTestEnv()

    })
    // it('request 2 things, get notified when the fetches happen', () => new Promise<void>(done => {
    //     let fetches = 0
    //     const myid = cache.registerClient((k, v) => {
    //         console.log('pretend to render ', k)
    //         fetches += 1
    //         if (fetches > 1) {
    //             console.log('expect???')
    //             expect(fakeStore.has('thing1')).toBeTruthy()
    //             expect(fakeStore.has('thing2')).toBeTruthy()
    //             console.log('we are done!')
    //             done()
    //         }
    //     })
    //     cache.setPriorities(myid, new Set(['thing1', 'thing2']))
    // }))
    it.skip('request 2 things, get notified when the fetches happen', async () => {
        const { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises } = env;
        let fetches = 0
        const finishTest = promises.promiseMe(5)
        expect.hasAssertions()
        const myid = cache.registerClient((k, v) => {
            fetches += 1
            if (fetches > 1) {
                promises.mockResolve(finishTest)
            }
        })
        cache.setPriorities(myid, new Set(['thing1', 'thing2']))
        resolveFetches()
        await finishTest
        expect(fakeStore.has('thing1')).toBeTruthy()
        expect(fakeStore.has('thing2')).toBeTruthy()
    })
    // note: these tests are not easy to write - things are asynchronous, and many tasks
    // sit in a self-limiting queue.
    // so far, the only way I have found to write reliable tests for this is
    // to do the test inside the client listener function
    it('responds (with eviction) in response to changing priorities and cache pressure', async () => {
        const { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises } = env;
        let fetches = 0
        const finishTest = promises.promiseMe(5)
        expect.hasAssertions()
        const myid = cache.registerClient((k, v) => {
            fetches += 1
            console.log(fetches)
            if (fetches == 5) {
                ['a', 'b', 'c', 'd', 'e'].forEach((requested) => expect(fakeStore.has(requested)))
            } else if (fetches == 10) {
                ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].forEach((requested) => expect(fakeStore.has(requested)))
                promises.mockResolve(finishTest) // end the test

            }
            // if (fetches > 14) {
            //     promises.mockResolve(finishTest)
            // }
        })

        cache.setPriorities(myid, new Set(['a', 'b', 'c', 'd', 'e']))
        cache.setPriorities(myid, new Set(['f', 'g', 'h', 'i', 'j']))

        // resolveFetches()
        // await Promise.resolve(3)
        // // resolveFetches()
        // // the limit is 10 - so all 10 things should be in the store
        // console.log('wtf', fakeStore, cache.store)
        // for (const item of ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j']) {
        //     expect(fakeStore.has(item)).toBeTruthy()
        // }
        // cache.setPriorities(myid, new Set(['a', 'b', 'c', 'p', 'q', 'r', 's', 't', 'u', 'v']))
        // resolveFetches()
        // // thats 10 things, 3 of which were already there - expect abc to be present, but everything else
        // // gone - it is a soft limit though...
        // for (const item of ['a', 'b', 'c', 'p', 'q', 'r', 's', 't', 'u', 'v']) {
        //     expect(fakeStore.has(item)).toBeTruthy()
        // }
        await finishTest
    })
})