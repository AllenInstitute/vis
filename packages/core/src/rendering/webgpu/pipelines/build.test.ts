import { describe, expect, it } from 'vitest';
import { renderingContext } from '../context';
import { ShaderStageFlag } from '../native-types';
import { samplerSlot, textureSlot, uniformSlot } from '../binding';
import { member, shader, struct } from '../shaders';
import type { MockGpuBindGroupLayout, MockGpuRenderPipeline } from '../test/mock-device';
import { makeMockDevice } from '../test/mock-device';
import { bindings, group } from './binding-graph';
import { resolveShaderBindings } from './traverse';

// ----- helpers ------------------------------------------------------------

const cameraStruct = struct('Camera', [
    member('view', 'mat4x4f'),
    member('proj', 'mat4x4f'),
]);

const minimalFragmentState = {
    targets: [{ format: 'bgra8unorm' as const }],
};

function mkColorPipelineState(label?: string) {
    return {
        ...(label !== undefined && { label }),
        primitive: { topology: 'triangle-list' as const },
        fragment: minimalFragmentState,
    };
}

// ----- tests --------------------------------------------------------------

describe('RenderingContext.pipeline() — happy path', () => {
    it('creates one BGL per group depth, one pipeline layout, one shader module, one pipeline', () => {
        const camera = uniformSlot('camera', cameraStruct);
        const root = group({ label: 'frame' }, camera);
        const sh = shader([cameraStruct, camera]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const built = ctx.pipeline(graph, sh, mkColorPipelineState('p'));

        expect(m.calls.createBindGroupLayout).toHaveBeenCalledTimes(1);
        expect(m.calls.createPipelineLayout).toHaveBeenCalledTimes(1);
        expect(m.calls.createShaderModule).toHaveBeenCalledTimes(1);
        expect(m.calls.createRenderPipeline).toHaveBeenCalledTimes(1);

        expect(built.bindGroupLayouts).toHaveLength(1);
        expect((built.bindGroupLayouts[0] as unknown as MockGpuBindGroupLayout).__mockKind).toBe(
            'bindGroupLayout'
        );
    });

    it('builds one BGL per depth for nested groups (indexed by depth)', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const tex = textureSlot('albedo', 'texture_2d<f32>');
        const samp = samplerSlot('samp', 'sampler');
        const material = group({ label: 'material' }, tex, samp);
        const frame = group({ label: 'frame' }, cam, material);
        const sh = shader([cameraStruct, cam, tex, samp]);
        const graph = bindings(frame, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const built = ctx.pipeline(graph, sh, mkColorPipelineState());

        expect(built.bindGroupLayouts).toHaveLength(2);
        // depth 0 has the uniform camera; depth 1 has texture + sampler
        const bgl0 = m.created.bindGroupLayouts[0];
        const bgl1 = m.created.bindGroupLayouts[1];
        expect(bgl0?.descriptor.entries).toHaveLength(1);
        expect(bgl1?.descriptor.entries).toHaveLength(2);
    });

    it('emits an empty BGL at intermediate depths the shader does not use', () => {
        // Build a 3-level group hierarchy but the shader only references depth 0 and depth 2.
        const a = uniformSlot('a', cameraStruct);
        const skipFiller = uniformSlot('skip', cameraStruct);
        const c = uniformSlot('c', cameraStruct);
        const g2 = group(c);
        const g1 = group(skipFiller, g2);
        const g0 = group(a, g1);

        const sh = shader([cameraStruct, a, c]); // declares depths 0 and 2 only
        const graph = bindings(g0, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const built = ctx.pipeline(graph, sh, mkColorPipelineState());

        expect(built.bindGroupLayouts).toHaveLength(3);
        expect(m.created.bindGroupLayouts[0]?.descriptor.entries).toHaveLength(1);
        expect(m.created.bindGroupLayouts[1]?.descriptor.entries).toHaveLength(0); // empty middle
        expect(m.created.bindGroupLayouts[2]?.descriptor.entries).toHaveLength(1);
    });

    it('builds a fragment-less pipeline when state.fragment is absent', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        ctx.pipeline(graph, sh, { primitive: { topology: 'triangle-list' } });

        const desc = m.created.renderPipelines[0]?.descriptor;
        expect(desc?.fragment).toBeUndefined();
        expect(desc?.vertex.entryPoint).toBe('vs_main');
    });

    it('defaults entry points to vs_main and fs_main', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        ctx.pipeline(graph, sh, mkColorPipelineState());

        const desc = m.created.renderPipelines[0]?.descriptor;
        expect(desc?.vertex.entryPoint).toBe('vs_main');
        expect(desc?.fragment?.entryPoint).toBe('fs_main');
    });

    it('honours explicit entry-point overrides', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        ctx.pipeline(graph, sh, {
            vertex: { entryPoint: 'my_vs' },
            fragment: { entryPoint: 'my_fs', targets: [{ format: 'bgra8unorm' }] },
        });

        const desc = m.created.renderPipelines[0]?.descriptor;
        expect(desc?.vertex.entryPoint).toBe('my_vs');
        expect(desc?.fragment?.entryPoint).toBe('my_fs');
    });
});

