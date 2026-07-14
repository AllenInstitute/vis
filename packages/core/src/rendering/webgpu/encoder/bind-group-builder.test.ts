import { describe, expect, it, vi } from 'vitest';
import { renderingContext } from '../context';
import type { Resource } from '../data/resource';
import type { Drawable } from '../drawable';
import type { BufferHandle, BufferManager, BufferManagerStats } from '../memory/types';
import { bindings, group } from '../pipelines/binding-graph';
import type { BuiltPipeline } from '../pipelines/build';
import { uniformSlot } from '../binding';
import type { ResourceSlot } from '../binding/slot';
import { container, draw, scene } from '../scene/scene';
import type { RenderTarget } from '../scene/types';
import { member, shader, struct } from '../shaders';
import { makeMockDevice } from '../test/mock-device';
import {
    type BindGroupBuildArgs,
    type BindGroupCacheStore,
    buildBindGroupsForDraw,
    sweepBindGroupCache,
} from './bind-group-builder';

// ---- unit-level fixtures ----------------------------------------------------------------------

function makeStore(): BindGroupCacheStore {
    return { cache: new Map(), keyToResources: new Map(), resourceToKeys: new WeakMap() };
}

function makeDevice(): GPUDevice {
    let n = 0;
    return {
        createBindGroup: (desc: GPUBindGroupDescriptor): GPUBindGroup =>
            ({ __bg: n++, label: desc.label }) as unknown as GPUBindGroup,
    } as unknown as GPUDevice;
}

let resourceCounter = 0;
/** Minimal sampler-kind resource — the builder only reads `id`, `version`, `kind`, `sampler`. */
function fakeResource(version = 0, id = `res-${resourceCounter++}`): Resource {
    return {
        id,
        version,
        kind: 'sampler',
        sampler: {} as GPUSampler,
    } as unknown as Resource;
}

function fakeSlot(name: string): ResourceSlot {
    return { name } as unknown as ResourceSlot;
}

function fakePipeline(entries: Array<[ResourceSlot, { group: number; binding: number }]>): BuiltPipeline {
    return {
        fingerprint: 'pl',
        bindGroupLayouts: [{} as GPUBindGroupLayout],
        slotIndex: new Map(entries),
    } as unknown as BuiltPipeline;
}

function fakeDrawable(entries: Array<[ResourceSlot, Resource]>): Drawable {
    return {
        id: 'drw',
        label: 'drw',
        bindings: new Map(entries),
        pipeline: { fingerprint: 'pl' },
    } as unknown as Drawable;
}

function build(
    device: GPUDevice,
    pipeline: BuiltPipeline,
    drawable: Drawable,
    store: BindGroupCacheStore
): GPUBindGroup {
    const args: BindGroupBuildArgs = { device, pipeline, drawable, overrideStack: [], store };
    const bg = buildBindGroupsForDraw(args).groups.get(0);
    if (bg === undefined) throw new Error('expected a bind group for group 0');
    return bg;
}

// ---- unit tests -------------------------------------------------------------------------------

describe('buildBindGroupsForDraw — identity-aware cache key', () => {
    it('reuses the same GPUBindGroup for identical (resource id + version)', () => {
        const device = makeDevice();
        const slot = fakeSlot('a');
        const pipeline = fakePipeline([[slot, { group: 0, binding: 0 }]]);
        const res = fakeResource();
        const store = makeStore();

        const g1 = build(device, pipeline, fakeDrawable([[slot, res]]), store);
        const g2 = build(device, pipeline, fakeDrawable([[slot, res]]), store);

        expect(g2).toBe(g1);
        expect(store.cache.size).toBe(1);
    });

    it('does NOT collide two distinct resources that share a slot + version', () => {
        const device = makeDevice();
        const slot = fakeSlot('a');
        const pipeline = fakePipeline([[slot, { group: 0, binding: 0 }]]);
        const r1 = fakeResource(0);
        const r2 = fakeResource(0); // same version, different id
        const store = makeStore();

        const g1 = build(device, pipeline, fakeDrawable([[slot, r1]]), store);
        const g2 = build(device, pipeline, fakeDrawable([[slot, r2]]), store);

        expect(g2).not.toBe(g1);
        expect(store.cache.size).toBe(2);
    });
});

