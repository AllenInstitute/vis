import { uniqueId } from 'lodash'
import { MinHeap } from './min-heap'

type CacheKey = string;
export interface Resource {
    destroy?: () => void;
    sizeInBytes: () => number
}
export interface Store<K extends {}, V extends {}> {
    set(k: K, v: V): void;
    get(k: K): V | undefined;
    has(k: K): boolean
    delete(k: K): void;
    keys(): Iterable<K>
    values(): Iterable<V>
}

export class PriorityCache {
    private store: Store<CacheKey, Resource>
    private evictPriority: MinHeap<CacheKey>
    private limit: number;
    private used: number;
    // items with lower scores will be evicted before items with high scores
    constructor(store: Store<CacheKey, Resource>, score: (k: CacheKey) => number, limitInBytes: number) {
        this.store = store;
        this.evictPriority = new MinHeap<CacheKey>(5000, score)
        this.limit = limitInBytes
        this.used = 0;
    }
    // add {key:item} to the cache - return false (and fail) if the key is already present
    // may evict items to make room
    // return true on success
    put(key: CacheKey, item: Resource): boolean {
        if (this.store.has(key)) {
            return false;
        }
        const size = item.sizeInBytes?.() ?? 1
        if (this.used + size > this.limit) {
            this.evictUntil(Math.max(0, this.limit - size))
        }
        this.evictPriority.addItem(key);
        this.store.set(key, item);
        this.used += size;
        return true;
    }
    update(key: CacheKey, item: Resource): boolean {
        if (!this.store.has(key)) {
            return false;
        }
        // replace key with item - make sure to track potential size diff...
        this.used -= this.store.get(key)?.sizeInBytes?.() ?? 1
        this.store.set(key, item);
        this.used += item.sizeInBytes?.() ?? 1;
        return true;
    }
    // it is expected that the score function is not "pure" - 
    // it has a closure over data that changes over time, representing changing priorities
    // thus - the owner of this cache has a responsibility to notify the cache when significant
    // changes in priority occur!
    reprioritize(score?: (k: CacheKey) => number) {
        this.evictPriority.rebuild(score)
    }
    get(key: CacheKey): Resource | undefined {
        return this.store.get(key)
    }
    has(key: CacheKey): boolean {
        return this.store.has(key)
    }
    isFull(): boolean {
        return this.used >= this.limit
    }
    private evictLowestPriority() {
        let evictMe = this.evictPriority.popMinItem()
        if (!evictMe) return false;

        const data = this.store.get(evictMe)
        if (data) {
            data.destroy?.();
            this.store.delete(evictMe)
            this.used -= data.sizeInBytes?.() ?? 1
        }
        return true;
    }
    private evictUntil(targetUsedBytes: number) {
        while (this.used > targetUsedBytes) {
            if (!this.evictLowestPriority()) { // note: evictLowestPriority mutates this.used
                return; // all items evicted...
            }
        }
    }

}