describe('RenderingContext.pipeline() — WGSL + reflection', () => {
    it('feeds asSource(bindShader(...)) to createShaderModule', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        ctx.pipeline(graph, sh, mkColorPipelineState());

        // The WGSL fed to createShaderModule should contain the resolved binding annotation —
        // i.e. bindShader ran before asSource. Slot 'camera' lives in group 0 binding 0.
        const moduleDesc = m.created.shaderModules[0]?.descriptor;
        expect(moduleDesc?.code).toContain('@group(0) @binding(0)');
        expect(moduleDesc?.code).toContain('camera');
    });

    it('slotIndex matches resolveShaderBindings output', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const built = ctx.pipeline(graph, sh, mkColorPipelineState());

        const expected = resolveShaderBindings(graph, sh);
        expect([...built.slotIndex.entries()]).toEqual([...expected.entries()]);
    });

    it('populates defs from makeShaderDataDefinitions', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const built = ctx.pipeline(graph, sh, mkColorPipelineState());

        // ShaderDataDefinitions exposes structs and uniforms; webgpu-utils picks them up from
        // the WGSL source. Exact field names depend on the library, so just smoke-check shape.
        expect(built.defs).toBeDefined();
        expect(built.defs.structs).toBeDefined();
        expect(built.defs.uniforms).toBeDefined();
    });
});

describe('RenderingContext.pipeline() — visibility resolution', () => {
    it('uses slot.visibility when explicitly set', () => {
        const cam = uniformSlot('camera', cameraStruct, { visibility: ShaderStageFlag.VERTEX });
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        ctx.pipeline(graph, sh, mkColorPipelineState());

        const entry = m.created.bindGroupLayouts[0]?.descriptor.entries[0];
        expect(entry?.visibility).toBe(ShaderStageFlag.VERTEX);
    });

    it('defaults visibility to VERTEX | FRAGMENT when slot does not declare', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        ctx.pipeline(graph, sh, mkColorPipelineState());

        const entry = m.created.bindGroupLayouts[0]?.descriptor.entries[0];
        expect(entry?.visibility).toBe(ShaderStageFlag.VERTEX | ShaderStageFlag.FRAGMENT);
    });
});

describe('RenderingContext.pipeline() — error propagation', () => {
    it('propagates createRenderPipeline errors', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        m.calls.createRenderPipeline.mockImplementationOnce(() => {
            throw new Error('boom');
        });

        const ctx = renderingContext({ device: m.device });
        expect(() => ctx.pipeline(graph, sh, mkColorPipelineState())).toThrow(/boom/);
    });

    it('throws on malformed PipelineStateDescriptor (Zod)', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        expect(() =>
            ctx.pipeline(
                graph,
                sh,
                // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid input
                { primitive: { topology: 'bogus' } } as any
            )
        ).toThrow();
    });
});

