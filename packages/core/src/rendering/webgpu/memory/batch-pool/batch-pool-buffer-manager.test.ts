import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DisposedBufferError, InvalidHandleError, OutOfBudgetError } from '../errors';
import type {
    BufferHandle,
    BufferManager,
    BufferSlot,
    BufferUsageFlags,
} from '../types';
import { BatchPoolBufferManager } from './batch-pool-buffer-manager';
import { OutOfBucketError } from './errors';
import type { BatchPoolBufferManagerConfig } from './types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

type FakeBuffer = GPUBuffer & {
    readonly fakeSize: number;
    readonly fakeUsage: BufferUsageFlags;
    readonly destroyMock: ReturnType<typeof vi.fn>;
};

function makeFakeDevice(): GPUDevice & {
    createBufferMock: ReturnType<typeof vi.fn>;
    allCreated: FakeBuffer[];
} {
    const created: FakeBuffer[] = [];
    const createBufferMock = vi.fn((descriptor: GPUBufferDescriptor) => {
        const destroyMock = vi.fn();
        const buf = {
            size: descriptor.size,
            usage: descriptor.usage,
            label: descriptor.label ?? '',
            mapState: 'unmapped',
            fakeSize: descriptor.size,
            fakeUsage: descriptor.usage,
            destroyMock,
            destroy: destroyMock,
            getMappedRange: vi.fn(),
            mapAsync: vi.fn(),
            unmap: vi.fn(),
        } as unknown as FakeBuffer;
        created.push(buf);
        return buf;
    });
    // We only ever poke `createBuffer` — the rest of GPUDevice is irrelevant to the manager.
    const device = { createBuffer: createBufferMock } as unknown as GPUDevice;
    return Object.assign(device, { createBufferMock, allCreated: created });
}

const USAGE_A: BufferUsageFlags = 0x0040; // STORAGE
const USAGE_B: BufferUsageFlags = 0x0080; // INDEX (arbitrary distinct flag)

function baseConfig(
    device: GPUDevice,
    overrides: Partial<BatchPoolBufferManagerConfig> = {}
): BatchPoolBufferManagerConfig {
    return {
        device,
        maxBytes: 1 << 16,
        sizeBuckets: [256, 1024, 4096, 16_384],
        idleFrameLimit: 2,
        ...overrides,
    };
}

// ---------------------------------------------------------------------------
// BufferManager interface conformance — an in-test no-op implementation.
// (Validates the public interface is implementable without leaking implementation details.)
// ---------------------------------------------------------------------------

