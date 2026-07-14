import { describe, expect, it, vi } from 'vitest';
import type { BufferManager, BufferManagerStats } from './memory/types';
import { renderingContext } from './context';
import { isResource } from './data/resource';
import { samplerSlot, uniformSlot } from './binding';
import { bindings, group } from './pipelines/binding-graph';
import { member, shader, struct } from './shaders';
import { makeMockDevice, makeRecordingBufferManager } from './test/mock-device';

// ----- helpers ------------------------------------------------------------

const cameraStruct = struct('Camera', [
    member('view', 'mat4x4f'),
    member('proj', 'mat4x4f'),
]);

function fixture() {
    const cam = uniformSlot('camera', cameraStruct);
    const root = group(cam);
    const sh = shader([cameraStruct, cam]);
    const graph = bindings(root, sh);
    return { cam, root, sh, graph };
}

const colorState = () => ({
    primitive: { topology: 'triangle-list' as const },
    fragment: { targets: [{ format: 'bgra8unorm' as const }] },
});

/** Minimal `BufferManager` stand-in. Only the methods exercised by these tests are real. */
function makeMockBufferManager(): BufferManager {
    const stub = (): never => {
        throw new Error('mock BufferManager: method not implemented for these tests');
    };
    return {
        acquire: vi.fn(stub) as unknown as BufferManager['acquire'],
        acquireForSlot: vi.fn(stub) as unknown as BufferManager['acquireForSlot'],
        precheck: vi.fn(() => true),
        release: vi.fn(stub) as unknown as BufferManager['release'],
        endFrame: vi.fn(),
        frameLease: vi.fn(stub) as unknown as BufferManager['frameLease'],
        stats: vi.fn(
            (): BufferManagerStats => ({
                residentBytes: 0,
                leasedBytes: 0,
                freeBytes: 0,
            })
        ),
        dispose: vi.fn(),
    };
}

// ----- tests --------------------------------------------------------------

describe('RenderingContext — construction', () => {
    it('stores device, label, and bufferManager when supplied', () => {
        const m = makeMockDevice();
        const bm = makeMockBufferManager();
        const ctx = renderingContext({ device: m.device, label: 'ctxA', bufferManager: bm });
        expect(ctx.device).toBe(m.device);
        expect(ctx.label).toBe('ctxA');
        expect(ctx.bufferManager).toBe(bm);
    });

    it('omits label and bufferManager when absent', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        expect(ctx.label).toBeUndefined();
        expect(ctx.bufferManager).toBeUndefined();
    });

    it('starts with disposed=false and pipelineCount=0', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        expect(ctx.disposed).toBe(false);
        expect(ctx.pipelineCount).toBe(0);
    });
});

describe('RenderingContext — lifecycle', () => {
    it('dispose() flips disposed and clears the pipeline cache', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, label: 'ctxL' });
        const { sh, graph } = fixture();
        ctx.pipeline(graph, sh, colorState());
        expect(ctx.pipelineCount).toBe(1);
        ctx.dispose();
        expect(ctx.disposed).toBe(true);
        expect(ctx.pipelineCount).toBe(0);
    });

    it('dispose() is idempotent (second call is a no-op)', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        ctx.dispose();
        expect(() => ctx.dispose()).not.toThrow();
        expect(ctx.disposed).toBe(true);
    });

    it('pipeline() after dispose() throws including the context label', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, label: 'frame-ctx' });
        const { sh, graph } = fixture();
        ctx.dispose();
        expect(() => ctx.pipeline(graph, sh, colorState())).toThrow(/frame-ctx/);
        expect(() => ctx.pipeline(graph, sh, colorState())).toThrow(/use-after-dispose/);
    });

    it('disposePipelineCache() clears entries but does NOT mark the context disposed', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const { sh, graph } = fixture();
        ctx.pipeline(graph, sh, colorState());
        expect(ctx.pipelineCount).toBe(1);
        ctx.disposePipelineCache();
        expect(ctx.pipelineCount).toBe(0);
        expect(ctx.disposed).toBe(false);
        // Should be usable again without throwing.
        ctx.pipeline(graph, sh, colorState());
        expect(ctx.pipelineCount).toBe(1);
    });
});