describe('RenderingContext.pipeline() — descriptor composition', () => {
    it('wires the pipeline layout from the produced BGLs in depth order', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const tex = textureSlot('albedo', 'texture_2d<f32>');
        const material = group(tex);
        const frame = group(cam, material);
        const sh = shader([cameraStruct, cam, tex]);
        const graph = bindings(frame, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        ctx.pipeline(graph, sh, mkColorPipelineState('p'));

        const layoutDesc = m.created.pipelineLayouts[0]?.descriptor;
        expect(layoutDesc?.bindGroupLayouts).toHaveLength(2);
        expect(layoutDesc?.bindGroupLayouts[0]).toBe(m.created.bindGroupLayouts[0]);
        expect(layoutDesc?.bindGroupLayouts[1]).toBe(m.created.bindGroupLayouts[1]);
    });

    it('forwards primitive / depthStencil / multisample / label to the descriptor', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        ctx.pipeline(graph, sh, {
            label: 'p',
            primitive: { topology: 'line-strip', cullMode: 'none' },
            depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
            multisample: { count: 4 },
            fragment: minimalFragmentState,
        });
        const desc = m.created.renderPipelines[0]?.descriptor as GPURenderPipelineDescriptor & {
            label?: string;
        };
        expect(desc.label).toBe('p');
        expect(desc.primitive?.topology).toBe('line-strip');
        expect(desc.depthStencil?.format).toBe('depth24plus');
        expect(desc.multisample?.count).toBe(4);
    });

    it('returns a frozen BuiltPipeline', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const built = ctx.pipeline(graph, sh, mkColorPipelineState());
        expect(Object.isFrozen(built)).toBe(true);
        expect(built.shader).toBe(sh);
        expect((built.gpu as unknown as MockGpuRenderPipeline).__mockKind).toBe('renderPipeline');
    });
});

describe('RenderingContext.pipeline() — cache', () => {
    it('returns the same BuiltPipeline instance for identical inputs', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);
        const state = mkColorPipelineState('p');

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const a = ctx.pipeline(graph, sh, state);
        const b = ctx.pipeline(graph, sh, state);
        expect(a).toBe(b);
        expect(m.calls.createRenderPipeline).toHaveBeenCalledTimes(1);
        expect(m.calls.createBindGroupLayout).toHaveBeenCalledTimes(1);
        expect(m.calls.createShaderModule).toHaveBeenCalledTimes(1);
    });

    it('caches across key-equivalent state objects (key-order independence)', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const a = ctx.pipeline(graph, sh, {
            primitive: { topology: 'triangle-list', cullMode: 'back' },
            fragment: minimalFragmentState,
        });
        const b = ctx.pipeline(graph, sh, {
            fragment: minimalFragmentState,
            primitive: { cullMode: 'back', topology: 'triangle-list' },
        });
        expect(a).toBe(b);
        expect(m.calls.createRenderPipeline).toHaveBeenCalledTimes(1);
    });

    it('produces distinct instances for differing state', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const a = ctx.pipeline(graph, sh, {
            primitive: { topology: 'triangle-list' },
            fragment: minimalFragmentState,
        });
        const b = ctx.pipeline(graph, sh, {
            primitive: { topology: 'line-list' },
            fragment: minimalFragmentState,
        });
        expect(a).not.toBe(b);
        expect(a.fingerprint).not.toBe(b.fingerprint);
        expect(m.calls.createRenderPipeline).toHaveBeenCalledTimes(2);
    });

    it('isolates cache per-RenderingContext instance (two contexts → distinct instances)', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);
        const state = mkColorPipelineState();

        // Two contexts against the same device — each gets its own cache.
        const m = makeMockDevice();
        const ctx1 = renderingContext({ device: m.device, label: 'ctx1' });
        const ctx2 = renderingContext({ device: m.device, label: 'ctx2' });
        const a = ctx1.pipeline(graph, sh, state);
        const b = ctx2.pipeline(graph, sh, state);
        expect(a).not.toBe(b);
        expect(a.fingerprint).toBe(b.fingerprint); // same content → same fingerprint
        expect(m.calls.createRenderPipeline).toHaveBeenCalledTimes(2);
        expect(ctx1.pipelineCount).toBe(1);
        expect(ctx2.pipelineCount).toBe(1);
    });

    it('populates a real fingerprint (not the 3b placeholder)', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device });
        const built = ctx.pipeline(graph, sh, mkColorPipelineState());
        expect(built.fingerprint).not.toBe('pending');
        expect(built.fingerprint.startsWith('pl_')).toBe(true);
    });

    it('dispose() clears the cache; subsequent pipeline() throws with the context label', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const ctx = renderingContext({ device: m.device, label: 'ctx-A' });
        ctx.pipeline(graph, sh, mkColorPipelineState());
        expect(ctx.pipelineCount).toBe(1);

        ctx.dispose();
        expect(ctx.pipelineCount).toBe(0);
        expect(ctx.disposed).toBe(true);
        expect(() => ctx.pipeline(graph, sh, mkColorPipelineState())).toThrow(/ctx-A/);
        expect(() => ctx.pipeline(graph, sh, mkColorPipelineState())).toThrow(
            /use-after-dispose/
        );
    });
});
