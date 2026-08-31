import { describe, expect, test } from 'vitest';
import { given } from './query';

describe('expression building', () => {
    const tables = {
        cells: { A: 'vec2f', B: 'u32' },
        edges: { E: 'vec2u', str: 'f32' },
    } as const;
    const { column, table, clause } = given(tables).from('edges');

    test('indexing a table with a swizzled vector', () => {
        const f32 = table('cells').at('E.x').dot('A.y');
        const vec2f = table('cells').at('E.y').dot('A');
        expect(f32).toEqual({
            kind: 'table at field',
            table: 'cells',
            atExpr: 'E.x',
            field: 'A.y',
            type: 'f32',
        });
        expect(vec2f).toEqual({
            kind: 'table at field',
            table: 'cells',
            atExpr: 'E.y',
            field: 'A',
            type: 'vec2f',
        });
    });
    test('simple column reference', () => {
        const u32 = column('E.x');
        const f32 = column('str');
        expect(f32).toEqual({
            kind: 'from field',
            field: 'str',
            from: 'edges',
            type: 'f32',
        });
        expect(u32).toEqual({
            kind: 'from field',
            field: 'E.x',
            from: 'edges',
            type: 'u32',
        });
    });
    test('nested table index', () => {
        const fancy = table('cells').at(table('cells').at('E.x').dot('B')).dot('A.x');
        expect(fancy).toEqual({
            kind: 'table at field',
            table: 'cells',
            atExpr: {
                kind: 'table at field',
                table: 'cells',
                atExpr: 'E.x',
                field: 'B',
                type: 'u32',
            },
            field: 'A.x',
            type: 'f32',
        });
    });
    test('predicate', () => {
        const p = clause(table('cells').at('E.x').dot('A.y'), '==', 'stuff');
        expect(p.predicates).toHaveLength(1);
        expect(p.predicates[0]).toEqual({
            kind: 'predicate',
            lhs: {
                kind: 'table at field',
                table: 'cells',
                atExpr: 'E.x',
                field: 'A.y',
                type: 'f32',
            },
            op: '==',
            rhs: 'stuff',
        });
    });
    describe('aggregation shader', () => {
        const tables = {
            cells: { A: 'vec2f', B: 'u32' },
            edges: { E: 'vec2u', str: 'f32' },
        } as const;
        const { column, table, clause, groupBy } = given(tables).from('edges');
        test('sum edge strength, grouped by some categorical property on cells', () => {
            const mod = groupBy(table('cells').at('E.x').dot('B'), table('cells').at('E.y').dot('B'))
                .sum(column('str'), '$count', '$unused', '$unused')
                .shader();
            expect(mod.format).toEqual('rg32float');
            const lines = mod.code
                .split('\n')
                .map((s) => s.trim())
                .filter((s) => s !== '');
            const expected = `struct VsIn {
            @builtin(vertex_index) vIndex: u32,
            // delightfully, we dont need instancing! this is because 1px dots are completely fine in this scenaro! yay!
        };
        struct VsOut {
            @builtin(position) pos: vec4f,
            @location(0) @interpolate(flat) value:vec2f,
        };
        @group(0) @binding(0)
        var<uniform> outputDimensions: vec2u;

   //cells
  @group(1) @binding(1) var<storage,read> cells_A: array<vec2f>;
  @group(1) @binding(2) var<storage,read> cells_B: array<u32>;
   //edges
  @group(1) @binding(3) var<storage,read> edges_E: array<vec2u>;
  @group(1) @binding(4) var<storage,read> edges_str: array<f32>;
        @vertex
        fn vmain(v:VsIn)-> VsOut  {
            var out:VsOut;
            let element = v.vIndex;
            let row = cells_B[edges_E[element].y];
            let col = cells_B[edges_E[element].x];
            let size = outputDimensions;
            // convert the integer positions into output (clip) space:
            let pos = (vec2f(vec2u(col,row))+vec2f(0.5,0.5))/vec2f(size);
            // pos is now in unit space, relative to camera, coodinates at the center of pixels
            let clip = (pos*2.0)-1.0;
            // upside down please, to match texture memory origin, rather than 'screen origin'
            out.pos = vec4f(clip*vec2f(1.0,-1.0),0.5,1.0);
            // now gather the values that the blending-stage will aggregate:
            out.value = vec2f(f32(edges_str[element]),f32(1));
            return out;
        }
        @fragment
        fn fmain(v:VsOut) ->@location(0) vec2f {
            return v.value;
        }`;
            expect(lines).toEqual(
                expected
                    .split('\n')
                    .map((s) => s.trim())
                    .filter((s) => s !== '')
            );
        });
    });
});