describe('BufferManager interface conformance', () => {
    it('is satisfied by a minimal in-test no-op implementation', () => {
        class NoopManager implements BufferManager {
            acquire(): BufferHandle {
                throw new Error('noop');
            }
            acquireForSlot(): BufferHandle {
                throw new Error('noop');
            }
            precheck(): boolean {
                return true;
            }
            release(): void {}
            beginFrame(): void {}
            endFrame(): void {}
            frameLease(): BufferHandle {
                throw new Error('noop');
            }
            stats() {
                return {
                    residentBytes: 0,
                    leasedBytes: 0,
                    freeBytes: 0,
                    poolCount: 0,
                    perPool: [],
                };
            }
            dispose(): void {}
        }
        // If this compiles, the structural contract is satisfied.
        const a: BufferManager = new NoopManager();
        expect(a.stats().residentBytes).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// BufferManager behavior tests (BatchPoolBufferManager)
// ---------------------------------------------------------------------------

describe('BatchPoolBufferManager — basic acquire/release', () => {
    let device: ReturnType<typeof makeFakeDevice>;
    let manager: BatchPoolBufferManager;

    beforeEach(() => {
        device = makeFakeDevice();
        manager = new BatchPoolBufferManager({ ...baseConfig(device), growthBatchSize: 2 });
    });

    // (1) acquire-after-release returns the same buffer (single-buffer batch isolates the
    // FIFO-of-one case; with growthBatchSize > 1 the freed buffer goes to the tail and the
    // next acquire takes a different free buffer first — see the next test for that case).
    it('returns the same buffer when re-acquired after release (single-buffer batch)', () => {
        const single = new BatchPoolBufferManager({ ...baseConfig(device), growthBatchSize: 1 });
        const h1 = single.acquire(200, USAGE_A);
        const buf1 = h1.gpu;
        h1.release(); // note: importantly, this does NOT invalidate h1.gpu, which is still held in buf1!
        const h2 = single.acquire(200, USAGE_A);
        expect(h2.gpu).toBe(buf1);
    });

    it('reuses buffers in FIFO order within a multi-buffer batch', () => {
        // Batch of 2: free=[b0,b1]. acquire→b0 leased, free=[b1]. release(h1)→free=[b1,b0].
        // Next acquire returns b1 (head), not b0.
        const h1 = manager.acquire(200, USAGE_A);
        const b0 = h1.gpu;
        h1.release();
        const h2 = manager.acquire(200, USAGE_A);
        expect(h2.gpu).not.toBe(b0);
        h2.release();
        const h3 = manager.acquire(200, USAGE_A);
        expect(h3.gpu).toBe(b0);
    });

    it('rounds the requested size up to the smallest matching bucket', () => {
        const h = manager.acquire(200, USAGE_A);
        expect(h.bucketSize).toBe(256);
        expect(h.sizeBytes).toBe(200);
        expect(h.sizeInBytes()).toBe(256);
    });

    it('routes requests to disjoint pools by (bucketSize, usage)', () => {
        const a = manager.acquire(200, USAGE_A);
        const b = manager.acquire(200, USAGE_B);
        const c = manager.acquire(1000, USAGE_A);
        expect(a.gpu).not.toBe(b.gpu);
        expect(a.gpu).not.toBe(c.gpu);
        expect(b.gpu).not.toBe(c.gpu);
        expect(manager.stats().poolCount).toBe(3);
    });
});

// ---------------------------------------------------------------------------
// Miss under budget allocates `growthBatchSize` buffers
// ---------------------------------------------------------------------------

describe('BatchPoolBufferManager — batch allocation on miss', () => {
    it('allocates `growthBatchSize` buffers on the first acquire of a new pool', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 4,
        });
        manager.acquire(200, USAGE_A);
        expect(device.createBufferMock).toHaveBeenCalledTimes(4);
        // 3 free, 1 leased.
        const s = manager.stats();
        expect(s.leasedBytes).toBe(256);
        expect(s.freeBytes).toBe(256 * 3);
        expect(s.residentBytes).toBe(256 * 4);
    });

    it('does not allocate on subsequent acquires while free entries exist', () => {
        const device = makeFakeDevice();
        const batchSize = 4;
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: batchSize,
        });
        const h1 = manager.acquire(200, USAGE_A);
        expect(device.createBufferMock).toHaveBeenCalledTimes(batchSize);
        manager.acquire(200, USAGE_A);
        manager.acquire(200, USAGE_A);
        manager.acquire(200, USAGE_A);
        // We have exactly 4 in the batch and we just took the 4th. No new allocations yet.
        expect(device.createBufferMock).toHaveBeenCalledTimes(batchSize);
        // 5th acquire triggers a new batch.
        manager.acquire(200, USAGE_A);
        expect(device.createBufferMock).toHaveBeenCalledTimes(batchSize + batchSize);
        h1.release();
    });

    it('fires telemetry hooks (onMiss, onAllocate) when a new batch is allocated', () => {
        const device = makeFakeDevice();
        const onMiss = vi.fn();
        const onAllocate = vi.fn();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 2,
            telemetry: { onMiss, onAllocate },
        });
        manager.acquire(200, USAGE_A);
        expect(onMiss).toHaveBeenCalledWith({
            sizeBytes: 200,
            bucketSize: 256,
            usage: USAGE_A,
        });
        expect(onAllocate).toHaveBeenCalledWith({
            bucketSize: 256,
            usage: USAGE_A,
            batchSize: 2,
        });
    });
});

