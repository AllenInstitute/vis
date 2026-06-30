import { describe, expect, it, vi } from 'vitest';
import type { BufferHandle, BufferManager, BufferManagerStats } from '../memory/types';
import { uniformSlot, storageSlot, samplerSlot, textureSlot, externalTextureSlot, storageTextureSlot } from '../resources';
import { member, struct } from '../shaders';
import { makeMockDevice } from '../test/mock-device';
import {
    isResource,
    makeBufferResource,
    makeExternalTextureResource,
    makeSamplerResource,
    makeStorageTextureResource,
    makeTextureResource,
    RESOURCE_BRAND,
} from './resource';

// ----- shared fixtures ----------------------------------------------------

type Camera = {
    view: readonly number[];
    proj: readonly number[];
};

const cameraStruct = struct<Camera>('Camera', [
    member('view', 'mat4x4f'),
    member('proj', 'mat4x4f'),
]);

/**
 * Minimal recording `BufferManager`. Hands out monotonically-allocated handles backed by the
 * supplied mock-device `createBuffer`; tracks every released handle so refcount tests can
 * verify cleanup.
 */
function makeRecordingBufferManager(device: GPUDevice): {
    bm: BufferManager;
    released: BufferHandle[];
    handlesIssued: () => BufferHandle[];
} {
    const issued: BufferHandle[] = [];
    const released: BufferHandle[] = [];
    const stats = vi.fn(
        (): BufferManagerStats => ({ residentBytes: 0, leasedBytes: 0, freeBytes: 0 })
    );
    const acquire = vi.fn((sizeBytes: number, usage: GPUBufferUsageFlags) => {
        const gpu = device.createBuffer({ size: sizeBytes, usage });
        const handle: BufferHandle = {
            gpu,
            buffer: gpu,
            offset: 0,
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
        issued.push(handle);
        return handle;
    });
    const acquireForSlot = vi.fn(
        (_slot: unknown, sizeBytes: number, usage: GPUBufferUsageFlags) =>
            acquire(sizeBytes, usage)
    );
    const bm: BufferManager = {
        acquire,
        acquireForSlot,
        precheck: vi.fn(() => true),
        release: vi.fn((h: BufferHandle) => released.push(h)),
        endFrame: vi.fn(),
        frameLease: vi.fn(() => {
            throw new Error('frameLease: not supported in this mock');
        }),
        stats,
        dispose: vi.fn(),
    };
    return { bm, released, handlesIssued: () => issued };
}

// ----- BufferResource construction & round-trip --------------------------

describe('makeBufferResource — construction + round-trip', () => {
    it('reflects a struct slot and allocates a sized buffer through the BufferManager', () => {
        const m = makeMockDevice();
        const { bm, handlesIssued } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);

        const r = makeBufferResource<Camera>(cam, bm, undefined);

        expect(r.kind).toBe('uniform');
        expect(r.slot).toBe(cam);
        expect(r.usage & GPUBufferUsage.UNIFORM).toBe(GPUBufferUsage.UNIFORM);
        expect(r.usage & GPUBufferUsage.COPY_DST).toBe(GPUBufferUsage.COPY_DST);
        // Two mat4x4f members = 2 * 64 = 128 bytes.
        expect(r.arrayBuffer.byteLength).toBe(128);
        const issued = handlesIssued();
        expect(issued).toHaveLength(1);
        expect(issued[0]?.size).toBe(128);
        // sanity: handle is the same one carried by the resource.
        expect(r.handle).toBe(issued[0]);
    });

    it('seeds initial values into the structured view without committing', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);
        const view = new Float32Array(16);
        view[0] = 1;
        view[5] = 1;
        view[10] = 1;
        view[15] = 1;

        const r = makeBufferResource<Camera>(cam, bm, { view: Array.from(view) });

        // The cpu-side bytes hold the identity matrix in the `view` field offset.
        const dv = new DataView(r.arrayBuffer);
        expect(dv.getFloat32(0, true)).toBe(1);
        expect(dv.getFloat32(5 * 4, true)).toBe(1);
        // No GPU upload happened during construction.
        expect(m.calls.writeBuffer).not.toHaveBeenCalled();
        expect(r.version).toBe(0);
    });

    it('set() updates the CPU view; commit() uploads through queue.writeBuffer and bumps version', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);

        const r = makeBufferResource<Camera>(cam, bm, undefined);
        const proj = new Float32Array(16).fill(2);
        r.set({ proj: Array.from(proj) });
        r.commit(m.device);

        expect(r.version).toBe(1);
        expect(m.calls.writeBuffer).toHaveBeenCalledTimes(1);
        expect(m.writes).toHaveLength(1);
        const write = m.writes[0];
        expect(write?.buffer).toBe(r.handle.gpu);
        expect(write?.bufferOffset).toBe(r.handle.offset);
        expect(write?.data.byteLength).toBe(128);

        // Second commit bumps version again.
        r.commit(m.device);
        expect(r.version).toBe(2);
    });

    it('setField() updates a single member through view.set', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);
        const r = makeBufferResource<Camera>(cam, bm, undefined);

        const identity = new Float32Array(16);
        identity[0] = identity[5] = identity[10] = identity[15] = 1;
        r.setField('view', Array.from(identity));

        const dv = new DataView(r.arrayBuffer);
        expect(dv.getFloat32(0, true)).toBe(1);
        expect(dv.getFloat32(5 * 4, true)).toBe(1);
        expect(dv.getFloat32(10 * 4, true)).toBe(1);
        expect(dv.getFloat32(15 * 4, true)).toBe(1);
    });

    it('throws when setField() targets an unknown member', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);
        const r = makeBufferResource<Camera & { typo: number }>(cam, bm, undefined);
        expect(() => r.setField('typo', 1)).toThrow(/typo/);
        expect(() => r.setField('typo', 1)).toThrow(/Camera/);
    });

    it('rejects construction when the slot type is a raw WGSL string', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBufferManager(m.device);
        const u = uniformSlot('raw', 'f32');
        expect(() => makeBufferResource(u, bm, undefined)).toThrow(/StructDecl/);
    });

    it('reflects storage slots with their access mode', () => {
        const m = makeMockDevice();
        const { bm, handlesIssued } = makeRecordingBufferManager(m.device);
        const sStruct = struct('SBuf', [member('flag', 'u32')]);
        const s = storageSlot('s', sStruct, { accessMode: 'read_write' });

        const r = makeBufferResource(s, bm, undefined);

        expect(r.kind).toBe('storage');
        expect(r.usage & GPUBufferUsage.STORAGE).toBe(GPUBufferUsage.STORAGE);
        // u32 = 4 bytes.
        expect(handlesIssued()[0]?.size).toBe(4);
    });
});

