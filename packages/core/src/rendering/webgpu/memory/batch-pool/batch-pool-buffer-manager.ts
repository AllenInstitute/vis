import { DisposedBufferError, InvalidHandleError, OutOfBudgetError } from '../errors';
import { type BufferHandle, BufferManagerBase, type BufferSlot, type BufferUsageFlags, type PoolStats } from '../types';
import { OutOfBucketError } from './errors';
import {
    type Batch,
    type BatchPoolBufferManagerConfig,
    type BatchPoolBufferManagerStats,
    type FreeEntry,
    PoolFacade,
    poolKey,
} from './types';

/** Internal record tying a live token to the buffer it represents. */
type ReleaseRecord = {
    readonly token: symbol;
    readonly handle: BufferHandle;
    readonly buffer: GPUBuffer;
    readonly batch: Batch;
    readonly pool: PoolFacade;
};

export class BatchPoolBufferManager extends BufferManagerBase<BatchPoolBufferManagerStats> {
    /** The supported bucket sizes. */
    readonly sizeBuckets: readonly number[];
    /** Number of buffers allocated in a single batch on a miss. */
    readonly growthBatchSize: number;

    /** Maps pool keys to their corresponding pool facade. */
    #poolsByKey: Map<string, PoolFacade> = new Map();
    /** token -> record. Source of truth for "is this handle still leased?". */
    #activeTokens: Map<symbol, ReleaseRecord> = new Map();
    /** Reverse lookup so `release(handle)` can find its token without trusting the handle. */
    #tokenByHandle: WeakMap<BufferHandle, symbol> = new WeakMap();
    /** Handles vended via `frameLease`; released en-masse at next `endFrame()`. */
    #frameLeases: BufferHandle[] = [];
    /** The current frame index. */
    #currentFrame = 0;
    /** The number of bytes currently resident in GPU memory for this Buffer Manager. */
    #residentBytes = 0;
    /** Monotonically increasing batch id for diagnostics and tiebreaking. */
    #nextBatchId = 0;
    /** Whether or not this Buffer Manager has been disposed. */
    #disposed = false;

    constructor(config: BatchPoolBufferManagerConfig) {
        super(config);
        if (config.sizeBuckets.length === 0) {
            throw new Error('BatchPoolBufferManager: sizeBuckets must be non-empty.');
        }
        config.sizeBuckets.forEach((b, i) => {
            if (!(b > 0) || !Number.isInteger(b)) {
                throw new Error(`BatchPoolBufferManager: sizeBuckets[${i}] = ${b} must be a positive integer.`);
            }
        });
        const buckets = config.sizeBuckets.slice().sort((a, b) => a - b);
        const growth = config.growthBatchSize ?? 2;
        if (!(growth >= 1) || !Number.isInteger(growth)) {
            throw new Error('BatchPoolBufferManager: growthBatchSize must be a positive integer.');
        }
        this.sizeBuckets = buckets;
        this.growthBatchSize = growth;
    }

