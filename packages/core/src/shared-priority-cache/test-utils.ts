import { Resource, Store } from "./priority-cache";
import { uniqueId } from 'lodash';

export class PayloadFactory {
    resources: Record<string, 'created' | 'destroyed'>;
    constructor() {
        this.resources = {};
    }
    create(id: string, v: number) {
        this.resources[id] = 'created';
        // console.log('download complete: ', id);
        return new Payload(id, v, this);
    }
    release(id: string) {
        if (!(id in this.resources)) {
            throw new Error('no such id fail test');
        } else if (this.resources[id] === 'destroyed') {
            throw new Error('double-delete resource fail test');
        }
        this.resources[id] = 'destroyed';
    }
}

export class Payload implements Resource {
    data: number;
    id: string;
    private factory: PayloadFactory
    constructor(id: string, value: number, factory: PayloadFactory) {
        this.id = id;
        this.data = value;
        this.factory = factory
    }
    destroy() {
        this.factory.release(this.id);
    }
    sizeInBytes() {
        return 1;
    }
}

type Entry = {
    resolveMe: () => void;
    rejectMe: (reason?: unknown) => void;
};

export class PromiseFarm {
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
        const awaited: Promise<unknown>[] = [];
        for (const e of this.entries) {
            const [prom, entry] = e;
            awaited.push(prom);
            entry.resolveMe();
        }
        // console.log('resolved ', awaited.length);
        this.entries.clear();
        return Promise.all(awaited);
    }
}
type Item = string;
export class FakeStore implements Store<Item, Payload> {
    private stuff: Map<Item, Payload>;
    constructor() {
        this.stuff = new Map();
    }
    set(k: Item, v: Payload): void {
        this.stuff.set(k, v);
    }
    get(k: Item): Payload | undefined {
        return this.stuff.get(k);
    }
    has(k: Item): boolean {
        return this.stuff.has(k);
    }
    delete(k: Item): void {
        this.stuff.delete(k);
    }
    keys(): Iterable<Item> {
        return this.stuff.keys();
    }
    values(): Iterable<Payload> {
        return this.stuff.values();
    }
}