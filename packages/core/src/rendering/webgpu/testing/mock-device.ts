import { vi } from 'vitest';
import type { BufferHandle, BufferManager, BufferManagerStats } from '../memory';

/** Stubbed GPU object returned by the mock — `__mockKind` lets tests assert provenance. */
export interface MockGpuObject {
    readonly __mockKind:
        | 'buffer'
        | 'bindGroup'
        | 'bindGroupLayout'
        | 'pipelineLayout'
        | 'shaderModule'
        | 'renderPipeline'
        | 'commandEncoder'
        | 'commandBuffer'
        | 'renderPassEncoder';
    readonly label?: string;
    readonly descriptor: unknown;
}

export interface MockGpuBindGroup extends MockGpuObject {
    readonly __mockKind: 'bindGroup';
    readonly descriptor: GPUBindGroupDescriptor;
}

export interface MockGpuBindGroupLayout extends MockGpuObject {
    readonly __mockKind: 'bindGroupLayout';
    readonly descriptor: Omit<GPUBindGroupLayoutDescriptor, 'entries'> & {
        readonly entries: readonly GPUBindGroupLayoutEntry[];
    };
}
export interface MockGpuPipelineLayout extends MockGpuObject {
    readonly __mockKind: 'pipelineLayout';
    readonly descriptor: Omit<GPUPipelineLayoutDescriptor, 'bindGroupLayouts'> & {
        readonly bindGroupLayouts: readonly (GPUBindGroupLayout | null | undefined)[];
    };
}
export interface MockGpuShaderModule extends MockGpuObject {
    readonly __mockKind: 'shaderModule';
    readonly descriptor: GPUShaderModuleDescriptor;
}
export interface MockGpuRenderPipeline extends MockGpuObject {
    readonly __mockKind: 'renderPipeline';
    readonly descriptor: GPURenderPipelineDescriptor;
}

export interface MockDevice {
    readonly device: GPUDevice;
    readonly calls: {
        readonly createBindGroupLayout: ReturnType<typeof vi.fn>;
        readonly createPipelineLayout: ReturnType<typeof vi.fn>;
        readonly createShaderModule: ReturnType<typeof vi.fn>;
        readonly createRenderPipeline: ReturnType<typeof vi.fn>;
        readonly createBuffer: ReturnType<typeof vi.fn>;
        readonly createBindGroup: ReturnType<typeof vi.fn>;
        readonly createCommandEncoder: ReturnType<typeof vi.fn>;
        readonly queueSubmit: ReturnType<typeof vi.fn>;
        readonly writeBuffer: ReturnType<typeof vi.fn>;
    };
    readonly created: {
        readonly bindGroupLayouts: MockGpuBindGroupLayout[];
        readonly pipelineLayouts: MockGpuPipelineLayout[];
        readonly shaderModules: MockGpuShaderModule[];
        readonly renderPipelines: MockGpuRenderPipeline[];
        readonly bindGroups: MockGpuBindGroup[];
    };
    /** Recorded `queue.writeBuffer` invocations in call order. */
    readonly writes: WriteBufferCall[];
    /** Recorded render-pass commands in call order (across all passes). */
    readonly passCommands: PassCommand[];
}

/** One recorded `queue.writeBuffer(buffer, offset, data, dataOffset?, size?)` invocation. */
export interface WriteBufferCall {
    readonly buffer: GPUBuffer;
    readonly bufferOffset: number;
    /** Snapshot of the bytes written (copied at call time so later mutation of the source is irrelevant). */
    readonly data: Uint8Array;
    readonly dataOffset?: number;
    readonly size?: number;
}