// ----- Refcount / share / destroy -----------------------------------------

describe('BufferResource — refcount semantics', () => {
    it('starts with refcount 1; destroy() releases the handle and marks disposed', () => {
        const m = makeMockDevice();
        const { bm, released } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);
        const r = makeBufferResource<Camera>(cam, bm, undefined);

        expect(r.refcount).toBe(1);
        expect(r.disposed).toBe(false);
        r.destroy();
        expect(r.disposed).toBe(true);
        expect(released).toHaveLength(1);
        expect(released[0]).toBe(r.handle);
    });

    it('share() bumps refcount; destroy() is idempotent after refcount hits 0', () => {
        const m = makeMockDevice();
        const { bm, released } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);
        const r = makeBufferResource<Camera>(cam, bm, undefined);

        r.share();
        r.share();
        expect(r.refcount).toBe(3);

        r.destroy();
        r.destroy();
        expect(released).toHaveLength(0);
        expect(r.refcount).toBe(1);
        expect(r.disposed).toBe(false);

        r.destroy();
        expect(released).toHaveLength(1);
        expect(r.disposed).toBe(true);

        // Further destroys are no-ops.
        r.destroy();
        r.destroy();
        expect(released).toHaveLength(1);
    });

    it('share() returns the same instance', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);
        const r = makeBufferResource<Camera>(cam, bm, undefined);
        expect(r.share()).toBe(r);
    });

    it('rejects mutations after destroy()', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);
        const r = makeBufferResource<Camera>(cam, bm, undefined);
        r.destroy();
        expect(() => r.set({})).toThrow(/destroy/);
        expect(() => r.setField('view', [])).toThrow(/destroy/);
        expect(() => r.commit(m.device)).toThrow(/destroy/);
        expect(() => r.share()).toThrow(/destroy/);
    });
});

