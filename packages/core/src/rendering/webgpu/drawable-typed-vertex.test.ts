/**
 * Integration test: the declaration-driven typed vertex-input path on `ctx.drawable(...)`.
 * Verifies that a `vertexLayout(...)` used for BOTH pipeline state and the drawable's typed
 * vertex data produces the expected interleaved buffers (correct byte sizes) allocated through
 * the buffer manager.
 */

import { describe, expect, it, vi } from 'vitest';
import { renderingContext } from './context';
import type { BufferHandle, BufferManager, BufferManagerStats } from './memory/types';
import { bindings, group } from './pipelines/binding-graph';
import { buffer, vertexLayout } from './pipelines/vertex-layout';
import { uniformSlot } from './resources';
import { member, shader, struct } from './shaders';
import { location } from './shaders/attributes';
import { vertexInput } from './shaders/vertex-interface';
import { makeMockDevice } from './test/mock-device';

type CameraShape = { view: readonly number[]; proj: readonly number[] };
const cameraStruct = struct<CameraShape>('Camera', [
    member('view', 'mat4x4f'),
    member('proj', 'mat4x4f'),
]);

const colorState = () => ({
    primitive: { topology: 'triangle-list' as const },
    fragment: { targets: [{ format: 'bgra8unorm' as const }] },
});

function makeRecordingBM(device: GPUDevice): {
    bm: BufferManager;
    acquired: number[];
} {
    const acquired: number[] = [];
    const make = (sizeBytes: number, usage: GPUBufferUsageFlags): BufferHandle => {
        const gpu = device.createBuffer({ size: sizeBytes, usage });
        return {
            gpu,
            buffer: gpu,
            offset: 0,
            size: sizeBytes,
            sizeBytes,
            bucketSize: sizeBytes,
            usage,
            release: vi.fn(),
            sizeInBytes: () => sizeBytes,
            destroy: vi.fn(),
        };
    };
    const bm: BufferManager = {
        acquire: vi.fn((sizeBytes: number, usage: GPUBufferUsageFlags) => {
            acquired.push(sizeBytes);
            return make(sizeBytes, usage);
        }),
        acquireForSlot: vi.fn((_slot: unknown, sizeBytes: number, usage: GPUBufferUsageFlags) =>
            make(sizeBytes, usage)
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
    return { bm, acquired };
}

describe('ctx.drawable() — typed vertex input', () => {
    it('interleaves per-vertex + per-instance buffers from a declared layout', () => {
        const m = makeMockDevice();
        const { bm, acquired } = makeRecordingBM(m.device);
        const ctx = renderingContext({ device: m.device, bufferManager: bm });

        const cam = uniformSlot('camera', cameraStruct);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(group(cam), sh);

        const vin = vertexInput([
            struct('Geo', [member('position', 'vec3f', [location(0)])]), // stride 12
            struct('Inst', [
                member('offset', 'vec3f', [location(1)]),
                member('tint', 'vec4f', [location(2)]),
            ]), // stride 16 (tint overridden to unorm8x4)
        ]);
        const layout = vertexLayout(vin, [
            buffer('vertex', [0]),
            buffer('instance', [1, [2, 'unorm8x4']]),
        ]);

        const pipeline = ctx.pipeline(graph, sh, { ...colorState(), vertex: { layout } });
        const camRes = ctx.resource(cam);

        const drawable = ctx.drawable({
            pipeline,
            vertex: {
                kind: 'typed',
                layout,
                data: {
                    position: [0, 0, 0, 1, 0, 0, 0, 1, 0], // 3 vertices
                    offset: [10, 10, 10, 20, 20, 20], // 2 instances
                    tint: [255, 0, 0, 255, 0, 255, 0, 255],
                },
            },
            bindings: { camera: camRes },
            draw: { kind: 'array', vertexCount: 3, instanceCount: 2 },
        });

        // Two vertex buffers produced, keyed by slot index.
        expect(drawable.vertexBuffers.size).toBe(2);
        expect(drawable.vertexBuffers.has(0)).toBe(true);
        expect(drawable.vertexBuffers.has(1)).toBe(true);

        // Geo: 3 verts * stride 12 = 36; Inst: 2 instances * stride 16 = 32.
        expect(acquired).toContain(36);
        expect(acquired).toContain(32);

        // The pipeline derived its vertex.buffers from the same layout.
        expect(pipeline.state.vertex.buffers).toEqual([
            { arrayStride: 12, attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }] },
            {
                arrayStride: 16,
                stepMode: 'instance',
                attributes: [
                    { format: 'float32x3', offset: 0, shaderLocation: 1 },
                    { format: 'unorm8x4', offset: 12, shaderLocation: 2 },
                ],
            },
        ]);

        drawable.destroy();
    });
});