describe('RenderingContext — telemetry', () => {
    it('stats() returns {pipelines: N, bindGroups: 0} matching pipelineCount', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        expect(ctx.stats()).toEqual({ pipelines: 0, bindGroups: 0 });

        const { sh, graph } = fixture();
        ctx.pipeline(graph, sh, colorState());
        expect(ctx.stats()).toEqual({ pipelines: 1, bindGroups: 0 });
        expect(ctx.stats().pipelines).toBe(ctx.pipelineCount);
    });
});

describe('RenderingContext — isolation', () => {
    it('two contexts against the same device have independent caches', () => {
        const m = makeMockDevice();
        const ctx1 = renderingContext({ device: m.device, label: 'ctx1' });
        const ctx2 = renderingContext({ device: m.device, label: 'ctx2' });
        const { sh, graph } = fixture();
        const state = colorState();

        const a = ctx1.pipeline(graph, sh, state);
        const b = ctx2.pipeline(graph, sh, state);

        expect(a).not.toBe(b);
        // Content-addressable fingerprint is per-content, not per-context — so it matches.
        expect(a.fingerprint).toBe(b.fingerprint);
        // But each context built its own GPU pipeline.
        expect(m.calls.createRenderPipeline).toHaveBeenCalledTimes(2);
        expect(ctx1.pipelineCount).toBe(1);
        expect(ctx2.pipelineCount).toBe(1);
    });
});

describe('RenderingContext — BufferManager ownership contract', () => {
    it('dispose() does NOT call bufferManager.dispose()', () => {
        const m = makeMockDevice();
        const bm = makeMockBufferManager();
        const ctx = renderingContext({ device: m.device, bufferManager: bm });
        ctx.dispose();
        expect(bm.dispose).not.toHaveBeenCalled();
    });
});

// ---------------------------------------------------------------------------
// ctx.resource() + stats() memory fields
// ---------------------------------------------------------------------------

/**
 * Recording `BufferManager` that issues real-looking handles backed by the mock device's
 * `createBuffer`. Used to verify `ctx.resource()` wiring without dragging the full BatchPool
 * implementation into the context tests.
 */
function makeRecordingBM(device: GPUDevice, residentBytes = 1024, leasedBytes = 512): BufferManager {
    return makeRecordingBufferManager(device, {
        stats: { residentBytes, leasedBytes, freeBytes: residentBytes - leasedBytes },
    }).bm;
}

describe('RenderingContext.resource() — buffer-backed slots', () => {
    it('constructs a BufferResource for a uniform slot', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });
        const { cam } = fixture();
        const r = ctx.resource(cam);
        expect(isResource(r)).toBe(true);
        expect(r.kind).toBe('uniform');
        expect(r.slot).toBe(cam);
        expect(bm.acquireForSlot).toHaveBeenCalledTimes(1);
    });

    it('throws when called without a bufferManager (clear, labeled error)', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, label: 'ctxNoMem' });
        const { cam } = fixture();
        expect(() => ctx.resource(cam)).toThrow(/ctxNoMem/);
        expect(() => ctx.resource(cam)).toThrow(/bufferManager/);
    });

    it('throws when called after dispose()', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });
        const { cam } = fixture();
        ctx.dispose();
        expect(() => ctx.resource(cam)).toThrow(/use-after-dispose/);
    });
});

describe('RenderingContext.resource() — sampler slots', () => {
    it('constructs a SamplerResource without a bufferManager', () => {
        const m = makeMockDevice();
        // device.createSampler is missing on the mock; supply a pre-built sampler instead.
        const ctx = renderingContext({ device: m.device });
        const slot = samplerSlot('samp', 'sampler');
        const sampler = {} as unknown as GPUSampler;
        const r = ctx.resource(slot, sampler);
        expect(r.kind).toBe('sampler');
        expect(r.slot).toBe(slot);
    });
});

describe('RenderingContext.stats() — memory fields', () => {
    it('omits bytes/leasedBytes when no bufferManager is attached', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const s = ctx.stats();
        expect(s.bytes).toBeUndefined();
        expect(s.leasedBytes).toBeUndefined();
        expect(s.pipelines).toBe(0);
    });

    it('includes bytes/leasedBytes when a bufferManager is attached (read-through)', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device, 4096, 1024);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });
        const s = ctx.stats();
        expect(s.bytes).toBe(4096);
        expect(s.leasedBytes).toBe(1024);
        expect(s.pipelines).toBe(0);
        expect(bm.stats).toHaveBeenCalled();
    });
});
