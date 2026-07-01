import { describe, expect, it, vi } from 'vitest';
import type { BufferHandle, BufferManager, BufferManagerStats } from './memory/types';
import { renderingContext } from './context';
import {
    isResource,
    makeRawBufferResource,
    type RawBufferResource,
} from './data/resource';
import { isDrawable, type DrawableSpec } from './drawable';
import { bindings, group } from './pipelines/binding-graph';
import { samplerSlot, uniformSlot } from './resources';
import { member, shader, struct } from './shaders';
import { makeMockDevice } from './test/mock-device';

// ----- shared fixtures -----------------------------------------------------

type Camera = {
    view: readonly number[];
    proj: readonly number[];
};

const cameraStruct = struct<Camera>('Camera', [
    member('view', 'mat4x4f'),
    member('proj', 'mat4x4f'),
]);

function pipelineFixture() {
    const cam = uniformSlot('camera', cameraStruct);
    const samp = samplerSlot('linear', 'sampler');
    const root = group(cam, samp);
    const sh = shader([cameraStruct, cam, samp]);
    const graph = bindings(root, sh);
    return { cam, samp, root, sh, graph };
}

const colorState = () => ({
    primitive: { topology: 'triangle-list' as const },
    fragment: { targets: [{ format: 'bgra8unorm' as const }] },
});

/** Minimal recording `BufferManager`. Issues real-shape handles backed by the mock device,
 *  records every acquired / released handle, and runs every `acquire` through `device.createBuffer`
 *  so the mock-device call recorder sees the activity. */
function makeRecordingBM(device: GPUDevice, slabOffset = 0): {
    bm: BufferManager;
    acquired: Array<{ sizeBytes: number; usage: GPUBufferUsageFlags; handle: BufferHandle }>;
    released: BufferHandle[];
} {
    const acquired: Array<{
        sizeBytes: number;
        usage: GPUBufferUsageFlags;
        handle: BufferHandle;
    }> = [];
    const released: BufferHandle[] = [];

    const make = (sizeBytes: number, usage: GPUBufferUsageFlags): BufferHandle => {
        const gpu = device.createBuffer({ size: sizeBytes + slabOffset, usage });
        const handle: BufferHandle = {
            gpu,
            buffer: gpu,
            offset: slabOffset,
            size: sizeBytes,
            sizeBytes,
            bucketSize: sizeBytes,
            usage,
            release(): void {
                released.push(handle);
            },
            sizeInBytes(): number {
                return sizeBytes;
            },
            destroy(): void {
                released.push(handle);
            },
        };
        acquired.push({ sizeBytes, usage, handle });
        return handle;
    };

    const bm: BufferManager = {
        acquire: vi.fn(make),
        acquireForSlot: vi.fn(
            (_slot: unknown, sizeBytes: number, usage: GPUBufferUsageFlags) =>
                make(sizeBytes, usage)
        ),
        precheck: vi.fn(() => true),
        release: vi.fn((h: BufferHandle) => released.push(h)),
        endFrame: vi.fn(),
        frameLease: vi.fn(() => {
            throw new Error('frameLease: not supported in this mock');
        }) as unknown as BufferManager['frameLease'],
        stats: vi.fn(
            (): BufferManagerStats => ({ residentBytes: 0, leasedBytes: 0, freeBytes: 0 })
        ),
        dispose: vi.fn(),
    };
    return { bm, acquired, released };
}

// =============================================================================================
// ctx.drawable() — construction (raw-arrays vertex path)
// =============================================================================================

