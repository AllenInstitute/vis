/**
 * Internal data structures backing `BatchPoolBufferAdapter`.
 *
 * Each `(bucketSize, usage)` pair has a single `Pool`. A pool owns one or more `Batch`es, each a
 * fixed-size group of `GPUBuffer`s allocated together via a single round of `device.createBuffer`
 * calls. The batch is the unit of allocation and the unit of destruction: when every member of a
 * batch has been free for `idleFrameLimit` consecutive frames, the entire batch is destroyed at
 * `endFrame()`.
 *
 * Within a pool, individual free buffers live in a FIFO `freeDeque` keyed across batches. This
 * gives LRU semantics within a pool (oldest-released buffer is the next one handed out, which
 * lets the most-recently-used buffers stay warm for upcoming acquires of the same shape).
 *
 * `PoolFacade` implements `Cacheable` so each pool can flow through cache-aware machinery
 * elsewhere in the codebase. `sizeInBytes()` reports only the pool's **free** (evictable) bytes;
 * leased bytes are excluded so any cache layer that thinks in terms of evictable footprint sees
 * a truthful number. `destroy()` shrinks the pool by one full free batch (oldest-first),
 * matching Design A's "batch as the unit of release" property.
 *
 * **Why we don't use `PriorityCache` directly.** The earlier design called for wrapping each
 * pool as an entry in a `PriorityCache<PoolFacade>` for cross-pool eviction arbitration.
 * `PriorityCache` snapshots `sizeInBytes()` at `put()` time and has no public API to either
 * (a) notify it that an entry's size changed (our pools' free bytes change continuously) or
 * (b) remove an entry without going through eviction. Mutating an entry's reported size while it
 * lives in the cache would silently desynchronize the cache's internal `#used` accounting. We
 * still honor the design's interop goal by implementing `Cacheable` here; the cross-pool victim
 * selection inside the adapter is a small linear scan over the pools map (typically <100 pools).
 */

import type { Cacheable } from '../../../../shared-priority-cache/priority-cache';
import type { BufferUsageFlags, PoolStats, BufferManagerConfig, BufferManagerStats } from '../types';

export type BatchPoolBufferManagerConfig = BufferManagerConfig & {
    /**
     * Sorted-ascending list of buffer sizes the manager will allocate. Requests are rounded up
     * to the smallest bucket >= the requested size. Requests larger than the largest bucket
     * throw `OutOfBucketError`.
     */
    sizeBuckets: readonly number[];
    /**
     * Number of buffers allocated in a single batch on a miss. Larger values reduce
     * `createBuffer` traffic at the cost of coarser eviction granularity. Defaults to 2 — small
     * enough that idle eviction shrinks gracefully, large enough to amortize bursty acquires.
     */
    growthBatchSize?: number;
};

export type BatchPoolBufferManagerStats = BufferManagerStats & {
    /** Number of `(bucketSize, usage)` pools tracked. */
    poolCount: number;
    /** Per-pool stats included in `BufferManagerStats`. */
    perPool: readonly PoolStats[];
};

/**
 * One fixed-size allocation made via `device.createBuffer` repeated `buffers.length` times. The
 * batch is the unit of allocation and the unit of destruction.
 */
export type Batch = {
    /** Stable monotonically increasing batch id. Used for diagnostics and as a tiebreaker. */
    readonly id: number;
    readonly bucketSize: number;
    readonly usage: BufferUsageFlags;
    /** Pointer back to the owning pool's key for fast lookup during release. */
    readonly poolKey: string;
    /** All `GPUBuffer`s in this batch; identity-stable for the lifetime of the batch. */
    readonly buffers: readonly GPUBuffer[];
    /** Number of `buffers` currently leased (not in the pool's `freeDeque`). */
    leasedCount: number;
    /**
     * The frame at which this batch most recently transitioned to `leasedCount === 0`. Set at
     * batch creation (since freshly created batches are fully-free for an instant before the
     * first acquire pops from them) and updated on every release that completes the batch.
     */
    lastFullyFreeFrame: number;
    /** Set once `destroy()` has been called on all `buffers`; used to short-circuit accidental
     *  re-entry from late releases that race with eviction. */
    destroyed: boolean;
};

/** Entry in a pool's free FIFO. */
export type FreeEntry = {
    readonly buffer: GPUBuffer;
    readonly batch: Batch;
};