    /**
     * Acquire a buffer of at least `sizeBytes` with `usage`. Routes to the `(bucketSize, usage)`
     * pool (rounding up to the smallest bucket), reusing a free buffer in FIFO order (warm reuse)
     * or allocating a new batch on a miss. If a new batch would exceed `maxBytes`, fully-free
     * batches are evicted oldest-first across all pools; if it still won't fit, `OutOfBudgetError`
     * is thrown. (Idle fully-free batches are also destroyed at `endFrame()`.)
     */
    acquire(sizeBytes: number, usage: BufferUsageFlags): BufferHandle {
        this.#assertNotDisposed();
        if (!(sizeBytes > 0) || !Number.isFinite(sizeBytes)) {
            throw new Error(`BatchPoolBufferManager.acquire: sizeBytes must be > 0 (got ${sizeBytes}).`);
        }
        const bucketSize = this.#bucketFor(sizeBytes, usage);
        const key = poolKey(bucketSize, usage);
        let pool = this.#poolsByKey.get(key);
        if (pool === undefined) {
            pool = new PoolFacade(bucketSize, usage, this.#currentFrame);
            this.#poolsByKey.set(key, pool);
        }
        pool.lastAcquireFrame = this.#currentFrame;

        let entry = pool.freeDeque.shift();
        if (entry === undefined) {
            // Miss: allocate a new batch (possibly evicting idle batches first to make room).
            this.telemetry.onMiss?.({ sizeBytes, bucketSize, usage });
            entry = this.#allocateBatchAndTakeOne(pool);
        }
        entry.batch.leasedCount++;
        return this.#mintHandle(entry, pool, sizeBytes);
    }

    acquireForSlot(slot: BufferSlot, sizeBytes: number, usage: BufferUsageFlags): BufferHandle {
        const required = requiredUsageFor(slot);
        if ((usage & required) !== required) {
            throw new Error(
                `BatchPoolBufferManager.acquireForSlot: slot '${slot.name}' (kind '${slot.kind}') requires ` +
                    `usage bits 0x${required.toString(16)} but received 0x${usage.toString(16)}.`
            );
        }
        return this.acquire(sizeBytes, usage);
    }

    precheck(budgetCost: number): boolean {
        if (!(budgetCost >= 0) || !Number.isFinite(budgetCost)) return false;
        // Optimistic check: every fully-free batch can in principle be evicted to make room.
        let evictableBytes = 0;
        for (const pool of this.#poolsByKey.values()) {
            for (const batch of pool.batches) {
                if (batch.destroyed) continue;
                if (batch.leasedCount === 0) {
                    evictableBytes += batch.buffers.length * pool.bucketSize;
                }
            }
        }
        return this.#residentBytes - evictableBytes + budgetCost <= this.maxBytes;
    }

    /**
     * Return a handle to its pool. Each handle carries a unique `Symbol` token; unknown tokens
     * — foreign handles, double-release, use-after-dispose — throw `InvalidHandleError`.
     */
    release(handle: BufferHandle): void {
        this.#assertNotDisposed();
        const token = this.#tokenByHandle.get(handle);
        if (token === undefined) {
            throw new InvalidHandleError('foreign');
        }
        const record = this.#activeTokens.get(token);
        if (record === undefined) {
            throw new InvalidHandleError('double-release');
        }
        this.#activeTokens.delete(token);
        this.#tokenByHandle.delete(handle);
        record.batch.leasedCount--;
        record.pool.freeDeque.push({ buffer: record.buffer, batch: record.batch });
        if (record.batch.leasedCount === 0) {
            record.batch.lastFullyFreeFrame = this.#currentFrame;
        }
    }

    endFrame(): void {
        this.#assertNotDisposed();
        // 1) Release frame-scoped leases.
        if (this.#frameLeases.length > 0) {
            // Drain into a local copy first so the array is empty before we mutate token state
            // (release() never reads #frameLeases, but the discipline keeps invariants tidy).
            const drained = this.#frameLeases.slice();
            this.#frameLeases.length = 0;
            for (const h of drained) {
                this.release(h);
            }
        }
        // 2) Sweep idle batches.
        const threshold = this.idleFrameLimit;
        for (const pool of this.#poolsByKey.values()) {
            // Collect victims first; destroyBatch mutates `pool.batches` during iteration otherwise.
            const victims: Batch[] = [];
            for (const batch of pool.batches) {
                if (batch.destroyed) continue;
                if (batch.leasedCount !== 0) continue;
                if (this.#currentFrame - batch.lastFullyFreeFrame >= threshold) {
                    victims.push(batch);
                }
            }
            for (const batch of victims) {
                const freed = pool.destroyBatch(batch);
                this.#residentBytes -= freed;
                this.telemetry.onEvict?.({
                    bucketSize: pool.bucketSize,
                    usage: pool.usage,
                    batchSize: batch.buffers.length,
                });
            }
        }
        // 3) Increment the frame counter
        this.#currentFrame += 1;
    }

    frameLease(sizeBytes: number, usage: BufferUsageFlags): BufferHandle {
        const handle = this.acquire(sizeBytes, usage);
        this.#frameLeases.push(handle);
        return handle;
    }

    stats(): BatchPoolBufferManagerStats {
        let leasedBytes = 0;
        let freeBytes = 0;
        const perPool: PoolStats[] = [];
        for (const pool of this.#poolsByKey.values()) {
            const leased = pool.leasedCount();
            const free = pool.freeCount();
            leasedBytes += leased * pool.bucketSize;
            freeBytes += free * pool.bucketSize;
            perPool.push(pool.toStats());
        }
        return {
            residentBytes: this.#residentBytes,
            leasedBytes,
            freeBytes,
            poolCount: this.#poolsByKey.size,
            perPool,
        };
    }

    dispose(): void {
        if (this.#disposed) return;
        for (const pool of this.#poolsByKey.values()) {
            // Force-destroy every batch even if leased; behavior of outstanding handles is
            // undefined post-dispose by contract.
            const batches = Array.from(pool.batches);
            for (const batch of batches) {
                batch.leasedCount = 0;
                pool.destroyBatch(batch);
            }
        }
        this.#poolsByKey.clear();
        this.#activeTokens.clear();
        this.#frameLeases.length = 0;
        this.#residentBytes = 0;
        this.#disposed = true;
    }

    // ----------------------------------------------------------------------------------------
    // Internals
    // ----------------------------------------------------------------------------------------

    #assertNotDisposed(): void {
        if (this.#disposed) {
            throw new DisposedBufferError();
        }
    }

    /** Smallest bucket >= `sizeBytes`. Throws `OutOfBucketError` if `sizeBytes` exceeds the largest. */
    #bucketFor(sizeBytes: number, usage: BufferUsageFlags): number {
        const buckets = this.sizeBuckets;
        const last = buckets[buckets.length - 1] as number;
        if (sizeBytes > last) {
            throw new OutOfBucketError(sizeBytes, usage, last);
        }
        // Binary search for first bucket >= sizeBytes.
        let lo = 0;
        let hi = buckets.length - 1;
        while (lo < hi) {
            const mid = (lo + hi) >>> 1;
            if ((buckets[mid] as number) >= sizeBytes) {
                hi = mid;
            } else {
                lo = mid + 1;
            }
        }
        return buckets[lo] as number;
    }

