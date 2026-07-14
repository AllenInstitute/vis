import { describe, expect, it } from 'vitest';
import {
    align,
    type BlendSrcAttribute,
    blendSrc,
    builtin,
    compute,
    constAttr,
    type DiagnosticAttribute,
    diagnostic,
    fragment,
    type InterpolateAttribute,
    id,
    interpolate,
    invariant,
    location,
    mustUse,
    size,
    vertex,
    workgroupSize,
} from './attributes';

describe('align', () => {
    it.each([1, 2, 4, 8, 16, 256])('generates @align(%i) for valid power-of-2 input', (n) => {
        expect(align(n).__gen()).toBe(`@align(${n})`);
    });

    it.each([-1, 0, 3, 5, 6, 7, 12])('throws for non-power-of-2 or non-positive value %i', (n) => {
        expect(() => align(n)).toThrow();
    });
});

describe('blendSrc', () => {
    it('generates @blend_src(0)', () => {
        expect(blendSrc(0).__gen()).toBe('@blend_src(0)');
    });

    it('generates @blend_src(1)', () => {
        expect(blendSrc(1).__gen()).toBe('@blend_src(1)');
    });

    it('throws for an invalid blender source value', () => {
        expect(() => (blendSrc as (n: number) => BlendSrcAttribute)(2)).toThrow();
    });
});

describe('builtin', () => {
    it.each([
        'position',
        'vertex_index',
        'instance_index',
        'global_invocation_id',
        'local_invocation_id',
        'workgroup_id',
        'frag_depth',
        'sample_index',
        'sample_mask',
        'front_facing',
        'num_workgroups',
    ] as const)('generates @builtin(%s)', (name) => {
        expect(builtin(name).__gen()).toBe(`@builtin(${name})`);
    });

    it('throws for an invalid builtin name', () => {
        expect(() => builtin('not_a_builtin' as any)).toThrow();
    });
});

describe('constAttr', () => {
    it('generates @const', () => {
        expect(constAttr().__gen()).toBe('@const');
    });
});

describe('diagnostic', () => {
    it.each(['error', 'warning', 'info', 'off'] as const)('generates @diagnostic for severity "%s"', (severity) => {
        expect(diagnostic(severity, 'diagnostic message').__gen()).toBe(
            `@diagnostic(${severity}, "diagnostic message")`
        );
    });

    it('throws for an invalid severity', () => {
        expect(() =>
            (diagnostic as (severity: string, message: string) => DiagnosticAttribute)('critical', 'msg')
        ).toThrow();
    });

    it('throws for an empty message', () => {
        expect(() => diagnostic('error', '')).toThrow();
    });
});

describe('id', () => {
    it.each([0, 1, 42, 255])('generates @id(%i)', (n) => {
        expect(id(n).__gen()).toBe(`@id(${n})`);
    });

    it('throws for a negative id', () => {
        expect(() => id(-1)).toThrow();
    });
});

describe('interpolate', () => {
    it.each(['perspective', 'linear', 'flat'] as const)('generates @interpolate(%s) with type only', (type) => {
        expect(interpolate(type).__gen()).toBe(`@interpolate(${type})`);
    });

    it.each([
        ['perspective', 'center'],
        ['perspective', 'centroid'],
        ['perspective', 'sample'],
        ['flat', 'first'],
        ['flat', 'either'],
        ['linear', 'center'],
        ['linear', 'centroid'],
        ['linear', 'sample'],
    ] as const)('generates @interpolate(%s, %s) with sampling type', (type, sampling) => {
        expect(interpolate(type, sampling).__gen()).toBe(`@interpolate(${type}, ${sampling})`);
    });

    it('throws for an invalid interpolation type', () => {
        expect(() => (interpolate as (type: string, sampling?: string) => InterpolateAttribute)('bilinear')).toThrow();
    });

    it('throws for an invalid sampling type', () => {
        expect(() =>
            (interpolate as (type: string, sampling?: string) => InterpolateAttribute)('perspective', 'nearest')
        ).toThrow();
    });
});

describe('invariant', () => {
    it('generates @invariant', () => {
        expect(invariant().__gen()).toBe('@invariant');
    });
});

describe('location', () => {
    it.each([0, 1, 5, 10])('generates @location(%i)', (n) => {
        expect(location(n).__gen()).toBe(`@location(${n})`);
    });

    it('throws for a negative location', () => {
        expect(() => location(-1)).toThrow();
    });
});

describe('mustUse', () => {
    it('generates @must_use', () => {
        expect(mustUse().__gen()).toBe('@must_use');
    });
});

describe('size', () => {
    it.each([1, 8, 16, 64])('generates @size(%i)', (n) => {
        expect(size(n).__gen()).toBe(`@size(${n})`);
    });

    it('throws for zero', () => {
        expect(() => size(0)).toThrow();
    });

    it('throws for a negative size', () => {
        expect(() => size(-4)).toThrow();
    });
});

describe('workgroupSize', () => {
    it('generates 1D workgroup_size', () => {
        expect(workgroupSize(64).__gen()).toBe('@workgroup_size(64)');
    });

    it('generates 2D workgroup_size', () => {
        expect(workgroupSize(8, 8).__gen()).toBe('@workgroup_size(8, 8)');
    });

    it('generates 3D workgroup_size', () => {
        expect(workgroupSize(4, 4, 4).__gen()).toBe('@workgroup_size(4, 4, 4)');
    });

    it('throws for a zero dimension', () => {
        expect(() => workgroupSize(0)).toThrow();
    });

    it('throws for a negative dimension', () => {
        expect(() => workgroupSize(4, -1)).toThrow();
    });
});

describe('vertex / fragment / compute stage attributes', () => {
    it('generates @vertex', () => {
        expect(vertex().__gen()).toBe('@vertex');
    });

    it('generates @fragment', () => {
        expect(fragment().__gen()).toBe('@fragment');
    });

    it('generates @compute', () => {
        expect(compute().__gen()).toBe('@compute');
    });
});
