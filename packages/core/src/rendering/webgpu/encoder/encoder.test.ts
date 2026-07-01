/**
 * Phase 7 — `GraphEncoder` integration tests.
 *
 * Uses the recording mock-device to assert exact pass-command sequences. Verifies:
 *   (a) WebGPU ordering (setPipeline → setBindGroup* → setVertexBuffer* → setIndexBuffer? → draw)
 *   (b) no redundant `setPipeline` between consecutive same-pipeline draws
 *   (c) `setBindGroup(N, X)` not re-emitted when X is already bound for slot N
 *   (e) state-node subtree restores prior viewport on exit
 *   (g) `BufferHandle.offset` is threaded through every `setVertexBuffer` / `setIndexBuffer` /
 *       bind-group entry
 */

import { describe, expect, it, vi } from 'vitest';
import { renderingContext } from '../context';
import { container, draw, scene, viewport } from '../scene/scene';
import type { RenderTarget } from '../scene/types';
import { bindings, group } from '../pipelines/binding-graph';
import { uniformSlot } from '../resources';
import { member, shader, struct } from '../shaders';
import {
    makeMockDevice,
    type MockDevice,
    type MockGpuBindGroup,
    type PassCommand,
} from '../test/mock-device';
import type {
    BufferHandle,
    BufferManager,
    BufferManagerStats,
} from '../memory/types';

// ---- fixtures ---------------------------------------------------------------------------------

type CameraShape = { view: readonly number[]; proj: readonly number[] };
const cameraStruct = struct<CameraShape>('Camera', [
    member('view', 'mat4x4f'),
    member('proj', 'mat4x4f'),
]);

function pipelineFixture() {
    const cam = uniformSlot('camera', cameraStruct);
    const root = group(cam);
    const sh = shader([cameraStruct, cam]);
    const graph = bindings(root, sh);
    return { cam, graph, sh };
}

const colorState = () => ({
    primitive: { topology: 'triangle-list' as const },
    fragment: { targets: [{ format: 'bgra8unorm' as const }] },
});

const TARGET: RenderTarget = {
    color: [
        {
            view: {} as unknown as GPUTextureView,
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 1 },
        },
    ],
};

function makeRecordingBM(device: GPUDevice, slabOffset = 0): BufferManager {
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
            release: vi.fn(),
            sizeInBytes: () => sizeBytes,
            destroy: vi.fn(),
        };
        return handle;
    };
    return {
        acquire: vi.fn(make),
        acquireForSlot: vi.fn(
            (_slot: unknown, sizeBytes: number, usage: GPUBufferUsageFlags) =>
                make(sizeBytes, usage)
        ),
        precheck: vi.fn(() => true),
        release: vi.fn(),
        endFrame: vi.fn(),
        frameLease: vi.fn(() => {
            throw new Error('frameLease not supported');
        }) as unknown as BufferManager['frameLease'],
        stats: vi.fn(
            (): BufferManagerStats => ({ residentBytes: 0, leasedBytes: 0, freeBytes: 0 })
        ),
        dispose: vi.fn(),
    };
}

function passCmds(m: MockDevice, kind: PassCommand['kind']): PassCommand[] {
    return m.passCommands.filter((c) => c.kind === kind);
}

// ---- tests ------------------------------------------------------------------------------------

