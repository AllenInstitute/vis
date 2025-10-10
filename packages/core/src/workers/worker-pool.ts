import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { isHeartbeatMessage, isWorkerMessageWithId, type WorkerMessage, type WorkerMessageWithId } from './messages';

type PromiseResolve<T extends WorkerMessageWithId> = (t: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// biome-ignore lint/suspicious/noExplicitAny: This is aligned with the standard Promise API
type PromiseReject = (reason: any) => void;

type MessageValidator<T> = TypeGuardFunction<unknown, T>;

type TypeGuardFunction<T, S extends T> = (value: T) => value is S;

type MessagePromise = {
    validator: MessageValidator<WorkerMessageWithId>;
    resolve: PromiseResolve<WorkerMessageWithId>;
    reject: PromiseReject;
    promise: Promise<WorkerMessageWithId>;
};

export enum WorkerStatus {
    Available = 'Available',
    Unresponsive = 'Unresponsive',
}

export class WorkerPool {
    #workers: Worker[];
    #promises: Map<string, MessagePromise>;
    #timeOfPreviousHeartbeat: Map<number, number>;
    #which: number;

    constructor(size: number, workerModule: URL) {
        this.#workers = new Array(size);
        this.#timeOfPreviousHeartbeat = new Map();
        for (let i = 0; i < size; i++) {
            this.#workers[i] = new Worker(workerModule, { type: 'module' });
            this.#workers[i].onmessage = (msg) => this.#handleMessage(i, msg);
            this.#timeOfPreviousHeartbeat.set(i, 0);
        }
        this.#promises = new Map();
        this.#which = 0;
    }

    #handleMessage(workerIndex: number, msg: MessageEvent<unknown>) {
        const { data } = msg;
        if (isHeartbeatMessage(data)) {
            this.#timeOfPreviousHeartbeat.set(workerIndex, Date.now());
            return;
        }
        if (isWorkerMessageWithId(data)) {
            const { id } = data;
            const messagePromise = this.#promises.get(id);
            if (messagePromise === undefined) {
                logger.warn('unexpected message from worker');
                return;
            }
            this.#promises.delete(id);
            if (!messagePromise.validator(data)) {
                const reason = 'invalid response from worker: message type did not match expected type';
                logger.error(reason);
                messagePromise.reject(new Error(reason));
                return;
            }
            messagePromise.resolve(data);
        } else {
            const reason = 'encountered an invalid message; skipping';
            logger.warn(reason);
        }
    }

    #roundRobin() {
        this.#which = (this.#which + 1) % this.#workers.length;
    }

    async #getNextInitializedWorker(timeout = 10000, waitTime = 200): Promise<number> {
        const wait = (millis: number) => new Promise((resolve) => setTimeout(resolve, millis));
        let timeWaited = 0;
        while (timeWaited < timeout) {
            for (let i = this.#which; i < this.#workers.length; i++) {
                const lastHeartbeat = this.#timeOfPreviousHeartbeat.get(i);
                if (lastHeartbeat === undefined) {
                    throw new Error('invalid worker state');
                }
                if (lastHeartbeat > 0) {
                    this.#which = i;
                    return i;
                }
            }
            const beforeWaiting = Date.now();
            await wait(waitTime);
            timeWaited += Date.now() - beforeWaiting;
        }
        // we didn't find an initialized worker before the timeout occurred :(
        return -1;
    }

    async submitRequest(
        message: WorkerMessage,
        responseValidator: MessageValidator<WorkerMessageWithId>,
        transfers: Transferable[],
        signal?: AbortSignal | undefined,
    ): Promise<WorkerMessageWithId> {
        const reqId = `rq${uuidv4()}`;
        const workerIndex = await this.#getNextInitializedWorker();
        if (workerIndex === -1) {
            throw new Error('could not submit request: workers have not initialized');
        }
        const messageWithId = { ...message, id: reqId };
        const messagePromise = this.#createMessagePromise(responseValidator);

        console.log('>>> >>> >>> received submission of request');
        console.log('>>> >>> >>> worker health:', this.getStatus(workerIndex));

        this.#promises.set(reqId, messagePromise);

        if (signal) {
            signal.addEventListener('abort', () => {
                this.#sendMessageToWorker(workerIndex, { type: 'cancel', id: reqId }, []);
                messagePromise.reject('cancelled');
            });
        }

        this.#sendMessageToWorker(workerIndex, messageWithId, transfers);
        this.#roundRobin();
        return messagePromise.promise;
    }

    #sendMessageToWorker(workerIndex: number, message: WorkerMessageWithId, transfers: Transferable[]) {
        const worker = this.#workers[workerIndex];
        if (worker === undefined) {
            throw new Error('cannot send message to worker: index invalid');
        }
        worker.postMessage(message, transfers);
    }

    #createMessagePromise(responseValidator: MessageValidator<WorkerMessageWithId>): MessagePromise {
        const { promise, resolve, reject } = Promise.withResolvers<WorkerMessageWithId>();

        return {
            validator: responseValidator,
            resolve,
            reject,
            promise,
        };
    }

    #isValidIndex(index: number): boolean {
        const len = this.#workers.length;
        return index < len && index >= 0;
    }

    getStatus(workerIndex: number): WorkerStatus {
        if (!this.#isValidIndex(workerIndex)) {
            throw new Error('invalid worker index');
        }
        const lastHeartbeat = this.#timeOfPreviousHeartbeat.get(workerIndex) ?? 0;
        if (lastHeartbeat === 0) {
            return WorkerStatus.Unresponsive;
        }
        const delta = Date.now() - lastHeartbeat;
        console.log('>>> >>> >>> >>> lastHeartbeat:', lastHeartbeat);
        console.log('>>> >>> >>> >>> delta:', delta);
        if (delta && delta > 1500) {
            return WorkerStatus.Unresponsive;
        }
        return WorkerStatus.Available;
    }

    getStatuses(): ReadonlyMap<number, WorkerStatus> {
        return this.#workers.reduce<Map<number, WorkerStatus>>((acc, _w, i) => {
            const delta = Date.now() - (this.#timeOfPreviousHeartbeat.get(i) ?? 0);
            if (delta && delta > 1500) {
                acc.set(i, WorkerStatus.Unresponsive);
            } else {
                acc.set(i, WorkerStatus.Available);
            }
            return acc;
        }, new Map());
    }
}
