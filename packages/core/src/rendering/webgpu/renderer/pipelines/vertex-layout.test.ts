import { describe, expect, it } from 'vitest';
import { defaultVertexFormat, location, member, param, shader, struct, VERTEX_FORMAT_INFO, vertexInput } from '../../shaders';
import { pipelineFingerprint } from './fingerprint';
import { normalizePipelineState } from './pipeline-state';
import {
    buffer,
    deriveVertexBufferLayouts,
    interleaveVertexBuffer,
    packVertexBuffer,
    vertexLayout,
} from './vertex-layout';

// ---- shared fixtures --------------------------------------------------------------------------

/** position (vec3f, loc 0) + color (vec4f, loc 1). */
function posColorInput() {
    return vertexInput([
        struct('VertexIn', [
            member('position', 'vec3f', [location(0)]),
            member('color', 'vec4f', [location(1)]),
        ]),
    ]);
}

describe('vertex-format defaults', () => {
    it('maps WGSL types to their natural full-precision format', () => {
        expect(defaultVertexFormat('vec3f')).toBe('float32x3');
        expect(defaultVertexFormat('f32')).toBe('float32');
        expect(defaultVertexFormat('vec2u')).toBe('uint32x2');
        expect(defaultVertexFormat('vec4i')).toBe('sint32x4');
        expect(defaultVertexFormat('vec2h')).toBe('float16x2');
    });

    it('has no default for types with no matching format (e.g. vec3h)', () => {
        expect(defaultVertexFormat('vec3h')).toBeUndefined();
    });

    it('format metadata stays intact after the module move', () => {
        expect(VERTEX_FORMAT_INFO.unorm8x4.wgslType).toBe('vec4f');
        expect(VERTEX_FORMAT_INFO.float32x3.byteSize).toBe(12);
    });
});

describe('vertexLayout — single interleaved buffer with defaulted formats', () => {
    it('defaults each attribute format from its WGSL type and packs tightly', () => {
        const vin = posColorInput();
        const layout = vertexLayout(vin, [buffer('vertex', [0, 1])]);
        expect(deriveVertexBufferLayouts(layout)).toEqual([
            {
                arrayStride: 28, // vec3f(12) + vec4f(16)
                attributes: [
                    { format: 'float32x3', offset: 0, shaderLocation: 0 },
                    { format: 'float32x4', offset: 12, shaderLocation: 1 },
                ],
            },
        ]);
    });

    it('honors a per-attribute format override compatible with the WGSL type', () => {
        const vin = posColorInput();
        // color is vec4f in-shader but unorm8x4 on the wire.
        const layout = vertexLayout(vin, [buffer('vertex', [0, [1, 'unorm8x4']])]);
        expect(deriveVertexBufferLayouts(layout)).toEqual([
            {
                arrayStride: 16, // vec3f(12) + unorm8x4(4)
                attributes: [
                    { format: 'float32x3', offset: 0, shaderLocation: 0 },
                    { format: 'unorm8x4', offset: 12, shaderLocation: 1 },
                ],
            },
        ]);
    });
});

