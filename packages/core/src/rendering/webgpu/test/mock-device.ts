/**
 * Recording mock `GPUDevice` for tests. Extends the pattern already used by
 * `memory/batch-pool/batch-pool-buffer-manager.test.ts` with the pipeline-build entry points
 * `createBindGroupLayout` / `createPipelineLayout` / `createShaderModule` / `createRenderPipeline`.
 *
 * Each `create*` call returns a unique branded stub so tests can identify the produced object
 * (e.g. assert that the `GPUPipelineLayout` was built from the BGLs returned by earlier calls).
 * No actual WebGPU validation runs — the mock just records the descriptor and hands back a
 * recognizable token.
 *
 * Not exported from the public webgpu barrel; intended only for use inside `*.test.ts` files.
 */

import { vi } from 'vitest';

/** Stubbed GPU object returned by the mock — `__mockKind` lets tests assert provenance. */
export interface MockGpuObject {
    readonly __mockKind:
        | 'buffer'
        | 'bindGroupLayout'
        | 'pipelineLayout'
        | 'shaderModule'
        | 'renderPipeline';
    readonly label?: string;
    readonly descriptor: unknown;
}

export interface MockGpuBindGroupLayout extends MockGpuObject {
    readonly __mockKind: 'bindGroupLayout';
    readonly descriptor: GPUBindGroupLayoutDescriptor;
}
export interface MockGpuPipelineLayout extends MockGpuObject {
    readonly __mockKind: 'pipelineLayout';
    readonly descriptor: GPUPipelineLayoutDescriptor;
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
        readonly writeBuffer: ReturnType<typeof vi.fn>;
    };
    readonly created: {
        readonly bindGroupLayouts: MockGpuBindGroupLayout[];
        readonly pipelineLayouts: MockGpuPipelineLayout[];
        readonly shaderModules: MockGpuShaderModule[];
        readonly renderPipelines: MockGpuRenderPipeline[];
    };
    /** Recorded `queue.writeBuffer` invocations in call order. */
    readonly writes: WriteBufferCall[];
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
            descriptor,
        });
        bindGroupLayouts.push(obj);
        return obj as unknown as GPUBindGroupLayout;
    });

    const createPipelineLayout = vi.fn((descriptor: GPUPipelineLayoutDescriptor) => {
        const obj: MockGpuPipelineLayout = Object.freeze({
            __mockKind: 'pipelineLayout',
            label: descriptor.label ?? '<missing>',
            descriptor,
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

    const device = {
        createBindGroupLayout,
        createPipelineLayout,
        createShaderModule,
        createRenderPipeline,
        createBuffer,
        queue: { writeBuffer },
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
            writeBuffer,
        },
        created: {
            bindGroupLayouts,
            pipelineLayouts,
            shaderModules,
            renderPipelines,
        },
        writes,
    };
}
