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
});
