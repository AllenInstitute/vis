/**
 * Public types for the WebGPU buffer memory manager.
 *
 * The `BufferManager` interface is the contract every concrete implementation honors. Consumers
 * (binding-graph providers, encoder code, etc.) should type their parameters as `BufferManager`
 * so the underlying allocation strategy can be swapped without changing call sites.
 *
 * The first concrete implementation is `BatchPoolBufferManager` (Design A: batched per-bucket
 * pools). Future siblings — e.g. `LruPoolBufferManager` (per-buffer LRU) or `SlabBufferManager`
 * (sub-allocating slabs) — will conform to the same interface and may be selected at
 * construction.
 */

import type { Cacheable } from '../../../shared-priority-cache/priority-cache';

/**
 * GPU buffer usage flag-set. WebGPU's `GPUBufferUsageFlags` is the bag of flags from
 * `GPUBufferUsage.*`. We accept any union (a `number`) since the typing depends on the WebGPU
 * lib edition in scope.
 */
export type BufferUsageFlags = GPUBufferUsageFlags;

/**
 * Optional callbacks for debug overlays, profiling, and telemetry pipelines. Hooks fire after
 * the corresponding internal state change has settled.
 */
export type BufferManagerTelemetry = {
    /** Fired when a fresh batch of `bucketSize * batchSize` bytes is allocated from `device`. */
    onAllocate?: (info: BatchEventInfo) => void;
    /** Fired when an idle batch is destroyed and its bytes returned to `device`. */
    onEvict?: (info: BatchEventInfo) => void;
    /** Fired when `acquire()` cannot satisfy a request from existing free entries. */
    onMiss?: (info: MissEventInfo) => void;
};

export type BatchEventInfo = {
    bucketSize: number;
    usage: BufferUsageFlags;
    /** Number of buffers in the affected batch. */
    batchSize: number;
};

export type MissEventInfo = {
    /** The caller's original size request. */
    sizeBytes: number;
    /** The bucket size the request was rounded up to. */
    bucketSize: number;
    usage: BufferUsageFlags;
};

/** Shared base config for any `BufferManager` implementation. */
export type BufferManagerConfig = {
    device: GPUDevice;
    /** Hard ceiling on total bytes the manager may hold live (resident) at any moment. */
    maxBytes: number;
    /**
     * Frames a fully-free batch may sit unused before becoming a candidate for destruction.
     * Counted at `endFrame()`. An entry released at frame F is gone no earlier than `endFrame()`
     * called during frame `F + idleFrameLimit`.
     */
    idleFrameLimit: number;
    /** Optional debug/telemetry callbacks. */
    telemetry?: BufferManagerTelemetry;
};

/** Per-pool stats included in `BufferManagerStats`. */
export type PoolStats = {
    bucketSize: number;
    usage: BufferUsageFlags;
    /** Currently-leased buffer count. */
    leased: number;
    /** Currently-free buffer count (across all batches in this pool). */
    free: number;
};

export type BufferManagerStats = {
    /** Total bytes the manager currently owns (leased + free). */
    residentBytes: number;
    /** Bytes corresponding to leased buffers (not eligible for eviction). */
    leasedBytes: number;
    /** Bytes corresponding to free buffers (eligible for eviction subject to idle policy). */
    freeBytes: number;
};

/**
 * Handle returned by `BufferManager.acquire`. Holders bind against `handle.buffer` and call
 * `release()` (or `manager.release(handle)`) when done.
 *
 * Implements `Cacheable` so handles can be threaded through any other cache-aware machinery in
 * the codebase. `sizeInBytes()` returns the actual `bucketSize` (the physical buffer's byte
 * length), not the caller's `sizeBytes` request. `destroy()` is an alias for `release()` so a
 * handle can also be added to a `Cacheable` cache that drives eviction.
 */
