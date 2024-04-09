import delay from 'lodash/delay';
import { beginLongRunningFrame, type NormalStatus } from '../render-queue';
import { AsyncDataCache } from '../dataset-cache';

type FakeTask = { id: number; color: string };
type FakeItem = { id: number };
type FakeSettings = { color: string };
function cacheKey(item: FakeItem, settings: FakeSettings) {
    return `${settings.color}_${item.id}`;
}
// a few easy tests to start, we can get crazy later
describe('beginLongRunningFrame', () => {
    const fakeFetch = (id: number, color: string, signal?: AbortSignal): Promise<FakeTask> =>
        new Promise((resolve, reject) => {
            delay(() => {
                if (signal?.aborted ?? false) {
                    reject(new DOMException('abort fetch', 'AbortError'));
                } else {
                    resolve({ id, color });
                }
            }, 100 * Math.random() + 50);
        });
    let cache: AsyncDataCache<string, string, FakeTask> = new AsyncDataCache(() => { }, () => 1, 9999);
    let renderSequence: FakeTask[] = [];
    function renderPretender(item: FakeItem, settings: FakeSettings, tasks: Record<string, FakeTask | undefined>) {
        const tsk = tasks[cacheKey(item, settings)];
        if (!tsk) throw new Error('undefined column!');
        renderSequence.push(tsk);
    }
    const getPretendItemsToRender = (howMany: number) => {
        const items: FakeItem[] = [];
        for (let i = 0; i < howMany; i += 1) {
            items.push({ id: i });
        }
        return items;
    };
    function rq(item: FakeItem, settings: FakeSettings, signal?: AbortSignal) {
        return {
            [cacheKey(item, settings)]: () => fakeFetch(item.id, settings.color, signal),
        };
    }
    // a less wordy fake frame:
    const fakeFrame = (
        items: number,
        eventHandler: (event: { status: NormalStatus } | { status: 'error'; error: unknown }) => void
    ) =>
        beginLongRunningFrame<FakeTask, FakeItem, FakeSettings>(
            5,
            33,
            getPretendItemsToRender(items),
            cache,
            { color: 'red' },
            rq,
            renderPretender,
            eventHandler,
            (rq: string, item: FakeItem, settings: FakeSettings) => cacheKey(item, settings),
            9999
        );
    beforeEach(() => {
        cache = new AsyncDataCache(() => { }, () => 1, 9999);
        renderSequence = [];
    });
    it('runs the expected number of tasks', (done) => {
        const events: string[] = [];
        fakeFrame(9, (e) => {
            events.push(e.status); // track the events for the test
            switch (e.status) {
                case 'finished':
                    expect(renderSequence.length).toBe(9);
                    expect(events.length).toBe(9 + 2); // begin, ... progress x9 ..., finished
                    expect(events[0]).toEqual('begun');
                    expect(events[events.length - 1]).toEqual('finished');
                    done(); // if I dont get called, the test will fail very slowly
                    break;
                default:
                    break;
            }
        });
    });
    it('can be cancelled without crash', (done) => {
        try {
            const frame = fakeFrame(9, (e) => {
                expect(renderSequence.length).toBeLessThan(9);
                switch (e.status) {
                    case 'cancelled':
                        done();
                        break;
                    default:
                        break;
                }
            });
            // cancel the fetch after brief delay to simulate cancelling partway through
            delay(() => frame.cancelFrame('for testing'), 1);
        } catch (err) {
            // should not happen!
            expect(err).not.toBeDefined();
        }
    });
    it('synchronously completes the second frame, because the cache gets warmed up', (done) => {
        const allEvents: string[] = [];

        fakeFrame(9, (e) => {
            allEvents.push(e.status);
            if (e.status === 'finished') {
                // start the second frame after the first is done for this test:
                // eslint-disable-next-line @typescript-eslint/no-shadow
                fakeFrame(9, (e) => {
                    allEvents.push(e.status);
                    switch (e.status) {
                        case 'finished_synchronously':
                            expect(renderSequence.length).toBe(9 + 9); // two frames, each having 9 tasks
                            expect(allEvents.length).toBe(9 + 2 + 1); // all of the events of the first frame(begun,progress*9,finished) + 'finished_sync'
                            break;
                        default:
                            expect(e.status).toBe('finished_synchronously');
                    }
                    done();
                });
            }
        });
    });
});