    /**
     * Allocate a new batch in `pool`, reclaiming idle batches across all pools as necessary to
     * stay within `maxBytes`. Returns the first free entry of the new batch (already removed
     * from `pool.freeDeque`; caller will increment `leasedCount`).
     */
    #allocateBatchAndTakeOne(pool: PoolFacade): FreeEntry {
        const bucketSize = pool.bucketSize;
        const usage = pool.usage;
        const newBytes = bucketSize * this.growthBatchSize;

        // Evict oldest fully-free batches (across all pools) until we fit, or run out.
        while (this.#residentBytes + newBytes > this.maxBytes) {
            const victim = this.#findGlobalEvictionVictim();
            if (victim === undefined) {
                throw new OutOfBudgetError(this.#residentBytes, this.maxBytes, newBytes);
            }
            const freed = victim.pool.destroyBatch(victim.batch);
            this.#residentBytes -= freed;
            this.telemetry.onEvict?.({
                bucketSize: victim.pool.bucketSize,
                usage: victim.pool.usage,
                batchSize: victim.batch.buffers.length,
            });
        }

        // Allocate the new batch.
        const buffers: GPUBuffer[] = [];
        for (let i = 0; i < this.growthBatchSize; i++) {
            buffers.push(
                this.device.createBuffer({
                    size: bucketSize,
                    usage,
                })
            );
        }
        const batch: Batch = {
            id: this.#nextBatchId++,
            bucketSize,
            usage,
            poolKey: pool.key,
            buffers,
            leasedCount: 0,
            lastFullyFreeFrame: this.#currentFrame,
            destroyed: false,
        };
        pool.batches.add(batch);
        this.#residentBytes += newBytes;
        this.telemetry.onAllocate?.({ bucketSize, usage, batchSize: buffers.length });

        // Hand the first buffer back; queue the rest as free.
        const first: FreeEntry = { buffer: buffers[0] as GPUBuffer, batch };
        for (let i = 1; i < buffers.length; i++) {
            pool.freeDeque.push({ buffer: buffers[i] as GPUBuffer, batch });
        }
        return first;
    }