describe('GraphEncoder — basic encoding', () => {
    it('emits commands in WebGPU-mandated order for a single drawable', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);

        const drawable = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) } },
            bindings: { camera: camRes },
            draw: { kind: 'array', vertexCount: 3 },
        });

        const s = scene({ target: TARGET, root: container([draw(drawable)]) });
        ctx.submit(s);

        const kinds = m.passCommands.map((c) => c.kind);
        // The first command after beginRenderPass should be setPipeline; followed by at least
        // one setBindGroup, then setVertexBuffer, then draw.
        const begin = kinds.indexOf('beginRenderPass');
        const sp = kinds.indexOf('setPipeline');
        const sbg = kinds.indexOf('setBindGroup');
        const svb = kinds.indexOf('setVertexBuffer');
        const dr = kinds.indexOf('draw');
        const end = kinds.indexOf('endRenderPass');

        expect(begin).toBeGreaterThanOrEqual(0);
        expect(sp).toBeGreaterThan(begin);
        expect(sbg).toBeGreaterThan(sp);
        expect(svb).toBeGreaterThan(sbg);
        expect(dr).toBeGreaterThan(svb);
        expect(end).toBeGreaterThan(dr);

        // Stats should match the emitted commands.
        const stats = ctx.encoder().lastStats();
        expect(stats.setPipelineCalls).toBe(1);
        expect(stats.setBindGroupCalls).toBe(1);
        expect(stats.setVertexBufferCalls).toBe(1);
        expect(stats.drawCalls).toBe(1);

        // Queue.submit was called once with the finished command buffer.
        expect(m.calls.queueSubmit).toHaveBeenCalledTimes(1);
    });

    it('threads BufferHandle.offset through every setVertexBuffer / setBindGroup entry (slab readiness)', () => {
        const m = makeMockDevice();
        const SLAB = 2048;
        const bm = makeRecordingBM(m.device, SLAB);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);

        const drawable = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
            bindings: { camera: camRes },
            draw: { kind: 'array', vertexCount: 1 },
        });

        const s = scene({ target: TARGET, root: container([draw(drawable)]) });
        ctx.submit(s);

        const svbs = passCmds(m, 'setVertexBuffer');
        expect(svbs.length).toBe(1);
        const svb = svbs[0];
        if (svb?.kind !== 'setVertexBuffer') throw new Error('unreachable');
        expect(svb.offset).toBe(SLAB);
        expect(svb.size).toBeGreaterThan(0);

        // The bind group entry for the camera uniform should also carry the slab offset.
        const bgs = m.created.bindGroups as MockGpuBindGroup[];
        expect(bgs.length).toBeGreaterThan(0);
        const bg = bgs[0]!;
        const entries = bg.descriptor.entries as readonly GPUBindGroupEntry[];
        const bufEntry = entries[0]?.resource as { buffer: GPUBuffer; offset: number; size: number };
        expect(bufEntry.offset).toBe(SLAB);
        expect(bufEntry.size).toBeGreaterThan(0);
    });

    it('threads setIndexBuffer offset + size for indexed draws', () => {
        const m = makeMockDevice();
        const SLAB = 1024;
        const bm = makeRecordingBM(m.device, SLAB);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);

        const drawable = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) } },
            index: { kind: 'arrays', data: new Uint16Array([0, 1, 2]) },
            bindings: { camera: camRes },
            draw: { kind: 'indexed', indexCount: 3 },
        });

        ctx.submit(scene({ target: TARGET, root: container([draw(drawable)]) }));

        const sib = passCmds(m, 'setIndexBuffer');
        expect(sib.length).toBe(1);
        const ix = sib[0];
        if (ix?.kind !== 'setIndexBuffer') throw new Error('unreachable');
        expect(ix.offset).toBe(SLAB);
        expect(ix.format).toBe('uint16');
    });
});

describe('GraphEncoder — state elision', () => {
    it('does NOT re-emit setPipeline between consecutive draws of the same pipeline', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);

        const verts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        const d1 = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: verts } },
            bindings: { camera: camRes },
            draw: { kind: 'array', vertexCount: 3 },
        });
        const d2 = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: verts } },
            bindings: { camera: camRes.share() },
            draw: { kind: 'array', vertexCount: 3 },
        });

        const s = scene({ target: TARGET, root: container([draw(d1), draw(d2)]) });
        ctx.submit(s);

        const setPipelineCount = passCmds(m, 'setPipeline').length;
        const drawCount = passCmds(m, 'draw').length;
        expect(setPipelineCount).toBe(1);
        expect(drawCount).toBe(2);
    });

    it('does NOT re-emit setBindGroup when the same group object is already bound', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);

        const verts = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
        const d1 = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: verts } },
            bindings: { camera: camRes },
            draw: { kind: 'array', vertexCount: 3 },
        });
        const d2 = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: verts } },
            bindings: { camera: camRes.share() },
            draw: { kind: 'array', vertexCount: 3 },
        });

        const s = scene({ target: TARGET, root: container([draw(d1), draw(d2)]) });
        ctx.submit(s);

        // Same camera resource (same version), same pipeline ⇒ bind-group cache hit ⇒
        // only one setBindGroup call across both draws.
        const setBindGroupCount = passCmds(m, 'setBindGroup').length;
        expect(setBindGroupCount).toBe(1);
    });

    it('caches GPUBindGroup objects across submits (no createBindGroup re-call when nothing changed)', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);

        const drawable = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
            bindings: { camera: camRes },
            draw: { kind: 'array', vertexCount: 1 },
        });
        const s = scene({ target: TARGET, root: container([draw(drawable)]) });

        ctx.submit(s);
        const createsAfterFirst = m.calls.createBindGroup.mock.calls.length;
        ctx.submit(s);
        expect(m.calls.createBindGroup.mock.calls.length).toBe(createsAfterFirst);
    });
});