// ---------------------------------------------------------------------------
// - Miss over budget triggers eviction; retries; throws if still over.
// - Leased batch never destroyed.
// ---------------------------------------------------------------------------

describe('BatchPoolBufferManager — budget enforcement and eviction', () => {
    it('evicts idle batches to make room for a new allocation', () => {
        // Two pools: USAGE_A bucket 256, USAGE_B bucket 256. Budget = 2 batches' worth.
        const device = makeFakeDevice();
        const onEvict = vi.fn();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device, { maxBytes: 256 * 2 }),
            growthBatchSize: 1,
            telemetry: { onEvict },
        });
        // Allocate and immediately release the USAGE_A buffer, then advance idle-frame state.
        const a = manager.acquire(200, USAGE_A);
        a.release();
        // The batch is now fully-free but resident. Allocating USAGE_B fits (1+1 = 2).
        const b = manager.acquire(200, USAGE_B);
        expect(manager.stats().residentBytes).toBe(256 * 2);
        // Third acquire forces eviction: USAGE_A's idle batch is the only victim.
        manager.acquire(200, USAGE_B); // Same pool as `b`; growthBatchSize=1 → new batch needed.
        // The very first buffer should now be destroyed.
        expect(a.gpu.destroy).toHaveBeenCalledTimes(1);
        expect(onEvict).toHaveBeenCalledWith({
            bucketSize: 256,
            usage: USAGE_A,
            batchSize: 1,
        });
        expect(manager.stats().residentBytes).toBe(256 * 2);
        // Release b so dispose later doesn't trip; not strictly required.
        b.release();
    });

    it('never destroys a leased batch during eviction; throws OutOfBudgetError instead', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device, { maxBytes: 256 * 2 }),
            growthBatchSize: 1,
        });
        // Two leased buffers consume the full budget.
        const a = manager.acquire(200, USAGE_A);
        const b = manager.acquire(200, USAGE_B);
        // Third request cannot evict (both batches are leased) — must throw.
        expect(() => manager.acquire(200, USAGE_A)).toThrow(OutOfBudgetError);
        // Neither buffer was destroyed.
        expect(a.gpu.destroy).not.toHaveBeenCalled();
        expect(b.gpu.destroy).not.toHaveBeenCalled();
    });

    it('throws OutOfBucketError when sizeBytes exceeds the largest bucket', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager(baseConfig(device));
        expect(() => manager.acquire(20_000, USAGE_A)).toThrow(OutOfBucketError);
    });
});

// ---------------------------------------------------------------------------
// idleFrameLimit + 1 endFrames after last release → destroy.
// ---------------------------------------------------------------------------

describe('BatchPoolBufferManager — idle-batch sweep at endFrame', () => {
    it('destroys a batch that has been fully-free for idleFrameLimit frames', () => {
        const device = makeFakeDevice();
        const onEvict = vi.fn();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device, { idleFrameLimit: 2 }),
            growthBatchSize: 1,
            telemetry: { onEvict },
        });
        // Frame 0: acquire + release. Batch becomes fully-free at frame 0.
        const h = manager.acquire(200, USAGE_A);
        h.release();
        // endFrame at frame 0: age = 0 - 0 = 0 < 2 → keep.
        manager.endFrame();
        expect(h.gpu.destroy).not.toHaveBeenCalled();
        // Frame 1: endFrame: age = 1 < 2 → keep.
        manager.endFrame();
        expect(h.gpu.destroy).not.toHaveBeenCalled();
        // Frame 2: endFrame: age = 2 >= 2 → destroy.
        manager.endFrame();
        expect(h.gpu.destroy).toHaveBeenCalledTimes(1);
        expect(onEvict).toHaveBeenCalledTimes(1);
        expect(manager.stats().residentBytes).toBe(0);
    });

    it('keeps a batch alive if any of its buffers are re-acquired before the idle window expires', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device, { idleFrameLimit: 1 }),
            growthBatchSize: 1,
        });
        const h = manager.acquire(200, USAGE_A);
        h.release();
        manager.endFrame();
        // Re-acquire before endFrame; batch is now leased → not fully-free.
        const h2 = manager.acquire(200, USAGE_A);
        expect(h2.gpu).toBe(h.gpu);
        manager.endFrame();
        expect(h2.gpu.destroy).not.toHaveBeenCalled();
        h2.release();
    });
});

