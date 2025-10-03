import { isWorkerMessageWithId, type WorkerMessage, type WorkerMessageWithId } from './fetch-slice.interface';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '@alleninstitute/vis-core';

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

export class WorkerPool {
    #workers: Worker[];
    #promises: Map<string, MessagePromise<WorkerMessageWithId>>;
    #which: number;

    constructor(size: number, workerModule: URL) {
        this.#workers = new Array(size);
        for (let i = 0; i < size; i++) {
            this.#workers[i] = new Worker(workerModule, { type: 'module' });
            this.#workers[i].onmessage = (msg) => this.#handleResponse(msg);
        }
        this.#promises = new Map();
        this.#which = 0;
    }

    #handleResponse(msg: MessageEvent<unknown>) {
        const { data } = msg;
        if (isWorkerMessageWithId(data)) {
            const { id } = data;
            const messagePromise = this.#promises.get(id);
            this.#promises.delete(id);
            if (messagePromise === undefined) {
                logger.warn('unexpected message from worker');
                return;
            }
            if (!messagePromise.validator(data)) {
                logger.error('invalid response from worker: message type did not match expected type');
                return;
            }
            messagePromise.resolve(data);
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

        // TODO this cast is very annoying; would be nice to remove it
        this.#promises.set(reqId, messagePromise as unknown as MessagePromise<WorkerMessageWithId>);

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
}