describe('ctx.drawable() — raw-arrays vertex / index path', () => {
    it('allocates vertex + index buffers through the bufferManager and uploads via writeBuffer', () => {
        const m = makeMockDevice();
        const { bm, acquired } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());

        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        const positions = new Float32Array([0, 0, 1, 0, 0, 1]); // 3 vec2f vertices
        const indices = new Uint16Array([0, 1, 2]);

        const spec: DrawableSpec = {
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: positions } },
            index: { kind: 'arrays', data: indices },
            bindings: { camera: camRes, linear: sampRes },
            draw: { kind: 'indexed', indexCount: 3 },
            label: 'tri',
        };

        const drawable = ctx.drawable(spec);

        expect(isDrawable(drawable)).toBe(true);
        expect(drawable.pipeline).toBe(pipeline);
        expect(drawable.draw).toEqual({ kind: 'indexed', indexCount: 3 });
        expect(drawable.vertexBuffers.size).toBe(1);
        expect(drawable.indexBuffer).toBeDefined();
        expect(drawable.indexBuffer?.format).toBe('uint16');
        expect(drawable.bindings.size).toBe(2);

        // Buffer manager was asked for one VERTEX buffer + one INDEX buffer.
        expect(acquired.filter((a) => (a.usage & GPUBufferUsage.VERTEX) !== 0).length).toBe(1);
        expect(acquired.filter((a) => (a.usage & GPUBufferUsage.INDEX) !== 0).length).toBe(1);

        // queue.writeBuffer was called for both the vertex bytes and the index bytes.
        const writes = m.calls.writeBuffer.mock.calls;
        expect(writes.length).toBe(2);
    });

    it('threads `handle.offset` into queue.writeBuffer (slab-manager readiness)', () => {
        const m = makeMockDevice();
        const SLAB_OFFSET = 1024;
        const { bm } = makeRecordingBM(m.device, SLAB_OFFSET);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        const positions = new Float32Array([0, 0, 1, 0, 0, 1]);
        ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: positions } },
            bindings: { camera: camRes, linear: sampRes },
            draw: { kind: 'array', vertexCount: 3 },
        });

        // Every writeBuffer call records its `bufferOffset` — verify the slab offset was
        // threaded through (vertex buffer at offset 1024, not 0).
        const offsets = m.calls.writeBuffer.mock.calls.map((c) => c[1]);
        expect(offsets).toContain(SLAB_OFFSET);
    });

    it('throws when raw-arrays vertex input is supplied without a bufferManager', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, label: 'no-bm' });

        const { samp, graph, sh } = pipelineFixture();
        // Build a pipeline against the same ctx (works without bufferManager — pipeline build
        // doesn't allocate any buffers).
        const pipeline = ctx.pipeline(graph, sh, colorState());

        // We need *some* Resource objects for the bindings — fall back to a slot-less
        // RawBufferResource via a hand-rolled handle (no real BufferManager required).
        const camRes = {} as unknown as ReturnType<typeof ctx.resource>;
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        expect(() =>
            ctx.drawable({
                pipeline,
                vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0]) } },
                bindings: { camera: camRes, linear: sampRes },
                draw: { kind: 'array', vertexCount: 1 },
            })
        ).toThrow(/bufferManager/);
    });

    // Phase 8: precheck integration on the raw-arrays vertex path.
    it('throws when bufferManager.precheck refuses a vertex allocation', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBM(m.device);
        // Precheck returns true for the camera-uniform allocation (so `ctx.resource(cam)`
        // succeeds), then returns false for the vertex allocation.
        (bm.precheck as ReturnType<typeof vi.fn>)
            .mockReturnValueOnce(true)
            .mockReturnValueOnce(false);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });
        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);
        expect(() =>
            ctx.drawable({
                pipeline,
                vertex: {
                    kind: 'arrays',
                    arrays: { position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) },
                },
                bindings: { camera: camRes, linear: sampRes },
                draw: { kind: 'array', vertexCount: 3 },
            })
        ).toThrow(/precheck refused/);
    });
});

// =============================================================================================
// ctx.drawable() — binding validation
// =============================================================================================