// ---------------------------------------------------------------------------
// frameLease handles released exactly once at next endFrame.
// ---------------------------------------------------------------------------

describe('BatchPoolBufferManager — frameLease', () => {
    it('releases frame-leased handles exactly once at the next endFrame', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 1,
        });
        const h = manager.frameLease(200, USAGE_A);
        expect(manager.stats().leasedBytes).toBe(256);
        manager.endFrame();
        expect(manager.stats().leasedBytes).toBe(0);
        expect(manager.stats().freeBytes).toBe(256);
        // The handle is no longer valid; a second release must throw.
        expect(() => h.release()).toThrow(InvalidHandleError);
    });
});

// ---------------------------------------------------------------------------
// Double-release throws; foreign-handle release throws.
// ---------------------------------------------------------------------------

describe('BatchPoolBufferManager — handle validation', () => {
    it('throws on double-release', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 1,
        });
        const h = manager.acquire(200, USAGE_A);
        h.release();
        expect(() => h.release()).toThrow(InvalidHandleError);
    });

    it('throws on a foreign handle (minted by another manager)', () => {
        const deviceA = makeFakeDevice();
        const deviceB = makeFakeDevice();
        const a = new BatchPoolBufferManager({ ...baseConfig(deviceA), growthBatchSize: 1 });
        const b = new BatchPoolBufferManager({ ...baseConfig(deviceB), growthBatchSize: 1 });
        const fromB = b.acquire(200, USAGE_A);
        expect(() => a.release(fromB)).toThrow(InvalidHandleError);
        fromB.release();
    });

    it('throws on a fabricated/foreign object', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 1,
        });
        const fakeBuffer = {} as GPUBuffer;
        const fake: BufferHandle = {
            gpu: fakeBuffer,
            offset: 0,
            size: 256,
            sizeBytes: 100,
            bucketSize: 256,
            usage: USAGE_A,
            release() {},
            sizeInBytes() {
                return 256;
            },
            destroy() {},
        };
        expect(() => manager.release(fake)).toThrow(InvalidHandleError);
    });
});

// ---------------------------------------------------------------------------
// dispose() destroys all and zeros stats.
// ---------------------------------------------------------------------------

describe('BatchPoolBufferManager — dispose', () => {
    it('destroys every owned buffer and zeros the stats', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 2,
        });
        manager.acquire(200, USAGE_A);
        manager.acquire(1000, USAGE_B);
        const totalCreated = device.allCreated.length;
        manager.dispose();
        for (const buf of device.allCreated) {
            expect(buf.destroyMock).toHaveBeenCalledTimes(1);
        }
        expect(totalCreated).toBeGreaterThan(0);
        const s = manager.stats();
        expect(s.residentBytes).toBe(0);
        expect(s.poolCount).toBe(0);
    });

    it('rejects further use after dispose', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 1,
        });
        manager.dispose();
        expect(() => manager.acquire(200, USAGE_A)).toThrow(DisposedBufferError);
        expect(() => manager.endFrame()).toThrow(DisposedBufferError);
    });

    it('is idempotent', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 1,
        });
        manager.acquire(200, USAGE_A);
        manager.dispose();
        expect(() => manager.dispose()).not.toThrow();
    });
});

// ---------------------------------------------------------------------------
// Cacheable interop — BufferHandle implements Cacheable.
// ---------------------------------------------------------------------------

describe('BatchPoolBufferManager — Cacheable interop on handles', () => {
    it('sizeInBytes returns the bucketSize and destroy() releases the handle', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 1,
        });
        const h = manager.acquire(200, USAGE_A);
        expect(h.sizeInBytes()).toBe(256);
        h.destroy();
        // After release, the entry is back on the free deque.
        expect(manager.stats().leasedBytes).toBe(0);
        expect(manager.stats().freeBytes).toBe(256);
    });
});

