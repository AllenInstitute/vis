import { describe, expect, it } from 'vitest';
import { uniformSlot } from '../../resources';
import { member, shader, struct } from '../../shaders';
import { bindings, group } from './binding-graph';
import { pipelineFingerprint } from './fingerprint';
import { normalizePipelineState, type PipelineStateDescriptor } from './pipeline-state';
import { resolveShaderBindings } from './traverse';

const camStruct = struct('Camera', [member('view', 'mat4x4f'), member('proj', 'mat4x4f')]);

function setup() {
    const cam = uniformSlot('camera', camStruct);
    const root = group(cam);
    const sh = shader([camStruct, cam]);
    const graph = bindings(root, sh);
    return { sh, graph, slotIndex: resolveShaderBindings(graph, sh) };
}

describe('pipelineFingerprint()', () => {
    it('produces identical fingerprints for identical inputs', () => {
        const { sh, slotIndex } = setup();
        const state = normalizePipelineState({ primitive: { topology: 'triangle-list' } });
        const a = pipelineFingerprint(sh, slotIndex, state);
        const b = pipelineFingerprint(sh, slotIndex, state);
        expect(a).toBe(b);
        expect(a.startsWith('pl_')).toBe(true);
    });

    it('changes when shader.id differs', () => {
        const a = setup();
        const b = setup();
        // Two distinct calls to shader() produce different uuid ids → different fingerprints.
        const state = normalizePipelineState({});
        expect(pipelineFingerprint(a.sh, a.slotIndex, state)).not.toBe(pipelineFingerprint(b.sh, b.slotIndex, state));
    });

    it('changes when slot binding indices differ', () => {
        const { sh } = setup();
        const state = normalizePipelineState({});
        // Build two different slot-index maps for the same shader.id.
        const slot = uniformSlot('slot', camStruct);
        const slotIndexA = new Map([[slot, { group: 0, binding: 0 }]]);
        const slotIndexB = new Map([[slot, { group: 0, binding: 1 }]]);
        expect(pipelineFingerprint(sh, slotIndexA, state)).not.toBe(pipelineFingerprint(sh, slotIndexB, state));
    });

    it('changes when any state field differs', () => {
        const { sh, slotIndex } = setup();
        const a = pipelineFingerprint(
            sh,
            slotIndex,
            normalizePipelineState({ primitive: { topology: 'triangle-list' } })
        );
        const b = pipelineFingerprint(sh, slotIndex, normalizePipelineState({ primitive: { topology: 'line-list' } }));
        expect(a).not.toBe(b);
    });

    it('is invariant to state key order (delegated to normalize)', () => {
        const { sh, slotIndex } = setup();
        const stateA: PipelineStateDescriptor = {
            primitive: { topology: 'triangle-list', cullMode: 'back' },
            multisample: { count: 4 },
        };
        const stateB: PipelineStateDescriptor = {
            multisample: { count: 4 },
            primitive: { cullMode: 'back', topology: 'triangle-list' },
        };
        expect(pipelineFingerprint(sh, slotIndex, normalizePipelineState(stateA))).toBe(
            pipelineFingerprint(sh, slotIndex, normalizePipelineState(stateB))
        );
    });

    it('changes when entry point names differ (via normalize)', () => {
        const { sh, slotIndex } = setup();
        const a = pipelineFingerprint(sh, slotIndex, normalizePipelineState({ vertex: { entryPoint: 'a' } }));
        const b = pipelineFingerprint(sh, slotIndex, normalizePipelineState({ vertex: { entryPoint: 'b' } }));
        expect(a).not.toBe(b);
    });
});