export interface BufferHandle extends Cacheable {
    /** The underlying GPUBuffer, suitable for bind-group entries. Stable for the handle's lifetime. */
    readonly buffer: GPUBuffer;
    /** The caller's original size request (in bytes). */
    readonly sizeBytes: number;
    /** The actual physical size of `buffer`. Always >= `sizeBytes` and a member of `sizeBuckets`. */
    readonly bucketSize: number;
    /** The usage flag-set this buffer was allocated with. */
    readonly usage: BufferUsageFlags;
    /** Return this buffer to the pool. Equivalent to `manager.release(this)`. Idempotent-safe
     *  is NOT guaranteed: calling twice throws (use the token-checked `release` path). */
    release(): void;
    /** `Cacheable.sizeInBytes`: returns `bucketSize`. */
    sizeInBytes(): number;
    /** `Cacheable.destroy`: alias for `release()` so handles plug into cache eviction paths. */
    destroy(): void;
}

/**
 * Public surface of every concrete buffer manager. See `BatchPoolBufferManager` for the first
 * concrete implementation.
 */
export interface BufferManager<Stats extends BufferManagerStats = BufferManagerStats> {
    /**
     * Obtain a buffer of at least `sizeBytes`, allocated with `usage`. The returned handle's
     * `buffer.size` will be the bucket the request rounds up to. Throws `OutOfBucketError` if
     * the request exceeds the largest bucket; throws `OutOfBudgetError` if granting the request
     * would exceed `maxBytes` and no idle entries can be reclaimed.
     */
    acquire(sizeBytes: number, usage: BufferUsageFlags): BufferHandle;

    /** Return a handle to the pool. Throws on double-release or foreign handles. */
    release(handle: BufferHandle): void;

    /**
     * End the current frame. Releases any handles vended via `frameLease()`, then runs the
     * idle-batch sweep (destroying batches that have been fully-free for >= `idleFrameLimit`
     * frames). Advances the current frame counter after everything else is completed.
     */
    endFrame(): void;

    /**
     * Like `acquire`, but the returned handle is registered for automatic release at the next
     * `endFrame()`. Useful for compute scratch buffers and other within-frame transients.
     */
    frameLease(sizeBytes: number, usage: BufferUsageFlags): BufferHandle;

    /** Snapshot of current memory usage and per-pool breakdown. Cheap; suitable for HUDs. */
    stats(): Stats;

    /**
     * Destroy every buffer the manager owns (leased and free) and drop internal references.
     * Behavior of any outstanding handle after `dispose()` is undefined; callers should ensure
     * no handles are in use first.
     */
    dispose(): void;
}

/**
 * Base abstract class for all buffer managers. Provides common functionality and enforces the
 * `BufferManager` interface.
 */
export abstract class BufferManagerBase<Stats extends BufferManagerStats = BufferManagerStats>
    implements BufferManager<Stats>
{
    protected device: GPUDevice;
    protected maxBytes: number;
    protected idleFrameLimit: number;
    protected telemetry: NonNullable<BufferManagerConfig['telemetry']>;

    constructor(config: BufferManagerConfig) {
        if (!(config.maxBytes > 0)) {
            throw new Error('BufferManagerBase: maxBytes must be > 0.');
        }
        if (!(config.idleFrameLimit >= 0) || !Number.isInteger(config.idleFrameLimit)) {
            throw new Error(
                'BufferManagerBase: idleFrameLimit must be a non-negative integer.'
            );
        }
        this.device = config.device;
        this.maxBytes = config.maxBytes;
        this.idleFrameLimit = config.idleFrameLimit;
        this.telemetry = config.telemetry ?? {};
    }

    abstract acquire(sizeBytes: number, usage: BufferUsageFlags): BufferHandle;
    abstract release(handle: BufferHandle): void;
    abstract endFrame(): void;
    abstract frameLease(sizeBytes: number, usage: BufferUsageFlags): BufferHandle;
    abstract stats(): Stats;
    abstract dispose(): void;
}
