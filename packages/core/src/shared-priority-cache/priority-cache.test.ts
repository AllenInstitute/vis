import delay from 'lodash/delay';
import { beforeEach, describe, expect, it } from 'vitest';
import { PriorityCache, Resource, type Store } from './priority-cache'
import { uniqueId } from 'lodash';

type Item = string;

// so we can spy on our resource cleanup stuff
class PayloadFactory {
    resources: Record<string, 'created' | 'destroyed'>
    constructor() {
        this.resources = {}
    }
    create(id: string, v: number) {
        this.resources[id] = 'created'
        console.log('download complete: ', id)
        return new Payload(id, v)
    }
    release(id: string) {
        if (!(id in this.resources)) {
            throw new Error('no such id fail test')
        } else if (this.resources[id] === 'destroyed') {
            throw new Error('double-delete resource fail test')
        }
        this.resources[id] = 'destroyed'
    }
}
let factory = new PayloadFactory();

class Payload implements Resource {
    data: number
    id: string
    constructor(id: string, value: number) {
        this.id = id
        this.data = value
    }
    destroy() {
        factory.release(this.id)
    }
    sizeInBytes() {
        return 1
    }

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
    promiseMe<T>(tfn: () => T) {
        const reqId = uniqueId('rq');
        const prom = new Promise<T>((resolve, reject) => {
            this.staging[reqId] = {
                resolveMe: () => resolve(tfn()),
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
        console.log('resolved ', awaited.length)
        this.entries.clear()
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
    set(k: Item, v: Payload): void {
        this.stuff.set(k, v)
    }
    get(k: Item): Payload | undefined {
        return this.stuff.get(k)
    }
    has(k: Item): boolean {
        return this.stuff.has(k)
    }
    delete(k: Item): void {
        this.stuff.delete(k)
    }
    keys(): Iterable<Item> {
        return this.stuff.keys()
    }
    values(): Iterable<Payload> {
        return this.stuff.values()
    }
}
function setupTestEnv(limit: number, fetchLimit: number) {
    let promises = new PromiseFarm();
    let fetchSpies: Set<Promise<unknown>> = new Set()
    // const resolveFetches = () => { fetchSpies.forEach((p) => promises.mockResolve(p)); fetchSpies.clear(); return Promise.resolve(3) }
    const resolveFetches = () => promises.resolveAll()
    const fakeFetchItem = (id: string) => (_sig: AbortSignal) => {
        console.log('request: ', id)
        return promises.promiseMe(
            () => factory.create(id, 33))
    }
    factory = new PayloadFactory()
    const fakeStore: FakeStore = new FakeStore()
    const cache: PriorityCache = new PriorityCache(fakeStore, () => 0, limit, fetchLimit)
    return { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises }
}
describe('basics', () => {
    let env = setupTestEnv(5, 10)
    beforeEach(() => {
        env = setupTestEnv(5, 10)
    })
    it('put 5 things in, see them in the store', async () => {
        const { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises } = env;
        const enq = (id: string) => cache.enqueue(id, fakeFetchItem(id))
        // enqueue 5 things, get them all back
        const things = ['a', 'b', 'c', 'd', 'e']
        things.forEach(enq)
        await resolveFetches();
        things.forEach(id => expect(cache.has(id)))
    })
    it('when evicting and fetching, priority is respected', async () => {
        const score = { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }
        env = setupTestEnv(5, 1)
        const { cache, resolveFetches, fakeFetchItem, fetchSpies, fakeStore, promises } = env;
        const enq = (id: string) => cache.enqueue(id, fakeFetchItem(id))
        cache.reprioritize(x => score[x] ?? 0)
        const things = ['a', 'b', 'c', 'd', 'e']
        // this cache can only resolve one fetch at a time
        // so we can see that the fetching happens in priority order, regardless of the enq order
        things.forEach(enq)
        expect(factory.resources).toEqual({})
        await resolveFetches() // resolves all pending fetches - there should be only one
        expect(factory.resources).toEqual({ a: 'created' })
        // at the time a was enqueued, one fetch-slot was available, and a was the highest priority item
        // before it could resolve, we enqueued b,c,d,e in that order
        await resolveFetches() // resolves all pending fetches - there should be only one
        expect(factory.resources).toEqual({ a: 'created', e: 'created' })
        await resolveFetches() // resolves all pending fetches - there should be only one
        expect(factory.resources).toEqual({ a: 'created', e: 'created', d: 'created' })
        await resolveFetches() // resolves all pending fetches - there should be only one
        expect(factory.resources).toEqual({ a: 'created', e: 'created', d: 'created', c: 'created' })
        await resolveFetches() // resolves all pending fetches - there should be only one
        expect(factory.resources).toEqual({ a: 'created', e: 'created', d: 'created', c: 'created', b: 'created' })
        // the cache is full - we'd expect to evict a and b, as the lowest priority items
        enq('f')
        enq('g')
        await resolveFetches()
        await resolveFetches()
        expect(factory.resources).toEqual({
            a: 'destroyed',
            e: 'created',
            d: 'created',
            c: 'created',
            b: 'destroyed',
            f: 'created',
            g: 'created'
        })
    })
})