describe('GraphEncoder — scoped state restoration', () => {
    it('viewport subtree restores the prior viewport on exit', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const verts = new Float32Array([0, 0, 0]);

        const outerDraw = draw(
            ctx.drawable({
                pipeline,
                vertex: { kind: 'arrays', arrays: { position: verts } },
                bindings: { camera: camRes },
                draw: { kind: 'array', vertexCount: 1 },
            })
        );
        const innerDraw = draw(
            ctx.drawable({
                pipeline,
                vertex: { kind: 'arrays', arrays: { position: verts } },
                bindings: { camera: camRes.share() },
                draw: { kind: 'array', vertexCount: 1 },
            })
        );
        const tailDraw = draw(
            ctx.drawable({
                pipeline,
                vertex: { kind: 'arrays', arrays: { position: verts } },
                bindings: { camera: camRes.share() },
                draw: { kind: 'array', vertexCount: 1 },
            })
        );

        const root = container([
            viewport({ x: 0, y: 0, width: 100, height: 100 }, [
                outerDraw,
                viewport({ x: 10, y: 10, width: 20, height: 20 }, [innerDraw]),
                tailDraw,
            ]),
        ]);

        const s = scene({ target: TARGET, root });
        ctx.submit(s);

        const viewports = passCmds(m, 'setViewport').filter(
            (c): c is Extract<PassCommand, { kind: 'setViewport' }> => c.kind === 'setViewport'
        );
        // Outer enter (0,0,100,100), inner enter (10,10,20,20), inner restore (0,0,100,100).
        // Outer restore on exit not emitted because there is no prior viewport (snapshot was undefined).
        expect(viewports.length).toBe(3);
        expect(viewports[0]?.width).toBe(100);
        expect(viewports[1]?.width).toBe(20);
        expect(viewports[2]?.width).toBe(100); // restored after inner subtree
    });
});

describe('GraphEncoder — Scene.dirty integration', () => {
    it('clears Scene.dirty after each submit', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);

        const d = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
            bindings: { camera: camRes },
            draw: { kind: 'array', vertexCount: 1 },
        });
        const s = scene({ target: TARGET, root: container([draw(d)]) });
        s.markSubtreeDirty(s.root.id);
        expect(s.dirty.size).toBeGreaterThan(0);
        ctx.submit(s);
        expect(s.dirty.size).toBe(0);
    });
});

describe('RenderingContext — encoder + bind-group cache lifecycle', () => {
    it('ctx.dispose() clears the bind-group cache (stats().bindGroups goes back to 0)', () => {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const d = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
            bindings: { camera: camRes },
            draw: { kind: 'array', vertexCount: 1 },
        });
        ctx.submit(scene({ target: TARGET, root: container([draw(d)]) }));
        expect(ctx.stats().bindGroups).toBeGreaterThan(0);

        ctx.dispose();
        expect(ctx.stats().bindGroups).toBe(0);
        expect(bm.dispose).not.toHaveBeenCalled(); // ownership contract preserved
    });

    it('encoder() returns the same instance until dispose()', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, bufferManager: makeRecordingBM(m.device) });
        const e1 = ctx.encoder();
        const e2 = ctx.encoder();
        expect(e1).toBe(e2);
        ctx.dispose();
        // After dispose, encoder() should throw use-after-dispose.
        expect(() => ctx.encoder()).toThrow(/use-after-dispose/);
    });
});

// ---- Phase 7.1: subtree-command cache -------------------------------------------------------
//
// The encoder maintains a per-`Scene` cache keyed by composite node id. On a second `submit`
// of the same scene with no dirty nodes, the encoder should replay cached command lists
// instead of re-walking (and re-resolving bind groups). The tests below assert observable
// consequences of the cache: no new `createBindGroup` calls on cache hits, correct pass
// command replay, invalidation via `markSubtreeDirty`, and cache-entry eviction on structural
// changes.