/**
 * One `(bucketSize, usage)` pool. Implements `Cacheable` so external machinery can reason about
 * a pool's evictable footprint via the shared `Cacheable` contract.
 */
export class PoolFacade implements Cacheable {
    /** Stable identifier `${bucketSize}|${usage}`. */
    readonly key: string;
    readonly bucketSize: number;
    readonly usage: BufferUsageFlags;
    /** All batches currently owned by this pool. Iteration order is creation order. */
    readonly batches: Set<Batch> = new Set();
    /** FIFO of free buffers. Push to tail on release, shift from head on acquire. */
    readonly freeDeque: FreeEntry[] = [];
    /** Frame index of the most recent `acquire()` from this pool. Drives LRU arbiter score. */
    lastAcquireFrame: number;

    constructor(bucketSize: number, usage: BufferUsageFlags, createFrame: number) {
        this.key = poolKey(bucketSize, usage);
        this.bucketSize = bucketSize;
        this.usage = usage;
        this.lastAcquireFrame = createFrame;
    }

    /** Number of currently-leased buffers across all batches. */
    leasedCount(): number {
        let n = 0;
        for (const batch of this.batches) {
            n += batch.leasedCount;
        }
        return n;
    }

    /** Number of currently-free buffers across all batches. */
    freeCount(): number {
        return this.freeDeque.length;
    }

    /** Total bytes (leased + free) currently owned by this pool. */
    residentBytes(): number {
        let total = 0;
        for (const batch of this.batches) {
            if (!batch.destroyed) {
                total += batch.buffers.length * this.bucketSize;
            }
        }
        return total;
    }

    /** `Cacheable.sizeInBytes`: free (evictable) bytes only. Leased bytes are excluded. */
    sizeInBytes(): number {
        return this.freeDeque.length * this.bucketSize;
    }

    /**
     * `Cacheable.destroy`: destroy one fully-free batch (oldest-first), or no-op if no batch is
     * currently fully-free. Returns the number of bytes released so the caller can iterate
     * until a target is met.
     */
    destroy(): number {
        const victim = this.oldestFullyFreeBatch();
        if (victim === undefined) return 0;
        return this.destroyBatch(victim);
    }

    /** Snapshot for `BufferAdapterStats.perPool`. */
    toStats(): PoolStats {
        return {
            bucketSize: this.bucketSize,
            usage: this.usage,
            leased: this.leasedCount(),
            free: this.freeCount(),
        };
    }

    /**
     * Find the oldest fully-free batch in this pool (lowest `lastFullyFreeFrame`). Returns
     * `undefined` if no batch is currently fully-free.
     */
    oldestFullyFreeBatch(): Batch | undefined {
        let oldest: Batch | undefined;
        for (const batch of this.batches) {
            if (batch.destroyed) continue;
            if (batch.leasedCount !== 0) continue;
            if (oldest === undefined || batch.lastFullyFreeFrame < oldest.lastFullyFreeFrame) {
                oldest = batch;
            }
        }
        return oldest;
    }

    /**
     * Destroy `batch`: call `destroy()` on every `GPUBuffer` it owns, remove its entries from
     * `freeDeque`, drop the batch from `batches`, and mark it destroyed. Returns the byte count
     * freed (always `bucketSize * batch.buffers.length`).
     *
     * Caller is responsible for asserting `batch.leasedCount === 0` (we assert here too).
     */
    destroyBatch(batch: Batch): number {
        if (batch.destroyed) return 0;
        if (batch.leasedCount !== 0) {
            throw new Error(
                `PoolFacade.destroyBatch: refusing to destroy batch ${batch.id} ` +
                    `with ${batch.leasedCount} leased buffer(s).`
            );
        }
        const freedBytes = batch.buffers.length * this.bucketSize;
        // Remove this batch's entries from the FIFO. Walk once; preserve relative order of others.
        if (this.freeDeque.length > 0) {
            const kept: FreeEntry[] = [];
            for (const entry of this.freeDeque) {
                if (entry.batch !== batch) kept.push(entry);
            }
            this.freeDeque.length = 0;
            for (const entry of kept) this.freeDeque.push(entry);
        }
        for (const buf of batch.buffers) {
            buf.destroy();
        }
        batch.destroyed = true;
        this.batches.delete(batch);
        return freedBytes;
    }
}

export function poolKey(bucketSize: number, usage: BufferUsageFlags): string {
    return `${bucketSize}|${usage}`;
}