describe('vertexLayout — multi-buffer + instancing', () => {
    it('emits one layout per buffer, stepMode only for instance buffers', () => {
        const vin = vertexInput([
            struct('Geo', [member('position', 'vec3f', [location(0)])]),
            param('offset', 'vec3f', [location(1)]),
            param('tint', 'vec4f', [location(2)]),
        ]);
        const layout = vertexLayout(vin, [
            buffer('vertex', [0]),
            buffer('instance', [1, [2, 'unorm8x4']]),
        ]);
        expect(deriveVertexBufferLayouts(layout)).toEqual([
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
    });
});

describe('vertexLayout — validation', () => {
    it('throws when an interface attribute is left unassigned', () => {
        const vin = posColorInput();
        expect(() => vertexLayout(vin, [buffer('vertex', [0])])).toThrow(
            /@location\(1\) \('color'\) is not assigned/
        );
    });

    it('throws when a location is placed in more than one buffer', () => {
        const vin = posColorInput();
        expect(() =>
            vertexLayout(vin, [buffer('vertex', [0, 1]), buffer('instance', [1])])
        ).toThrow(/assigned to more than one buffer/);
    });

    it('throws when referencing a location not in the interface', () => {
        const vin = posColorInput();
        expect(() => vertexLayout(vin, [buffer('vertex', [0, 1, 9])])).toThrow(
            /@location\(9\) is not declared/
        );
    });

    it('throws when an override format is WGSL-type-incompatible', () => {
        const vin = posColorInput();
        // position is vec3f; unorm8x4 presents as vec4f → mismatch.
        expect(() => vertexLayout(vin, [buffer('vertex', [[0, 'unorm8x4'], 1])])).toThrow(
            /presents as WGSL 'vec4f' but the input declares 'vec3f'/
        );
    });

    it('throws when a WGSL type has no default format and none is given', () => {
        const vin = vertexInput([param('half3', 'vec3h', [location(0)])]);
        expect(() => vertexLayout(vin, [buffer('vertex', [0])])).toThrow(
            /no default GPUVertexFormat for WGSL type 'vec3h'/
        );
    });
});

describe('pipeline-state integration', () => {
    const vin = posColorInput();
    const handWritten = {
        arrayStride: 28,
        attributes: [
            { format: 'float32x3' as const, offset: 0, shaderLocation: 0 },
            { format: 'float32x4' as const, offset: 12, shaderLocation: 1 },
        ],
    };

    it('normalizes a declared layout to the same buffers as the hand-written form', () => {
        const declared = normalizePipelineState({
            vertex: { layout: vertexLayout(vin, [buffer('vertex', [0, 1])]) },
        });
        const manual = normalizePipelineState({ vertex: { buffers: [handWritten] } });
        expect(declared.vertex.buffers).toEqual(manual.vertex.buffers);
    });

    it('produces an identical pipeline fingerprint to the hand-written buffers', () => {
        const sh = shader([]);
        const slots = new Map();
        const declared = pipelineFingerprint(
            sh,
            slots,
            normalizePipelineState({ vertex: { layout: vertexLayout(vin, [buffer('vertex', [0, 1])]) } })
        );
        const manual = pipelineFingerprint(
            sh,
            slots,
            normalizePipelineState({ vertex: { buffers: [handWritten] } })
        );
        expect(declared).toBe(manual);
    });
});

describe('interleaveVertexBuffer — typed packing', () => {
    it('interleaves float + normalized attributes at derived offsets/stride', () => {
        const vin = posColorInput();
        const layout = vertexLayout(vin, [buffer('vertex', [0, [1, 'unorm8x4']])]);
        const [buf] = layout.buffers;
        if (buf === undefined) throw new Error('unreachable');

        const bytes = interleaveVertexBuffer(buf, {
            position: [1, 2, 3, 4, 5, 6], // 2 vertices
            color: [255, 0, 0, 255, 0, 255, 0, 255],
        });
        expect(bytes.byteLength).toBe(32); // 2 * stride 16
        const dv = new DataView(bytes);
        expect(dv.getFloat32(0, true)).toBe(1);
        expect(dv.getUint8(12)).toBe(255);
        expect(dv.getFloat32(16, true)).toBe(4);
        expect(dv.getUint8(29)).toBe(255);
    });

    it('throws when attributes disagree on vertex count', () => {
        const vin = posColorInput();
        const layout = vertexLayout(vin, [buffer('vertex', [0, 1])]);
        const [buf] = layout.buffers;
        if (buf === undefined) throw new Error('unreachable');
        expect(() =>
            interleaveVertexBuffer(buf, { position: [1, 2, 3], color: [1, 2, 3, 4, 5, 6, 7, 8] })
        ).toThrow(/share a vertex count/);
    });

    it('packVertexBuffer rejects an empty buffer', () => {
        expect(() => packVertexBuffer({ stepMode: 'vertex', attributes: [] })).toThrow(
            /at least one attribute/
        );
    });
});
