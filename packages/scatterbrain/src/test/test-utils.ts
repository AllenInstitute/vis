import { delay } from "lodash";

export const fakeFetch = <FakeTask>(data: FakeTask, signal?: AbortSignal): Promise<FakeTask> =>
    new Promise((resolve, reject) => {
        delay(() => {
            if (signal?.aborted ?? false) {
                reject(new DOMException('abort fetch', 'AbortError'));
            } else {
                resolve(data);
            }
        }, 100 * Math.random() + 50);
    });