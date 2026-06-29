import { describe, expect, it } from 'vitest';
import { ShaderStageFlag } from '../native-types';
import { samplerSlot, textureSlot, uniformSlot } from '../resources';
import { member, shader, struct } from '../shaders';
import type { MockGpuBindGroupLayout, MockGpuRenderPipeline } from '../test/mock-device';
import { makeMockDevice } from '../test/mock-device';
import { bindings, group } from './binding-graph';
import { pipeline } from './build';
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

describe('pipeline() — happy path', () => {
    it('creates one BGL per group depth, one pipeline layout, one shader module, one pipeline', () => {
        const camera = uniformSlot('camera', cameraStruct);
        const root = group({ label: 'frame' }, camera);
        const sh = shader([cameraStruct, camera]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const built = pipeline(graph, sh, mkColorPipelineState('p'), m.device);

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
        const built = pipeline(graph, sh, mkColorPipelineState(), m.device);

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
        const built = pipeline(graph, sh, mkColorPipelineState(), m.device);

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
        pipeline(graph, sh, { primitive: { topology: 'triangle-list' } }, m.device);

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
        pipeline(graph, sh, mkColorPipelineState(), m.device);

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
        pipeline(
            graph,
            sh,
            {
                vertex: { entryPoint: 'my_vs' },
                fragment: { entryPoint: 'my_fs', targets: [{ format: 'bgra8unorm' }] },
            },
            m.device
        );

        const desc = m.created.renderPipelines[0]?.descriptor;
        expect(desc?.vertex.entryPoint).toBe('my_vs');
        expect(desc?.fragment?.entryPoint).toBe('my_fs');
    });
});

describe('pipeline() — WGSL + reflection', () => {
    it('feeds asSource(bindShader(...)) to createShaderModule', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        pipeline(graph, sh, mkColorPipelineState(), m.device);

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
        const built = pipeline(graph, sh, mkColorPipelineState(), m.device);

        const expected = resolveShaderBindings(graph, sh);
        expect([...built.slotIndex.entries()]).toEqual([...expected.entries()]);
    });

    it('populates defs from makeShaderDataDefinitions', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const built = pipeline(graph, sh, mkColorPipelineState(), m.device);

        // ShaderDataDefinitions exposes structs and uniforms; webgpu-utils picks them up from
        // the WGSL source. Exact field names depend on the library, so just smoke-check shape.
        expect(built.defs).toBeDefined();
        expect(built.defs.structs).toBeDefined();
        expect(built.defs.uniforms).toBeDefined();
    });
});

describe('pipeline() — visibility resolution', () => {
    it('uses slot.visibility when explicitly set', () => {
        const cam = uniformSlot('camera', cameraStruct, { visibility: ShaderStageFlag.VERTEX });
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        pipeline(graph, sh, mkColorPipelineState(), m.device);

        const entry = m.created.bindGroupLayouts[0]?.descriptor.entries[0];
        expect(entry?.visibility).toBe(ShaderStageFlag.VERTEX);
    });

    it('defaults visibility to VERTEX | FRAGMENT when slot does not declare', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        pipeline(graph, sh, mkColorPipelineState(), m.device);

        const entry = m.created.bindGroupLayouts[0]?.descriptor.entries[0];
        expect(entry?.visibility).toBe(ShaderStageFlag.VERTEX | ShaderStageFlag.FRAGMENT);
    });
});

describe('pipeline() — error propagation', () => {
    it('propagates createRenderPipeline errors', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        m.calls.createRenderPipeline.mockImplementationOnce(() => {
            throw new Error('boom');
        });

        expect(() => pipeline(graph, sh, mkColorPipelineState(), m.device)).toThrow(/boom/);
    });

    it('throws on malformed PipelineStateDescriptor (Zod)', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        expect(() =>
            pipeline(
                graph,
                sh,
                // biome-ignore lint/suspicious/noExplicitAny: deliberate invalid input
                { primitive: { topology: 'bogus' } } as any,
                m.device
            )
        ).toThrow();
    });
});

describe('pipeline() — descriptor composition', () => {
    it('wires the pipeline layout from the produced BGLs in depth order', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const tex = textureSlot('albedo', 'texture_2d<f32>');
        const material = group(tex);
        const frame = group(cam, material);
        const sh = shader([cameraStruct, cam, tex]);
        const graph = bindings(frame, sh);

        const m = makeMockDevice();
        pipeline(graph, sh, mkColorPipelineState('p'), m.device);

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
        pipeline(
            graph,
            sh,
            {
                label: 'p',
                primitive: { topology: 'line-strip', cullMode: 'none' },
                depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
                multisample: { count: 4 },
                fragment: minimalFragmentState,
            },
            m.device
        );
        const desc = m.created.renderPipelines[0]?.descriptor as GPURenderPipelineDescriptor &
            { label?: string };
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
        const built = pipeline(graph, sh, mkColorPipelineState(), m.device);
        expect(Object.isFrozen(built)).toBe(true);
        expect(built.shader).toBe(sh);
        expect((built.gpu as unknown as MockGpuRenderPipeline).__mockKind).toBe('renderPipeline');
    });
});

describe('pipeline() — cache (Slice 3c)', () => {
    it('returns the same BuiltPipeline instance for identical inputs', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);
        const state = mkColorPipelineState('p');

        const m = makeMockDevice();
        const a = pipeline(graph, sh, state, m.device);
        const b = pipeline(graph, sh, state, m.device);
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
        const a = pipeline(
            graph,
            sh,
            {
                primitive: { topology: 'triangle-list', cullMode: 'back' },
                fragment: minimalFragmentState,
            },
            m.device
        );
        const b = pipeline(
            graph,
            sh,
            {
                fragment: minimalFragmentState,
                primitive: { cullMode: 'back', topology: 'triangle-list' },
            },
            m.device
        );
        expect(a).toBe(b);
        expect(m.calls.createRenderPipeline).toHaveBeenCalledTimes(1);
    });

    it('produces distinct instances for differing state', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const a = pipeline(
            graph,
            sh,
            { primitive: { topology: 'triangle-list' }, fragment: minimalFragmentState },
            m.device
        );
        const b = pipeline(
            graph,
            sh,
            { primitive: { topology: 'line-list' }, fragment: minimalFragmentState },
            m.device
        );
        expect(a).not.toBe(b);
        expect(a.fingerprint).not.toBe(b.fingerprint);
        expect(m.calls.createRenderPipeline).toHaveBeenCalledTimes(2);
    });

    it('isolates cache per-device (different device → different instance)', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);
        const state = mkColorPipelineState();

        const m1 = makeMockDevice();
        const m2 = makeMockDevice();
        const a = pipeline(graph, sh, state, m1.device);
        const b = pipeline(graph, sh, state, m2.device);
        expect(a).not.toBe(b);
        expect(m1.calls.createRenderPipeline).toHaveBeenCalledTimes(1);
        expect(m2.calls.createRenderPipeline).toHaveBeenCalledTimes(1);
    });

    it('populates a real fingerprint (not the 3b placeholder)', () => {
        const cam = uniformSlot('camera', cameraStruct);
        const root = group(cam);
        const sh = shader([cameraStruct, cam]);
        const graph = bindings(root, sh);

        const m = makeMockDevice();
        const built = pipeline(graph, sh, mkColorPipelineState(), m.device);
        expect(built.fingerprint).not.toBe('pending');
        expect(built.fingerprint.startsWith('pl_')).toBe(true);
    });
});
