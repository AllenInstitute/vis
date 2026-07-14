import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
    DEFAULT_FRAGMENT_ENTRY_POINT,
    DEFAULT_VERTEX_ENTRY_POINT,
    normalizePipelineState,
    type PipelineStateDescriptor,
    PipelineStateDescriptorSchema,
} from './pipeline-state';

describe('PipelineStateDescriptorSchema', () => {
    it('accepts an empty descriptor', () => {
        expect(() => PipelineStateDescriptorSchema.parse({})).not.toThrow();
    });

    it('accepts a fully-specified descriptor', () => {
        const full: PipelineStateDescriptor = {
            label: 'pipeline-A',
            vertex: {
                entryPoint: 'my_vs',
                buffers: [
                    {
                        arrayStride: 16,
                        attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }],
                    },
                ],
                constants: { hairCount: 32 },
            },
            primitive: { topology: 'triangle-list', cullMode: 'back', frontFace: 'ccw' },
            depthStencil: {
                format: 'depth24plus',
                depthWriteEnabled: true,
                depthCompare: 'less',
            },
            multisample: { count: 4 },
            fragment: {
                entryPoint: 'my_fs',
                targets: [{ format: 'bgra8unorm' }],
            },
        };
        expect(() => PipelineStateDescriptorSchema.parse(full)).not.toThrow();
    });

    it('rejects malformed input', () => {
        expect(() =>
            // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid input
            PipelineStateDescriptorSchema.parse({ primitive: { topology: 'bogus' } } as any)
        ).toThrow(ZodError);
        expect(() =>
            // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid input
            PipelineStateDescriptorSchema.parse({ fragment: {} } as any)
        ).toThrow(ZodError); // fragment.targets required when fragment is present
    });
});

describe('normalizePipelineState()', () => {
    it('defaults vertex.entryPoint to vs_main', () => {
        const n = normalizePipelineState({});
        expect(n.vertex.entryPoint).toBe(DEFAULT_VERTEX_ENTRY_POINT);
    });

    it('defaults fragment.entryPoint to fs_main when fragment is present', () => {
        const n = normalizePipelineState({ fragment: { targets: [{ format: 'bgra8unorm' }] } });
        expect(n.fragment?.entryPoint).toBe(DEFAULT_FRAGMENT_ENTRY_POINT);
    });

    it('omits fragment entirely when not supplied (depth-only pipeline)', () => {
        const n = normalizePipelineState({});
        expect(n.fragment).toBeUndefined();
    });

    it('preserves explicit entry-point names', () => {
        const n = normalizePipelineState({
            vertex: { entryPoint: 'my_vs' },
            fragment: { entryPoint: 'my_fs', targets: [{ format: 'bgra8unorm' }] },
        });
        expect(n.vertex.entryPoint).toBe('my_vs');
        expect(n.fragment?.entryPoint).toBe('my_fs');
    });

    it('produces deep-equal output for inputs that differ only in key order', () => {
        const a = normalizePipelineState({
            primitive: { topology: 'triangle-list', cullMode: 'back' },
            multisample: { count: 4 },
            label: 'p',
        });
        const b = normalizePipelineState({
            label: 'p',
            multisample: { count: 4 },
            primitive: { cullMode: 'back', topology: 'triangle-list' },
        });
        expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    });

    it('is idempotent', () => {
        const once = normalizePipelineState({
            vertex: { entryPoint: 'my_vs' },
            primitive: { topology: 'triangle-strip' },
        });
        const twice = normalizePipelineState(once as PipelineStateDescriptor);
        expect(JSON.stringify(once)).toBe(JSON.stringify(twice));
    });

    it('throws on malformed input', () => {
        expect(() =>
            // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid input
            normalizePipelineState({ depthStencil: { format: 'not-a-format' } } as any)
        ).toThrow(ZodError);
    });

    it('preserves vertex buffer layouts and pipeline constants', () => {
        const n = normalizePipelineState({
            vertex: {
                buffers: [
                    {
                        arrayStride: 12,
                        attributes: [{ format: 'float32x3', offset: 0, shaderLocation: 0 }],
                    },
                ],
                constants: { sampleCount: 8 },
            },
        });
        expect(n.vertex.buffers).toHaveLength(1);
        expect(n.vertex.buffers?.[0]?.arrayStride).toBe(12);
        expect(n.vertex.constants).toEqual({ sampleCount: 8 });
    });
});
