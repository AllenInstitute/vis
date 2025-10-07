
import { describe, expect, test } from 'vitest';
import { ICachingMultithreadedFetchStore, RequestHandler } from './store';
import { FetchSliceMessage, FetchSliceResponseMessage } from './fetch-slice.interface';
import { PromiseFarm } from '@alleninstitute/vis-core/src/shared-priority-cache/test-utils';

type SpyLog = {
    request: any,
    response: any,
    status: 'cancelled' | 'failed' | 'resolved'
}
class Whatever implements RequestHandler<FetchSliceMessage, FetchSliceResponseMessage> {
    promises: PromiseFarm;
    log: SpyLog[];
    constructor(farm: PromiseFarm) {
        this.promises = farm;
        this.log = []
    }
    submitRequest<RequestType, ResponseType>(message: RequestType, responseValidator: (obj: unknown) => obj is ResponseType, transfers: Transferable[], signal?: AbortSignal | undefined): Promise<ResponseType> {
        // so the generic parameters here cant work - the compile-time types of the interface to the worker are determined at construction time, not request time.
        // you can make the types work out here, but its a foot-gun. if you pass a responseValidator that the worker cant handle, the types will work out, but none of your promises will ever
        // resolve.
        const p = this.promises.promiseMe(() => {
            const resp = {
                request: message,
                id: message.id,
                payload: new Uint8Array(400)
            }
            this.log.push({ request: message, response: resp, status: 'resolved' })
            return resp
        })
        // this if(signal) block simulates the real worker-pool.ts, line 78
        if (signal) {
            signal.addEventListener('abort', () => {
                console.log('simulate cancel message to worker', message)
                this.log.push({ request: message, response: undefined, status: 'cancelled' })
                if (!this.promises.mockReject(p, 'cancel')) {
                    console.log('fake promise could not be found to reject...')
                }
            })
        } else {
            console.warn('warning - test request had no abort signal!')
        }

        return p;
    }

}
describe('basics', () => {

    test('requests seem to work', async () => {
        const farm = new PromiseFarm()
        const pool = new Whatever(farm)
        const store = new ICachingMultithreadedFetchStore('fake.zarr', pool, { maxFetches: 10, numWorkers: 5 })

        const a = store.get('/0/0')
        const b = store.get('/0/1')

        farm.resolveAll();
        const [A, B] = await Promise.all([a, b]);
        console.log(pool.log)
        expect(pool.log).toHaveLength(2)
        expect(A).toBeDefined()
        expect(B).toBeDefined()

    })
    test('duplicate requests get cached', async () => {
        const farm = new PromiseFarm()
        const pool = new Whatever(farm)
        const store = new ICachingMultithreadedFetchStore('fake.zarr', pool, { maxFetches: 10, numWorkers: 5 })

        const a = store.getRange('/0/0', { length: 100, offset: 0, suffixLength: 22 })
        const b = store.getRange('/0/1', { length: 100, offset: 0, suffixLength: 22 })
        const c = store.getRange('/0/0', { length: 100, offset: 0, suffixLength: 22 }) // same as a

        farm.resolveAll();
        const [A, B, C] = await Promise.all([a, b, c]);
        console.log(pool.log)
        expect(pool.log).toHaveLength(2) // c should come from the cache, the pool should not even see it
        expect(A).toBeDefined()
        expect(B).toBeDefined()
        expect(C).toBeDefined()
    })
    test('requests can be cancelled', async () => {
        const farm = new PromiseFarm()
        const pool = new Whatever(farm)
        const store = new ICachingMultithreadedFetchStore('fake.zarr', pool, { maxFetches: 10, numWorkers: 5 })
        const abortBoth = new AbortController()
        const a = store.get('/0/0', { signal: abortBoth.signal })
        const b = store.get('/0/1', { signal: abortBoth.signal })
        abortBoth.abort();
        // const [A, B] = await Promise.all([a, b]);
        expect(pool.log).toHaveLength(2)
        expect(pool.log.every((x) => x.status === 'cancelled'))
        // farm.resolveAll();
        try {
            const x = await a;
            // indicates the test should fail because we expect a rejection!
            expect(x).toBe('cancelled')

        } catch (reason) {
            expect(reason).toBe('cancel')
        }
        try {
            const x = await b;
            // indicates the test should fail because we expect a rejection!
            expect(x).toBe('cancelled')

        } catch (reason) {
            expect(reason).toBe('cancel')
        }
    })
    test('request the same thing twice, cancel one of the requests before either can resolve', async () => {

        const farm = new PromiseFarm()
        const pool = new Whatever(farm)
        const store = new ICachingMultithreadedFetchStore('fake.zarr', pool, { maxFetches: 10, numWorkers: 5 })
        const abortA = new AbortController();
        const abortB = new AbortController();
        const a = store.get('/0/0', { signal: abortA.signal })
        const b = store.get('/0/0', { signal: abortB.signal })
        try {
            console.log('lets abort')
            try {
                abortA.abort()
                const A = await a;
                expect(false).toBe(true)
            } catch (reasonForA) {
                console.log('a cancelled, this is fine')
                expect(reasonForA).toBe('cancel') // we aborted it, this is fine
            }
            const B = await b
            console.log('B is ', B)
            expect(B instanceof Uint8Array).toBeTruthy()
            expect(pool.log).toHaveLength(1)
            expect(pool.log[0].status).toEqual('resolved')
        } catch (reason) {
            console.error('b was aborted - this is a bug! ', reason)
            expect(false).toBeTruthy()
        }
        // the above stuff indicates a bug - in which cancelling A also cancels B, due to how the abort controllers are passed around
        // once that is fixed - we can call farm.resolveAll() after we call abortA.abort() and we should expect B to resolve!
        // expect the non-cancelled response to resolve
        // farm.resolveAll()

    })
})