describe('ctx.drawable() — binding validation', () => {
    it('throws when a required slot is missing from bindings', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);

        expect(() =>
            ctx.drawable({
                pipeline,
                vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
                // Missing `linear` (sampler) slot.
                bindings: { camera: camRes },
                draw: { kind: 'array', vertexCount: 1 },
            })
        ).toThrow(/missing binding for slot 'linear'/);
    });

    it('throws when a binding\'s kind does not match the slot kind', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        expect(() =>
            ctx.drawable({
                pipeline,
                vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
                // Swap sampler resource into the camera (uniform) slot — kind mismatch.
                bindings: { camera: sampRes, linear: sampRes.share() },
                draw: { kind: 'array', vertexCount: 1 },
            })
        ).toThrow(/binding kind mismatch/);
    });

    it('throws when an indexed draw call lacks an `index` input', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        expect(() =>
            ctx.drawable({
                pipeline,
                vertex: {
                    kind: 'arrays',
                    arrays: { position: new Float32Array([0, 0, 0, 1, 1, 1]) },
                },
                bindings: { camera: camRes, linear: sampRes },
                draw: { kind: 'indexed', indexCount: 3 },
            })
        ).toThrow(/indexed.*requires an `index` input/);
    });

    it('throws when ctx is disposed', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm, label: 'X' });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);
        ctx.dispose();

        expect(() =>
            ctx.drawable({
                pipeline,
                vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
                bindings: { camera: camRes, linear: sampRes },
                draw: { kind: 'array', vertexCount: 1 },
            })
        ).toThrow(/use-after-dispose/);
    });
});

// =============================================================================================
// ctx.drawable() — pre-built vertex / index path
// =============================================================================================

describe('ctx.drawable() — pre-built vertex / index path', () => {
    it('share()s pre-built BufferResources and does NOT allocate through bufferManager', () => {
        const m = makeMockDevice();
        const { bm, acquired } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        // Hand-roll a vertex buffer outside the drawable path so we can verify it's NOT
        // re-allocated when supplied pre-built.
        const vHandle = bm.acquire(64, GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST);
        const vRes: RawBufferResource = makeRawBufferResource(
            vHandle,
            GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        );
        const allocsBefore = acquired.length;
        expect(vRes.refcount).toBe(1);

        const preBuilt: ReadonlyMap<number, RawBufferResource> = new Map([[0, vRes]]);
        const drawable = ctx.drawable({
            pipeline,
            vertex: preBuilt,
            bindings: { camera: camRes, linear: sampRes },
            draw: { kind: 'array', vertexCount: 3 },
        });

        // No new vertex allocations through the BM.
        expect(acquired.length).toBe(allocsBefore);
        // The drawable shared vRes — refcount is now 2.
        expect(vRes.refcount).toBe(2);

        drawable.destroy();
        // Drawable.destroy() decrefs vRes back to 1; caller still owns it.
        expect(vRes.refcount).toBe(1);
        expect(vRes.disposed).toBe(false);
        vRes.destroy();
        expect(vRes.refcount).toBe(0);
        expect(vRes.disposed).toBe(true);
    });

    it('rejects a pre-built vertex resource without VERTEX usage', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        // Build a handle with only UNIFORM usage — wrong for vertex.
        const wrongHandle = bm.acquire(64, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        const wrongRes = makeRawBufferResource(
            wrongHandle,
            GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        );
        const preBuilt: ReadonlyMap<number, RawBufferResource> = new Map([[0, wrongRes]]);

        expect(() =>
            ctx.drawable({
                pipeline,
                vertex: preBuilt,
                bindings: { camera: camRes, linear: sampRes },
                draw: { kind: 'array', vertexCount: 1 },
            })
        ).toThrow(/GPUBufferUsage\.VERTEX/);
    });
});

// =============================================================================================
// Drawable.destroy() — refcount semantics
// =============================================================================================

describe('drawable.destroy()', () => {
    it('decrefs every owned resource exactly once (raw-arrays path releases handles to 0)', () => {
        const m = makeMockDevice();
        const { bm, acquired, released } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        const drawable = ctx.drawable({
            pipeline,
            vertex: {
                kind: 'arrays',
                arrays: { position: new Float32Array([0, 0, 1, 0, 0, 1]) },
            },
            index: { kind: 'arrays', data: new Uint16Array([0, 1, 2]) },
            bindings: { camera: camRes, linear: sampRes },
            draw: { kind: 'indexed', indexCount: 3 },
        });

        // Bindings were share()'d into the drawable — caller refcounts are 2.
        expect(camRes.refcount).toBe(2);

        const vertexAllocs = acquired.filter((a) => (a.usage & GPUBufferUsage.VERTEX) !== 0);
        const indexAllocs = acquired.filter((a) => (a.usage & GPUBufferUsage.INDEX) !== 0);
        expect(vertexAllocs.length).toBeGreaterThan(0);
        expect(indexAllocs.length).toBeGreaterThan(0);

        drawable.destroy();

        // Owned (raw-arrays) handles released; bindings decref'd back to caller's 1.
        for (const a of vertexAllocs) expect(released).toContain(a.handle);
        for (const a of indexAllocs) expect(released).toContain(a.handle);
        expect(camRes.refcount).toBe(1);
    });

    it('is idempotent (second destroy() call is a no-op)', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        const drawable = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
            bindings: { camera: camRes, linear: sampRes },
            draw: { kind: 'array', vertexCount: 1 },
        });

        drawable.destroy();
        expect(() => drawable.destroy()).not.toThrow();
        // camRes was already decref'd back to 1 on first destroy; second is no-op.
        expect(camRes.refcount).toBe(1);
    });
});

