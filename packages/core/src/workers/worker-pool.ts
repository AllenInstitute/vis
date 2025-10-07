import { v4 as uuidv4 } from 'uuid';
import { logger } from '../logger';
import { isHeartbeatMessage, isWorkerMessageWithId, type WorkerMessage, type WorkerMessageWithId } from './messages';

type PromiseResolve<T extends WorkerMessageWithId> = (t: T) => void;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
// biome-ignore lint/suspicious/noExplicitAny: This is aligned with the standard Promise API
type PromiseReject = (reason: any) => void;

type MessageValidator<T> = TypeGuardFunction<unknown, T>;

type TypeGuardFunction<T, S extends T> = (value: T) => value is S;

type MessagePromise<T extends WorkerMessageWithId> = {
    validator: MessageValidator<T>;
    resolve: PromiseResolve<T>;
    reject: PromiseReject;
    promise: Promise<T>;
};

export enum WorkerStatus {
    Available = 'Available',
    Working = 'Working',
    Unresponsive = 'Unresponsive',
}

export class WorkerPool {
    #workers: Worker[];
    #promises: Map<number, MessagePromise<WorkerMessageWithId>>;
    #statuses: Map<number, WorkerStatus>;
    #timeOfPreviousHeartbeat: Map<number, number>;
    #which: number;

    constructor(size: number, workerModule: URL) {
        this.#workers = new Array(size);
        this.#timeOfPreviousHeartbeat = new Map();
        this.#statuses = new Map();
        for (let i = 0; i < size; i++) {
            this.#workers[i] = new Worker(workerModule, { type: 'module' });
            this.#workers[i].onmessage = (msg) => this.#handleMessage(i, msg);
            this.#timeOfPreviousHeartbeat.set(i, Date.now());
            this.#statuses.set(i, WorkerStatus.Available);
            setInterval(() => {
                const delta = Date.now() - (this.#timeOfPreviousHeartbeat.get(i) ?? 0);
                if (delta && delta > 1500) {
                    this.#statuses.set(i, WorkerStatus.Unresponsive);
                }
            }, 2000);
        }
        this.#promises = new Map();
        this.#which = 0;
    }

    #handleMessage(workerIndex: number, msg: MessageEvent<unknown>) {
        const { data } = msg;
        const messagePromise = this.#promises.get(workerIndex);
        if (isHeartbeatMessage(data)) {
            this.#timeOfPreviousHeartbeat.set(workerIndex, Date.now());
            if (messagePromise === undefined) {
                this.#statuses.set(workerIndex, WorkerStatus.Available);
            } else {
                this.#statuses.set(workerIndex, WorkerStatus.Working);
            }
            return;
        }
        if (messagePromise === undefined) {
            logger.warn('unexpected message from worker');
            return;
        }
        if (isWorkerMessageWithId(data)) {
            this.#promises.delete(workerIndex);
            if (!messagePromise.validator(data)) {
                const reason = 'invalid response from worker: message type did not match expected type';
                logger.error(reason);
                messagePromise.reject(new Error(reason));
                return;
            }
            messagePromise.resolve(data);
        } else {
            const reason = 'encountered an invalid message; skipping';
            logger.error(reason);
            messagePromise.reject(new Error(reason));
        }
    }

    #roundRobin() {
        this.#which = (this.#which + 1) % this.#workers.length;
    }

    submitRequest<RequestType extends WorkerMessage, ResponseType extends WorkerMessageWithId>(
        message: RequestType,
        responseValidator: MessageValidator<ResponseType>,
        transfers: Transferable[],
        signal?: AbortSignal | undefined,
    ): Promise<ResponseType> {
        const reqId = `rq${uuidv4()}`;
        const workerIndex = this.#which;
        const messageWithId = { ...message, id: reqId };
        const messagePromise = this.#createMessagePromise<ResponseType>(responseValidator);

        // TODO this cast vexes me; would be nice to remove it
        this.#promises.set(workerIndex, messagePromise as unknown as MessagePromise<WorkerMessageWithId>);

        if (signal) {
            signal.onabort = () => {
                this.#sendMessageToWorker(workerIndex, { type: 'cancel', id: reqId }, []);
                messagePromise.reject('cancelled');
            };
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

    #createMessagePromise<T extends WorkerMessageWithId>(responseValidator: MessageValidator<T>): MessagePromise<T> {
        const { promise, resolve, reject } = Promise.withResolvers<T>();

        return {
            validator: responseValidator,
            resolve,
            reject,
            promise,
        };
    }

    getStatus(workerIndex: number): WorkerStatus {
        const status = this.#statuses.get(workerIndex);
        if (status === undefined) {
            throw new Error(`invalid worker index: ${workerIndex}`);
        }
        return status;
    }

    getStatuses(): ReadonlyMap<number, WorkerStatus> {
        return new Map<number, WorkerStatus>(this.#statuses.entries());
    }
}