describe('GraphEncoder — subtree-command cache (Phase 7.1)', () => {
    function buildFixture() {
        const m = makeMockDevice();
        const bm = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });
        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());
        const camRes = ctx.resource(cam);
        const d = ctx.drawable({
            pipeline,
            vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
            bindings: { camera: camRes },
            draw: { kind: 'array', vertexCount: 1 },
        });
        return { m, bm, ctx, d };
    }

    it('second submit of an unchanged scene reports cache hits and emits identical pass commands', () => {
        const { m, ctx, d } = buildFixture();
        const s = scene({ target: TARGET, root: container([draw(d)]) });

        ctx.submit(s);
        const firstStats = ctx.encoder().lastStats();
        expect(firstStats.subtreeCacheHits).toBe(0);
        expect(firstStats.subtreeCacheMisses).toBeGreaterThan(0);
        const firstCommands = m.passCommands.slice();
        const firstBindGroupCount = (m.calls.createBindGroup as ReturnType<typeof vi.fn>).mock.calls.length;

        ctx.submit(s);
        const secondStats = ctx.encoder().lastStats();
        // Second frame with no dirty nodes: every composite in the tree should be a cache hit
        // (root container + one implicit — the test tree is just `container([draw(...)])`, so
        // the container itself is the only composite; the draw leaf goes through walkDraw).
        expect(secondStats.subtreeCacheHits).toBeGreaterThan(0);
        expect(secondStats.subtreeCacheMisses).toBe(0);
        // No new bind groups: the cached commands reference the same `MockGpuBindGroup` objects
        // the first walk produced.
        const secondBindGroupCount = (m.calls.createBindGroup as ReturnType<typeof vi.fn>).mock.calls.length;
        expect(secondBindGroupCount).toBe(firstBindGroupCount);
        // The recorded pass command sequence between the two submits should be equal
        // (bar the `beginRenderPass` + `endRenderPass` bookends which happen every frame).
        const secondFrameCommands = m.passCommands.slice(firstCommands.length);
        // Same total draws in second frame:
        expect(secondFrameCommands.filter((c) => c.kind === 'draw' || c.kind === 'drawIndexed').length).toBe(
            firstCommands.filter((c) => c.kind === 'draw' || c.kind === 'drawIndexed').length
        );
    });

    it('markSubtreeDirty on the root forces a full re-record on next submit', () => {
        const { ctx, d } = buildFixture();
        const s = scene({ target: TARGET, root: container([draw(d)]) });

        ctx.submit(s);
        s.markSubtreeDirty(s.root.id);
        ctx.submit(s);
        const stats = ctx.encoder().lastStats();
        // Every composite is dirty → every composite misses (and re-records).
        expect(stats.subtreeCacheHits).toBe(0);
        expect(stats.subtreeCacheMisses).toBeGreaterThan(0);
    });

    it('encoder.subtreeCacheSize() reports the number of cached composite entries', () => {
        const { ctx, d } = buildFixture();
        const s = scene({
            target: TARGET,
            root: container([viewport({ x: 0, y: 0, width: 10, height: 10 }, [draw(d)])]),
        });

        expect(ctx.encoder().subtreeCacheSize()).toBe(0);
        ctx.submit(s);
        // Root container + viewport = 2 composite entries.
        expect(ctx.encoder().subtreeCacheSize()).toBe(2);
    });

    it('Scene.remove evicts the removed subtree and every descendant from the cache', () => {
        const { ctx, d } = buildFixture();
        const inner = viewport({ x: 0, y: 0, width: 10, height: 10 }, [draw(d)]);
        const s = scene({ target: TARGET, root: container([inner]) });

        ctx.submit(s);
        expect(ctx.encoder().subtreeCacheSize()).toBe(2); // root + inner viewport
        s.remove(inner.id);
        // Removal evicts the viewport entry immediately (via structure-changed listener). The
        // root container entry is invalidated by `markAncestorsDirty` but stays in the cache
        // until the next walk re-records it. So we expect exactly 1 entry (the root) after
        // eviction, since the viewport composite was the only descendant.
        expect(ctx.encoder().subtreeCacheSize()).toBe(1);
    });

    it('clearSubtreeCache() drops every cached entry across every scene', () => {
        const { ctx, d } = buildFixture();
        const s = scene({ target: TARGET, root: container([draw(d)]) });
        ctx.submit(s);
        expect(ctx.encoder().subtreeCacheSize()).toBeGreaterThan(0);
        ctx.encoder().clearSubtreeCache();
        expect(ctx.encoder().subtreeCacheSize()).toBe(0);
    });

    it('nested composites: inner cache hit still tees commands into outer re-record', () => {
        const { m, ctx, d } = buildFixture();
        const inner = viewport({ x: 0, y: 0, width: 10, height: 10 }, [draw(d)]);
        const s = scene({ target: TARGET, root: container([inner]) });

        // Frame 1: everything recorded fresh.
        ctx.submit(s);
        const frame1DrawCount = m.passCommands.filter(
            (c) => c.kind === 'draw' || c.kind === 'drawIndexed'
        ).length;
        expect(frame1DrawCount).toBe(1);

        // Frame 2: mark ONLY the root container dirty. The inner viewport is still clean and
        // should hit the cache; its replayed commands must be teed into the root's new recorder
        // so the root cache entry we save this frame is complete.
        s.markDirty(s.root.id);
        ctx.submit(s);
        const stats = ctx.encoder().lastStats();
        expect(stats.subtreeCacheHits).toBeGreaterThan(0); // inner viewport hit
        expect(stats.subtreeCacheMisses).toBeGreaterThan(0); // root re-recorded

        // Frame 3: everything clean → both should hit; and the draw command should still be
        // emitted exactly once.
        const cmdCountBefore = m.passCommands.length;
        ctx.submit(s);
        const frame3 = m.passCommands.slice(cmdCountBefore);
        const frame3Draws = frame3.filter((c) => c.kind === 'draw' || c.kind === 'drawIndexed');
        expect(frame3Draws.length).toBe(1);
        const frame3Stats = ctx.encoder().lastStats();
        expect(frame3Stats.subtreeCacheMisses).toBe(0);
    });
});