    /**
     * Linear scan over all pools to find the globally-oldest fully-free batch. Tiebreaker is
     * the pool's `lastAcquireFrame` (older pool wins), then batch id (stable). Returns
     * `undefined` if no batch is currently fully-free in any pool.
     */
    #findGlobalEvictionVictim(): { pool: PoolFacade; batch: Batch } | undefined {
        let bestPool: PoolFacade | undefined;
        let bestBatch: Batch | undefined;
        for (const pool of this.#poolsByKey.values()) {
            const candidate = pool.oldestFullyFreeBatch();
            if (candidate === undefined) continue;
            if (bestBatch === undefined || bestPool === undefined) {
                bestPool = pool;
                bestBatch = candidate;
                continue;
            }
            if (candidate.lastFullyFreeFrame < bestBatch.lastFullyFreeFrame) {
                bestPool = pool;
                bestBatch = candidate;
            } else if (candidate.lastFullyFreeFrame === bestBatch.lastFullyFreeFrame) {
                if (pool.lastAcquireFrame < bestPool.lastAcquireFrame) {
                    bestPool = pool;
                    bestBatch = candidate;
                } else if (pool.lastAcquireFrame === bestPool.lastAcquireFrame && candidate.id < bestBatch.id) {
                    bestPool = pool;
                    bestBatch = candidate;
                }
            }
        }
        if (bestPool === undefined || bestBatch === undefined) return undefined;
        return { pool: bestPool, batch: bestBatch };
    }

    /** Build a `BufferHandle` and register its token. */
    #mintHandle(entry: FreeEntry, pool: PoolFacade, sizeBytesRequested: number): BufferHandle {
        const token = Symbol('BufferHandle');
        const buffer = entry.buffer;
        const batch = entry.batch;
        const bucketSize = pool.bucketSize;
        const usage = pool.usage;

        // We need `handle` to capture itself for `release()`. Define the closure that calls back
        // into the manager; using `this.release(handle)` keeps token validation centralized.
        const manager = this;
        const handle: BufferHandle = {
            gpu: buffer,
            offset: 0,
            size: bucketSize,
            sizeBytes: sizeBytesRequested,
            bucketSize,
            usage,
            release(): void {
                manager.release(handle);
            },
            sizeInBytes(): number {
                return bucketSize;
            },
            destroy(): void {
                manager.release(handle);
            },
        };
        this.#activeTokens.set(token, { token, handle, buffer, batch, pool });
        this.#tokenByHandle.set(handle, token);
        return handle;
    }
}

/**
 * Map a slot requirement to the minimum `GPUBufferUsage` bits a backing buffer must carry.
 * Only buffer-backed slot kinds participate; texture / sampler / external slots throw because
 * they're not buffer-backed and should never reach `acquireForSlot`.
 */
function requiredUsageFor(slot: BufferSlot): GPUBufferUsageFlags {
    switch (slot.kind) {
        case 'uniform':
            return GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST;
        case 'storage':
            return GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
        case 'texture':
        case 'storageTexture':
        case 'sampler':
        case 'externalTexture':
            throw new Error(
                `BatchPoolBufferManager.acquireForSlot: slot '${slot.name}' has kind '${slot.kind}' ` +
                    'which is not buffer-backed; use a TextureResource / SamplerResource factory instead.'
            );
    }
}