// ----- Other resource kinds -----------------------------------------------

describe('SamplerResource', () => {
    it('uses a pre-built GPUSampler when supplied', () => {
        const m = makeMockDevice();
        // Pretend a GPUSampler has no descriptor-shaped properties.
        const sampler = { label: 'pre-built' } as unknown as GPUSampler;
        const slot = samplerSlot('samp', 'sampler');
        const r = makeSamplerResource(slot, m.device, sampler);
        expect(r.sampler).toBe(sampler);
        expect(r.kind).toBe('sampler');
        r.destroy();
        expect(r.disposed).toBe(true);
    });

    it('refcounts via share()/destroy()', () => {
        const m = makeMockDevice();
        const slot = samplerSlot('samp', 'sampler');
        const sampler = {} as unknown as GPUSampler;
        const r = makeSamplerResource(slot, m.device, sampler);
        r.share();
        r.destroy();
        expect(r.disposed).toBe(false);
        r.destroy();
        expect(r.disposed).toBe(true);
    });
});

describe('TextureResource', () => {
    it('wraps a GPUTexture and creates a view when none is supplied', () => {
        const slot = textureSlot('tex', 'texture_2d<f32>');
        const createView = vi.fn(() => ({ __mockKind: 'textureView' as const } as unknown as GPUTextureView));
        const destroy = vi.fn();
        const texture = { createView, destroy } as unknown as GPUTexture;
        const r = makeTextureResource(slot, { texture });
        expect(r.texture).toBe(texture);
        expect(createView).toHaveBeenCalledTimes(1);
        r.destroy();
        expect(destroy).toHaveBeenCalledTimes(1);
    });

    it('uses the explicit view when supplied', () => {
        const slot = textureSlot('tex', 'texture_2d<f32>');
        const view = {} as unknown as GPUTextureView;
        const texture = {
            createView: vi.fn(),
            destroy: vi.fn(),
        } as unknown as GPUTexture;
        const r = makeTextureResource(slot, { texture, view });
        expect(r.view).toBe(view);
        expect((texture as unknown as { createView: unknown }).createView).not.toHaveBeenCalled();
    });
});

describe('StorageTextureResource', () => {
    it('wraps a GPUTexture and destroys it when refcount hits 0', () => {
        const slot = storageTextureSlot('st', 'texture_storage_2d<rgba8unorm, write>', 'rgba8unorm');
        const destroy = vi.fn();
        const createView = vi.fn(() => ({}) as GPUTextureView);
        const texture = { createView, destroy } as unknown as GPUTexture;
        const r = makeStorageTextureResource(slot, { texture });
        r.share();
        r.destroy();
        expect(destroy).not.toHaveBeenCalled();
        r.destroy();
        expect(destroy).toHaveBeenCalledTimes(1);
    });
});

describe('ExternalTextureResource', () => {
    it('wraps a GPUExternalTexture and marks disposed on final destroy()', () => {
        const slot = externalTextureSlot('ext');
        const external = {} as unknown as GPUExternalTexture;
        const r = makeExternalTextureResource(slot, external);
        expect(r.external).toBe(external);
        r.destroy();
        expect(r.disposed).toBe(true);
    });
});

// ----- Brand / isResource -------------------------------------------------

describe('isResource', () => {
    it('returns true for every concrete resource kind', () => {
        const m = makeMockDevice();
        const { bm } = makeRecordingBufferManager(m.device);
        const cam = uniformSlot('camera', cameraStruct);
        const buf = makeBufferResource<Camera>(cam, bm, undefined);
        expect(isResource(buf)).toBe(true);
        expect(buf.__brand).toBe(RESOURCE_BRAND);
    });

    it('returns false for plain objects', () => {
        expect(isResource(null)).toBe(false);
        expect(isResource(undefined)).toBe(false);
        expect(isResource({})).toBe(false);
        expect(isResource({ __brand: 'wrong' })).toBe(false);
    });
});