// =============================================================================================
// Drawable.reuse() — multi-pipeline pattern
// =============================================================================================

describe('drawable.reuse()', () => {
    it('share()s vertex / index buffers + bindings into a sibling drawable', () => {
        const m = makeMockDevice();
        const { bm, acquired } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const colorPipeline = ctx.pipeline(graph, sh, colorState());
        // Second pipeline against the same graph/shader but different state — produces a
        // distinct BuiltPipeline.
        const altState = {
            ...colorState(),
            primitive: { topology: 'line-list' as const },
        };
        const linePipeline = ctx.pipeline(graph, sh, altState);

        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        const first = ctx.drawable({
            pipeline: colorPipeline,
            vertex: {
                kind: 'arrays',
                arrays: { position: new Float32Array([0, 0, 1, 0, 0, 1]) },
            },
            bindings: { camera: camRes, linear: sampRes },
            draw: { kind: 'array', vertexCount: 3 },
        });

        const allocsAfterFirst = acquired.length;
        const camRefBefore = camRes.refcount;

        const second = first.reuse({ pipeline: linePipeline });

        // No new buffer allocations — vertex resource was share()'d.
        expect(acquired.length).toBe(allocsAfterFirst);
        // Caller's camRes refcount went up by one more (drawable + drawable).
        expect(camRes.refcount).toBe(camRefBefore + 1);
        expect(second.pipeline).toBe(linePipeline);
        // Both drawables reference the same vertex resource.
        const firstVRes = [...first.vertexBuffers.values()][0]?.resource;
        const secondVRes = [...second.vertexBuffers.values()][0]?.resource;
        expect(firstVRes).toBe(secondVRes);

        // Destroying one does not break the other.
        first.destroy();
        expect(secondVRes?.disposed).toBe(false);
        second.destroy();
    });

    it('allows binding overrides per slot, sharing the rest from the base drawable', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());

        const camA = ctx.resource(cam);
        const camB = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        const baseline = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
            bindings: { camera: camA, linear: sampRes },
            draw: { kind: 'array', vertexCount: 1 },
        });

        const variant = baseline.reuse({ bindings: { camera: camB } });

        // The sampler resource is shared from baseline; camB is a fresh share.
        expect(variant.bindings.get(samp)).toBe(sampRes);
        expect(variant.bindings.get(cam)).toBe(camB);
        expect(camA.refcount).toBe(2); // caller + baseline drawable
        expect(camB.refcount).toBe(2); // caller + variant drawable
        expect(sampRes.refcount).toBe(3); // caller + baseline + variant
    });
});

// =============================================================================================
// isDrawable + miscellaneous helpers
// =============================================================================================

describe('isDrawable', () => {
    it('returns true for a constructed drawable and false otherwise', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, samp, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const sampRes = ctx.resource(samp, {} as unknown as GPUSampler);

        const drawable = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
            bindings: { camera: camRes, linear: sampRes },
            draw: { kind: 'array', vertexCount: 1 },
        });

        expect(isDrawable(drawable)).toBe(true);
        expect(isDrawable({})).toBe(false);
        expect(isDrawable(null)).toBe(false);
        expect(isDrawable(undefined)).toBe(false);
        // A Resource is not a Drawable.
        expect(isDrawable(camRes)).toBe(false);
        expect(isResource(drawable)).toBe(false);
    });
});