// ---------------------------------------------------------------------------
// Extensions: slab-ready handle shape, acquireForSlot, precheck.
// ---------------------------------------------------------------------------

describe('BatchPoolBufferManager — BufferHandle slab-ready fields', () => {
    it('emits gpu/offset/size on every handle; offset is 0 and size == bucketSize for BatchPool', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 1,
        });
        const h = manager.acquire(200, USAGE_A);
        expect(h.offset).toBe(0);
        expect(h.size).toBe(256); // === bucketSize for BatchPool
        expect(h.bucketSize).toBe(256);
        expect(h.sizeBytes).toBe(200);
    });
});

describe('BatchPoolBufferManager.acquireForSlot', () => {
    let device: ReturnType<typeof makeFakeDevice>;
    let manager: BatchPoolBufferManager;

    beforeEach(() => {
        device = makeFakeDevice();
        manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            growthBatchSize: 1,
        });
    });

    it('forwards to acquire when the usage flag-set includes the required bits', () => {
        const cam: BufferSlot = { name: 'cam', kind: 'uniform' };
        const h = manager.acquireForSlot(
            cam,
            64,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        expect(h.bucketSize).toBe(256);
        expect(h.usage).toBe(GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
    });

    it('rejects a uniform slot whose requested usage is missing COPY_DST', () => {
        const cam: BufferSlot = { name: 'cam', kind: 'uniform' };
        expect(() => manager.acquireForSlot(cam, 64, GPUBufferUsage.UNIFORM)).toThrow(
            /requires usage bits/
        );
    });

    it('rejects a uniform slot whose requested usage is missing UNIFORM', () => {
        const cam: BufferSlot = { name: 'cam', kind: 'uniform' };
        expect(() =>
            manager.acquireForSlot(cam, 64, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST)
        ).toThrow(/UNIFORM/i);
    });

    it('accepts a storage slot with STORAGE | COPY_DST', () => {
        const buf: BufferSlot = { name: 'buf', kind: 'storage' };
        const h = manager.acquireForSlot(
            buf,
            4,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST
        );
        expect(h.usage).toBe(GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
    });

    it('throws on non-buffer-backed slot kinds', () => {
        const s: BufferSlot = { name: 's', kind: 'sampler' };
        expect(() => manager.acquireForSlot(s, 64, 0)).toThrow(/not buffer-backed/);
    });
});

describe('BatchPoolBufferManager.precheck', () => {
    it('returns true when there is plenty of budget headroom', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            maxBytes: 4096,
            growthBatchSize: 1,
        });
        expect(manager.precheck(256)).toBe(true);
    });

    it('returns false when adding the cost exceeds maxBytes (no evictable batches)', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            maxBytes: 256,
            growthBatchSize: 1,
        });
        manager.acquire(200, USAGE_A); // resident 256, 0 evictable
        expect(manager.precheck(1)).toBe(false);
    });

    it('returns true when the cost fits only after counting evictable batches', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            maxBytes: 512,
            growthBatchSize: 1,
        });
        const h = manager.acquire(200, USAGE_A); // resident 256, 0 evictable
        h.release(); // resident 256, 256 evictable
        // Adding 256 fits because the existing 256 is evictable: 256 - 256 + 256 = 256 <= 512.
        expect(manager.precheck(256)).toBe(true);
        // Adding 257 still fits (256 - 256 + 257 = 257 <= 512).
        expect(manager.precheck(257)).toBe(true);
        // Adding 513 does not fit (256 - 256 + 513 = 513 > 512).
        expect(manager.precheck(513)).toBe(false);
    });

    it('returns false for negative or NaN costs', () => {
        const device = makeFakeDevice();
        const manager = new BatchPoolBufferManager({
            ...baseConfig(device),
            maxBytes: 4096,
        });
        expect(manager.precheck(-1)).toBe(false);
        expect(manager.precheck(Number.NaN)).toBe(false);
    });
});
