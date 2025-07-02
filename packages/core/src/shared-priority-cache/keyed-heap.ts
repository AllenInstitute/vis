import { MinHeap } from './min-heap';

// its a min-heap, however items must have a key associated with them,
// this enables the keyedHeap to efficiently implement the has() function
// this also means its not possible to store duplicates in the heap
export class KeyedMinHeap<T, K extends string> {
    private heap: MinHeap<K>;
    private items: Map<K, T>;
    private keyFn: (t: T) => K;
    constructor(size: number, scoreSystem: (k: K) => number, keyFn: (t: T) => K) {
        this.heap = new MinHeap<K>(size, scoreSystem);
        this.keyFn = keyFn;
        this.items = new Map();
    }

    addItem(item: T) {
        const key = this.keyFn(item);
        if (!this.items.has(key)) {
            this.heap.addItem(key);
            this.items.set(key, item);
        }
    }
    popMinItem(): T | null {
        const min = this.heap.popMinItem();
        if (min !== null) {
            const item = this.items.get(min) ?? null;
            this.items.delete(min);
            return item;
        }
        return null;
    }
    popMinItemWithScore(): null | { item: T; score: number } {
        const entry = this.heap.popMinItemWithScore();
        if (entry !== null) {
            const key = entry.item;
            const item = this.items.get(key);
            this.items.delete(key);
            return item ? { item, score: entry.score } : null;
        }
        return null;
    }
    has(item: T) {
        return this.items.has(this.keyFn(item));
    }
    rebuild(score?: (k: K) => number) {
        this.heap.rebuild(score);
    }
    hasItemWithKey(k: K) {
        return this.items.has(k);
    }
}
