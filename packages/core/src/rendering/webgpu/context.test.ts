import { describe, expect, it, vi } from 'vitest';
import type { BufferHandle, BufferManager, BufferManagerStats } from './memory/types';
import { renderingContext } from './context';
import { uniformSlot } from './resources';
import { bindings, group } from './pipelines/binding-graph';
import { member, shader, struct } from './shaders';
import { makeMockDevice } from './test/mock-device';

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
    } satisfies {
        acquire: (sizeBytes: number, usage: number) => BufferHandle;
        release: (handle: BufferHandle) => void;
        endFrame: () => void;
        frameLease: (sizeBytes: number, usage: number) => BufferHandle;
        stats: () => BufferManagerStats;
        dispose: () => void;
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
    it('stats() returns {pipelines: N} matching pipelineCount', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        expect(ctx.stats()).toEqual({ pipelines: 0 });

        const { sh, graph } = fixture();
        ctx.pipeline(graph, sh, colorState());
        expect(ctx.stats()).toEqual({ pipelines: 1 });
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
