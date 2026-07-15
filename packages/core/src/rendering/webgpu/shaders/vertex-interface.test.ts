import { describe, expect, it } from 'vitest';
import { builtin, location } from './attributes';
import { member, param, returns, struct } from './declarations';
import { vertexInput } from './vertex-interface';

const VertexIn = struct('VertexIn', [
    member('position', 'vec3f', [location(0)]),
    member('color', 'vec4f', [location(1)]),
]);

describe('vertexInput — mixed interface', () => {
    it('classifies struct members, loose @location params, and builtins', () => {
        const vin = vertexInput([
            VertexIn,
            param('instanceOffset', 'vec3f', [location(2)]),
            param('vertIdx', 'u32', [builtin('vertex_index')]),
        ]);

        expect(vin.attributes).toEqual([
            { name: 'position', location: 0, wgslType: 'vec3f', struct: 'VertexIn' },
            { name: 'color', location: 1, wgslType: 'vec4f', struct: 'VertexIn' },
            { name: 'instanceOffset', location: 2, wgslType: 'vec3f' },
        ]);
        expect(vin.builtins).toEqual([{ name: 'vertIdx', builtin: 'vertex_index', wgslType: 'u32' }]);
        // The referenced struct is surfaced for top-level emission.
        expect(vin.structs).toEqual([VertexIn]);
    });

    it('feeds vertexEntry a signature containing the struct + loose params', () => {
        const vin = vertexInput([VertexIn, param('vertIdx', 'u32', [builtin('vertex_index')])]);
        const fn = vin.entry(
            'vs_main',
            () => 'return vec4f(0.0, 0.0, 0.0, 1.0);',
            returns('vec4f', [builtin('position')])
        );
        const src = fn.__gen();
        expect(src).toContain('@vertex');
        expect(src).toContain('fn vs_main(');
        expect(src).toContain(': VertexIn'); // struct param, auto-named
        expect(src).toContain('@builtin(vertex_index) vertIdx: u32');
        expect(src).toContain('-> @builtin(position) vec4f');
    });
});

describe('vertexInput — validation', () => {
    it('rejects a leaf with neither @location nor @builtin', () => {
        expect(() => vertexInput([param('bad', 'vec3f')])).toThrow(/neither @location nor @builtin/);
    });

    it('rejects a leaf with both @location and @builtin', () => {
        expect(() => vertexInput([param('bad', 'u32', [location(0), builtin('vertex_index')])])).toThrow(
            /both @location and @builtin/
        );
    });

    it('rejects a non-input builtin like position', () => {
        expect(() => vertexInput([param('p', 'vec4f', [builtin('position')])])).toThrow(
            /only vertex_index \/ instance_index/
        );
    });

    it('rejects duplicate @location across the whole interface (struct + loose param)', () => {
        const Dup = struct('Dup', [member('a', 'vec3f', [location(0)])]);
        expect(() => vertexInput([Dup, param('b', 'vec2f', [location(0)])])).toThrow(/duplicate @location\(0\)/);
    });

    it('aggregates multiple problems into one error', () => {
        expect(() => vertexInput([param('x', 'f32'), param('y', 'f32', [builtin('position')])])).toThrow(
            /neither @location[\s\S]*only vertex_index/
        );
    });
});
