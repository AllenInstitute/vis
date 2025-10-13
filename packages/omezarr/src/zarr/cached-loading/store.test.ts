import { describe, expect, test } from 'vitest';
import { CachingMultithreadedFetchStore, type RequestHandler } from './store';
import {
    FETCH_RESPONSE_MESSAGE_TYPE,
    type FetchMessage,
    type FetchResponseMessage,
} from './fetch-data.interface';
import { PromiseFarm } from '@alleninstitute/vis-core/src/shared-priority-cache/test-utils';

type SpyLog = {
    // biome-ignore lint/suspicious/noExplicitAny: Typing improvements for Messages are a future enhancement
    request: any;
    // biome-ignore lint/suspicious/noExplicitAny: Typing improvements for Messages are a future enhancement
    response: any;
    status: 'cancelled' | 'failed' | 'resolved';
};
class Whatever implements RequestHandler<FetchMessage, FetchResponseMessage> {
    promises: PromiseFarm;
    log: SpyLog[];
    constructor(farm: PromiseFarm) {
        this.promises = farm;
        this.log = [];
    }
    submitRequest(
        message: FetchMessage,
        _responseValidator: (obj: unknown) => obj is FetchResponseMessage,
        _transfers: Transferable[],
        signal?: AbortSignal | undefined,
    ): Promise<FetchResponseMessage> {
        // so the generic parameters here cant work - the compile-time types of the interface to the worker are determined at construction time, not request time.
        // you can make the types work out here, but its a foot-gun. if you pass a responseValidator that the worker cant handle, the types will work out, but none of your promises will ever
        // resolve.
        const p = this.promises.promiseMe(() => {
            const resp = {
                type: FETCH_RESPONSE_MESSAGE_TYPE,
                request: message,
                id: message.id,
                payload: new Uint8Array(400).buffer,
            };
            this.log.push({ request: message, response: resp, status: 'resolved' });
            return resp;
        });
        // this if(signal) block simulates the real worker-pool.ts, line 78
        if (signal) {
            signal.addEventListener('abort', () => {
                this.log.push({ request: message, response: undefined, status: 'cancelled' });
                if (!this.promises.mockReject(p, 'cancel')) {
                    // biome-ignore lint/suspicious/noConsole: Provides test outcome context
                    console.log('fake promise could not be found to reject...');
                }
            });
        } else {
            // biome-ignore lint/suspicious/noConsole: Provides test outcome context
            console.warn('warning - test request had no abort signal!');
        }

        return p;
    }
}
describe('basics', () => {
    test('requests seem to work', async () => {
        const farm = new PromiseFarm();
        const pool = new Whatever(farm);
        const store = new CachingMultithreadedFetchStore('fake.zarr', pool, { maxFetches: 10, numWorkers: 5 });

        const a = store.get('/0/0');
        const b = store.get('/0/1');

        farm.resolveAll();
        const [A, B] = await Promise.all([a, b]);
        expect(pool.log).toHaveLength(2);
        expect(A).toBeDefined();
        expect(B).toBeDefined();
    });
    test('duplicate requests get cached', async () => {
        const farm = new PromiseFarm();
        const pool = new Whatever(farm);
        const store = new CachingMultithreadedFetchStore('fake.zarr', pool, { maxFetches: 10, numWorkers: 5 });

        const a = store.getRange('/0/0', { length: 100, offset: 0, suffixLength: 22 });
        const b = store.getRange('/0/1', { length: 100, offset: 0, suffixLength: 22 });
        const c = store.getRange('/0/0', { length: 100, offset: 0, suffixLength: 22 }); // same as a

        farm.resolveAll();
        const [A, B, C] = await Promise.all([a, b, c]);
        expect(pool.log).toHaveLength(2); // c should come from the cache, the pool should not even see it
        expect(A).toBeDefined();
        expect(B).toBeDefined();
        expect(C).toBeDefined();
    });
    test('requests can be cancelled', async () => {
        const farm = new PromiseFarm();
        const pool = new Whatever(farm);
        const store = new CachingMultithreadedFetchStore('fake.zarr', pool, { maxFetches: 10, numWorkers: 5 });
        const abortBoth = new AbortController();
        const a = store.get('/0/0', { signal: abortBoth.signal });
        const b = store.get('/0/1', { signal: abortBoth.signal });
        abortBoth.abort();
        // const [A, B] = await Promise.all([a, b]);
        expect(pool.log).toHaveLength(2);
        expect(pool.log.every((x) => x.status === 'cancelled'));
        // farm.resolveAll();
        try {
            const x = await a;
            // indicates the test should fail because we expect a rejection!
            expect(x).toBe('cancelled');
        } catch (reason) {
            expect(reason).toBe('cancel');
        }
        try {
            const x = await b;
            // indicates the test should fail because we expect a rejection!
            expect(x).toBe('cancelled');
        } catch (reason) {
            expect(reason).toBe('cancel');
        }
    });
    test('request the same thing twice, cancel one of the requests before either can resolve', async () => {
        const farm = new PromiseFarm();
        const pool = new Whatever(farm);
        const store = new CachingMultithreadedFetchStore('fake.zarr', pool, { maxFetches: 10, numWorkers: 5 });
        const abortA = new AbortController();
        const abortB = new AbortController();
        const a = store.get('/0/0', { signal: abortA.signal });
        const b = store.get('/0/0', { signal: abortB.signal });
        try {
            abortA.abort();
            farm.resolveAll();
            const B = await b;
            // we know a is toast... do it this way for shortness:
            a.then(
                // biome-ignore lint/suspicious/noConsole: Provides test outcome context
                (x) => console.log('a should be cancelled, but instead its', x),
                () => {},
            );
            expect(B instanceof Uint8Array).toBeTruthy();
            expect(pool.log).toHaveLength(1);
            expect(pool.log[0].status).toEqual('resolved');
        } catch (reason) {
            // biome-ignore lint/suspicious/noConsole: Provides test outcome context
            console.error('b was aborted - this is a bug! ', reason);
            expect(false).toBeTruthy();
        }
        // the above stuff indicates a bug - in which cancelling A also cancels B, due to how the abort controllers are passed around
        // once that is fixed - we can call farm.resolveAll() after we call abortA.abort() and we should expect B to resolve!
        // expect the non-cancelled response to resolve
        // farm.resolveAll()
    });
});