/** Discriminated union of every render-pass command the mock records. */
export type PassCommand =
    | { readonly kind: 'setPipeline'; readonly pipeline: GPURenderPipeline }
    | { readonly kind: 'setBindGroup'; readonly index: number; readonly bindGroup: GPUBindGroup }
    | {
          readonly kind: 'setVertexBuffer';
          readonly slot: number;
          readonly buffer: GPUBuffer;
          readonly offset: number;
          readonly size: number;
      }
    | {
          readonly kind: 'setIndexBuffer';
          readonly buffer: GPUBuffer;
          readonly format: GPUIndexFormat;
          readonly offset: number;
          readonly size: number;
      }
    | {
          readonly kind: 'draw';
          readonly vertexCount: number;
          readonly instanceCount: number;
          readonly firstVertex: number;
          readonly firstInstance: number;
      }
    | {
          readonly kind: 'drawIndexed';
          readonly indexCount: number;
          readonly instanceCount: number;
          readonly firstIndex: number;
          readonly baseVertex: number;
          readonly firstInstance: number;
      }
    | {
          readonly kind: 'setViewport';
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly height: number;
          readonly minDepth: number;
          readonly maxDepth: number;
      }
    | {
          readonly kind: 'setScissorRect';
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly height: number;
      }
    | { readonly kind: 'setStencilReference'; readonly value: number }
    | { readonly kind: 'setBlendConstant'; readonly color: GPUColor }
    | { readonly kind: 'beginRenderPass'; readonly descriptor: GPURenderPassDescriptor }
    | { readonly kind: 'endRenderPass' };

/**
 * Build a recording mock device. Each call site usually constructs a fresh instance so the
 * `vi.fn()` call-list and `created.*` arrays are isolated per test.
 */