describe('sweepBindGroupCache — selective invalidation', () => {
    it('drops only the entries referencing the invalidated resource', () => {
        const device = makeDevice();
        const slot = fakeSlot('a');
        const pipeline = fakePipeline([[slot, { group: 0, binding: 0 }]]);
        const r1 = fakeResource();
        const r2 = fakeResource();
        const store = makeStore();

        build(device, pipeline, fakeDrawable([[slot, r1]]), store);
        const g2 = build(device, pipeline, fakeDrawable([[slot, r2]]), store);
        expect(store.cache.size).toBe(2);

        const removed = sweepBindGroupCache(store, [r1]);
        expect(removed).toBe(1);
        expect(store.cache.size).toBe(1);

        // r2's entry survives untouched — rebuilding it is a cache hit.
        const g2again = build(device, pipeline, fakeDrawable([[slot, r2]]), store);
        expect(g2again).toBe(g2);
        expect(store.cache.size).toBe(1);
    });

    it('cleans cross-references so a co-bound resource sweeps to a no-op afterward', () => {
        const device = makeDevice();
        const s0 = fakeSlot('a');
        const s1 = fakeSlot('b');
        const pipeline = fakePipeline([
            [s0, { group: 0, binding: 0 }],
            [s1, { group: 0, binding: 1 }],
        ]);
        const rA = fakeResource();
        const rB = fakeResource();
        const store = makeStore();

        build(device, pipeline, fakeDrawable([[s0, rA], [s1, rB]]), store);
        expect(store.cache.size).toBe(1);

        expect(sweepBindGroupCache(store, [rA])).toBe(1);
        expect(store.cache.size).toBe(0);
        // rB's reverse entry for that key was cleaned when rA swept it.
        expect(sweepBindGroupCache(store, [rB])).toBe(0);
    });

    it('a version bump then sweep drops the stale entry, and the rebuild is a fresh group', () => {
        const device = makeDevice();
        const slot = fakeSlot('a');
        const pipeline = fakePipeline([[slot, { group: 0, binding: 0 }]]);
        // Mutable resource modelling an in-place commit (version bump).
        const res = fakeResource(0) as { version: number } & Resource;
        const store = makeStore();

        const g0 = build(device, pipeline, fakeDrawable([[slot, res]]), store);
        res.version = 1; // commit() bumps version in place …
        sweepBindGroupCache(store, [res]); // … and sweeps by object identity.
        expect(store.cache.size).toBe(0);

        const g1 = build(device, pipeline, fakeDrawable([[slot, res]]), store);
        expect(g1).not.toBe(g0);
        expect(store.cache.size).toBe(1);
    });

    it('returns 0 for an empty resource list', () => {
        const store = makeStore();
        expect(sweepBindGroupCache(store, [])).toBe(0);
    });
});

// ---- integration fixtures ---------------------------------------------------------------------

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

function makeRecordingBM(device: GPUDevice): BufferManager {
    const make = (sizeBytes: number, usage: GPUBufferUsageFlags): BufferHandle => {
        const gpu = device.createBuffer({ size: sizeBytes, usage });
        const handle: BufferHandle = {
            gpu,
            offset: 0,
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
            (_slot: unknown, sizeBytes: number, usage: GPUBufferUsageFlags) => make(sizeBytes, usage)
        ),
        precheck: vi.fn(() => true),
        release: vi.fn(),
        endFrame: vi.fn(),
        frameLease: vi.fn(() => {
            throw new Error('frameLease not supported');
        }) as unknown as BufferManager['frameLease'],
        stats: vi.fn((): BufferManagerStats => ({ residentBytes: 0, leasedBytes: 0, freeBytes: 0 })),
        dispose: vi.fn(),
    };
}

// ---- integration tests ------------------------------------------------------------------------

describe('RenderingContext — bind-group cache lifecycle', () => {
    it('commit() on a bound uniform auto-sweeps its cached bind group', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, bufferManager: makeRecordingBM(m.device) });
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
        expect(ctx.stats().bindGroups).toBe(1);

        // Mutating + committing the uniform invalidates the entry that referenced it.
        camRes.commit(m.device);
        expect(ctx.stats().bindGroups).toBe(0);

        // The per-scene subtree cache would otherwise replay the recorded commands without
        // rebuilding bind groups; clear it so the next submit actually re-invokes the builder.
        ctx.encoder().clearSubtreeCache();
        ctx.submit(s);
        expect(ctx.stats().bindGroups).toBe(1);
    });

    it('two distinct resources at the same version produce two cache entries (no collision)', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, bufferManager: makeRecordingBM(m.device) });
        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());

        const camA = ctx.resource(cam);
        const camB = ctx.resource(cam);
        const mkDrawable = (res: typeof camA) =>
            ctx.drawable({
                pipeline,
                vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
                bindings: { camera: res },
                draw: { kind: 'array', vertexCount: 1 },
            });

        const s = scene({
            target: TARGET,
            root: container([draw(mkDrawable(camA)), draw(mkDrawable(camB))]),
        });
        ctx.submit(s);

        expect(ctx.stats().bindGroups).toBe(2);
    });

    it('ctx.sweepBindGroups drops only entries referencing the given resource', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, bufferManager: makeRecordingBM(m.device) });
        const { cam, graph, sh } = pipelineFixture();
        const pipeline = ctx.pipeline(graph, sh, colorState());

        const camA = ctx.resource(cam);
        const camB = ctx.resource(cam);
        const mkDrawable = (res: typeof camA) =>
            ctx.drawable({
                pipeline,
                vertex: { kind: 'arrays', arrays: { position: new Float32Array([0, 0, 0]) } },
                bindings: { camera: res },
                draw: { kind: 'array', vertexCount: 1 },
            });
        const s = scene({
            target: TARGET,
            root: container([draw(mkDrawable(camA)), draw(mkDrawable(camB))]),
        });
        ctx.submit(s);
        expect(ctx.stats().bindGroups).toBe(2);

        const removed = ctx.sweepBindGroups([camA]);
        expect(removed).toBe(1);
        expect(ctx.stats().bindGroups).toBe(1);
    });

    it('sweepBindGroups is a safe no-op after dispose()', () => {
        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, bufferManager: makeRecordingBM(m.device) });
        const { cam } = pipelineFixture();
        const camRes = ctx.resource(cam);
        ctx.dispose();
        expect(ctx.sweepBindGroups([camRes])).toBe(0);
    });
});