export function makeMockDevice(): MockDevice {
    const bindGroupLayouts: MockGpuBindGroupLayout[] = [];
    const pipelineLayouts: MockGpuPipelineLayout[] = [];
    const shaderModules: MockGpuShaderModule[] = [];
    const renderPipelines: MockGpuRenderPipeline[] = [];

    const createBindGroupLayout = vi.fn((descriptor: GPUBindGroupLayoutDescriptor) => {
        const obj: MockGpuBindGroupLayout = Object.freeze({
            __mockKind: 'bindGroupLayout',
            label: descriptor.label ?? '<missing>',
            descriptor: { ...descriptor, entries: [...descriptor.entries] },
        });
        bindGroupLayouts.push(obj);
        return obj as unknown as GPUBindGroupLayout;
    });

    const createPipelineLayout = vi.fn((descriptor: GPUPipelineLayoutDescriptor) => {
        const obj: MockGpuPipelineLayout = Object.freeze({
            __mockKind: 'pipelineLayout',
            label: descriptor.label ?? '<missing>',
            descriptor: { ...descriptor, bindGroupLayouts: [...descriptor.bindGroupLayouts] },
        });
        pipelineLayouts.push(obj);
        return obj as unknown as GPUPipelineLayout;
    });

    const createShaderModule = vi.fn((descriptor: GPUShaderModuleDescriptor) => {
        const obj: MockGpuShaderModule = Object.freeze({
            __mockKind: 'shaderModule',
            label: descriptor.label ?? '<missing>',
            descriptor,
        });
        shaderModules.push(obj);
        return obj as unknown as GPUShaderModule;
    });

    const createRenderPipeline = vi.fn((descriptor: GPURenderPipelineDescriptor) => {
        const obj: MockGpuRenderPipeline = Object.freeze({
            __mockKind: 'renderPipeline',
            label: descriptor.label ?? '<missing>',
            descriptor,
        });
        renderPipelines.push(obj);
        return obj as unknown as GPURenderPipeline;
    });

    const createBuffer = vi.fn((descriptor: GPUBufferDescriptor) => {
        return Object.freeze({
            __mockKind: 'buffer' as const,
            label: descriptor.label ?? '<missing>',
            descriptor,
            size: descriptor.size,
            usage: descriptor.usage,
        }) as unknown as GPUBuffer;
    });

    // ---- queue.writeBuffer recorder ----
    const writes: WriteBufferCall[] = [];
    const writeBuffer = vi.fn(
        (
            buffer: GPUBuffer,
            bufferOffset: number,
            data: BufferSource | SharedArrayBuffer,
            dataOffset?: number,
            size?: number
        ) => {
            // Snapshot the bytes so later writers can't mutate what the test sees.
            const bytes =
                data instanceof ArrayBuffer
                    ? new Uint8Array(data.slice(0))
                    : ArrayBuffer.isView(data)
                      ? new Uint8Array(
                            data.buffer.slice(
                                data.byteOffset,
                                data.byteOffset + data.byteLength
                            )
                        )
                      : new Uint8Array(0);
            const entry: WriteBufferCall = {
                buffer,
                bufferOffset,
                data: bytes,
                ...(dataOffset !== undefined && { dataOffset }),
                ...(size !== undefined && { size }),
            };
            writes.push(entry);
        }
    );

    // ---- createBindGroup recorder ----
    const bindGroups: MockGpuBindGroup[] = [];
    const createBindGroup = vi.fn((descriptor: GPUBindGroupDescriptor) => {
        const obj: MockGpuBindGroup = Object.freeze({
            __mockKind: 'bindGroup',
            label: descriptor.label ?? '<missing>',
            descriptor,
        });
        bindGroups.push(obj);
        return obj as unknown as GPUBindGroup;
    });

    // ---- queue.submit recorder ----
    const queueSubmit = vi.fn((_buffers: readonly GPUCommandBuffer[]) => {
        // No-op; mock only records.
    });

    // ---- createCommandEncoder + recording render-pass ----
    const passCommands: PassCommand[] = [];
    const createCommandEncoder = vi.fn((descriptor?: GPUCommandEncoderDescriptor) => {
        const beginRenderPass = vi.fn((passDesc: GPURenderPassDescriptor) => {
            passCommands.push({ kind: 'beginRenderPass', descriptor: passDesc });
            const pass = {
                setPipeline: vi.fn((pipeline: GPURenderPipeline) =>
                    passCommands.push({ kind: 'setPipeline', pipeline })
                ),
                setBindGroup: vi.fn((index: number, bindGroup: GPUBindGroup) =>
                    passCommands.push({ kind: 'setBindGroup', index, bindGroup })
                ),
                setVertexBuffer: vi.fn(
                    (slot: number, buffer: GPUBuffer, offset?: number, size?: number) =>
                        passCommands.push({
                            kind: 'setVertexBuffer',
                            slot,
                            buffer,
                            offset: offset ?? 0,
                            size: size ?? buffer.size,
                        })
                ),
                setIndexBuffer: vi.fn(
                    (
                        buffer: GPUBuffer,
                        format: GPUIndexFormat,
                        offset?: number,
                        size?: number
                    ) =>
                        passCommands.push({
                            kind: 'setIndexBuffer',
                            buffer,
                            format,
                            offset: offset ?? 0,
                            size: size ?? buffer.size,
                        })
                ),
                setViewport: vi.fn(
                    (
                        x: number,
                        y: number,
                        width: number,
                        height: number,
                        minDepth: number,
                        maxDepth: number
                    ) =>
                        passCommands.push({
                            kind: 'setViewport',
                            x,
                            y,
                            width,
                            height,
                            minDepth,
                            maxDepth,
                        })
                ),
                setScissorRect: vi.fn(
                    (x: number, y: number, width: number, height: number) =>
                        passCommands.push({ kind: 'setScissorRect', x, y, width, height })
                ),
                setStencilReference: vi.fn((value: number) =>
                    passCommands.push({ kind: 'setStencilReference', value })
                ),
                setBlendConstant: vi.fn((color: GPUColor) =>
                    passCommands.push({ kind: 'setBlendConstant', color })
                ),
                draw: vi.fn(
                    (
                        vertexCount: number,
                        instanceCount?: number,
                        firstVertex?: number,
                        firstInstance?: number
                    ) =>
                        passCommands.push({
                            kind: 'draw',
                            vertexCount,
                            instanceCount: instanceCount ?? 1,
                            firstVertex: firstVertex ?? 0,
                            firstInstance: firstInstance ?? 0,
                        })
                ),
                drawIndexed: vi.fn(
                    (
                        indexCount: number,
                        instanceCount?: number,
                        firstIndex?: number,
                        baseVertex?: number,
                        firstInstance?: number
                    ) =>
                        passCommands.push({
                            kind: 'drawIndexed',
                            indexCount,
                            instanceCount: instanceCount ?? 1,
                            firstIndex: firstIndex ?? 0,
                            baseVertex: baseVertex ?? 0,
                            firstInstance: firstInstance ?? 0,
                        })
                ),
                end: vi.fn(() => passCommands.push({ kind: 'endRenderPass' })),
            };
            return pass as unknown as GPURenderPassEncoder;
        });
        const finish = vi.fn(
            () =>
                Object.freeze({
                    __mockKind: 'commandBuffer',
                    label: descriptor?.label ?? '<missing>',
                    descriptor,
                }) as unknown as GPUCommandBuffer
        );
        return {
            beginRenderPass,
            finish,
            label: descriptor?.label ?? '<missing>',
        } as unknown as GPUCommandEncoder;
    });

    const device = {
        createBindGroupLayout,
        createPipelineLayout,
        createShaderModule,
        createRenderPipeline,
        createBuffer,
        createBindGroup,
        createCommandEncoder,
        queue: { writeBuffer, submit: queueSubmit },
        limits: {
            minUniformBufferOffsetAlignment: 256,
            minStorageBufferOffsetAlignment: 256,
        },
    } as unknown as GPUDevice;

    return {
        device,
        calls: {
            createBindGroupLayout,
            createPipelineLayout,
            createShaderModule,
            createRenderPipeline,
            createBuffer,
            createBindGroup,
            createCommandEncoder,
            queueSubmit,
            writeBuffer,
        },
        created: {
            bindGroupLayouts,
            pipelineLayouts,
            shaderModules,
            renderPipelines,
            bindGroups,
        },
        writes,
        passCommands,
    };
}

/** A single recorded acquisition from `makeRecordingBufferManager`. */
export interface RecordedAcquire {
    readonly sizeBytes: number;
    readonly usage: GPUBufferUsageFlags;
    readonly handle: BufferHandle;
}

/** Handle returned by `makeRecordingBufferManager`: the manager plus its recorded activity. */
export interface RecordingBufferManager {
    readonly bm: BufferManager;
    /** Every `acquire` / `acquireForSlot` call, in order. */
    readonly acquired: RecordedAcquire[];
    /** Every handle handed to `release()` / `handle.release()` / `handle.destroy()`. */
    readonly released: BufferHandle[];
}

/** Options for `makeRecordingBufferManager`. */
export interface RecordingBufferManagerOptions {
    /** Non-zero handle offset, emulating a slab allocator. Default `0`. */
    readonly slabOffset?: number;
    /** Values returned by `bm.stats()`. Missing fields default to `0`. */
    readonly stats?: Partial<BufferManagerStats>;
}

/**
 * A recording `BufferManager` backed by a mock device's `createBuffer`. Issues real-looking
 * `BufferHandle`s, records every acquisition/release, and returns configurable `stats()`.
 * Shared by the rendering tests in place of per-file duplicates.
 */
export function makeRecordingBufferManager(
    device: GPUDevice,
    options: RecordingBufferManagerOptions = {}
): RecordingBufferManager {
    const slabOffset = options.slabOffset ?? 0;
    const acquired: RecordedAcquire[] = [];
    const released: BufferHandle[] = [];

    const make = (sizeBytes: number, usage: GPUBufferUsageFlags): BufferHandle => {
        const gpu = device.createBuffer({ size: sizeBytes + slabOffset, usage });
        const handle: BufferHandle = {
            gpu,
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

    const stats: BufferManagerStats = {
        residentBytes: options.stats?.residentBytes ?? 0,
        leasedBytes: options.stats?.leasedBytes ?? 0,
        freeBytes: options.stats?.freeBytes ?? 0,
    };

    const bm: BufferManager = {
        acquire: vi.fn(make),
        acquireForSlot: vi.fn((_slot: unknown, sizeBytes: number, usage: GPUBufferUsageFlags) =>
            make(sizeBytes, usage)
        ) as unknown as BufferManager['acquireForSlot'],
        precheck: vi.fn(() => true),
        release: vi.fn((h: BufferHandle) => released.push(h)),
        endFrame: vi.fn(),
        frameLease: vi.fn(() => {
            throw new Error('frameLease: not supported in the recording mock');
        }) as unknown as BufferManager['frameLease'],
        stats: vi.fn((): BufferManagerStats => stats),
        dispose: vi.fn(),
    };

    return { bm, acquired, released };
}
