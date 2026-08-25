export type ScalarType = 'f32' | 'u32' | 'i32';
export type Abbr = 'f' | 'u' | 'i';
export type VLen = 2 | 3 | 4;
export type VectorType<S extends VLen> = `vec${S}${Abbr}`;
export type WgslType = ScalarType | VectorType<2> | VectorType<3> | VectorType<4>;
export type alpha =
    | 'a'
    | 'b'
    | 'c'
    | 'd'
    | 'e'
    | 'f'
    | 'g'
    | 'h'
    | 'i'
    | 'j'
    | 'k'
    | 'l'
    | 'm'
    | 'n'
    | 'o'
    | 'p'
    | 'q'
    | 'r'
    | 's'
    | 't'
    | 'u'
    | 'v'
    | 'w'
    | 'x'
    | 'y'
    | 'z';
type letter = alpha | Capitalize<alpha>;
type justLetters<S extends string> = S extends `${letter}${infer R extends string}`
    ? justLetters<R> extends true
        ? true
        : false
    : S extends ''
      ? true
      : false;
export type onlyLetters<S extends `${alpha}${string}`> = justLetters<S> extends true ? S : never;
export type ITable = { [field: string]: WgslType };

export type BTable<T extends ITable, B> = {
    [field in keyof T]: B;
};

export type Tables = { [table: string]: ITable };
export type BufferTables<Ts extends Tables> = {
    [k in keyof Ts]: {
        [c in keyof Ts[k]]: GPUBuffer;
    };
};
export type vKeys<T extends ITable, F extends keyof ITable> = F extends string
    ? T[F] extends `vec2${Abbr}`
        ? Record<`${F}.${'x' | 'y'}`, Cmp<T[F]>>
        : T[F] extends `vec3${Abbr}`
          ? Record<`${F}.${'x' | 'y' | 'z'}`, Cmp<T[F]>>
          : T[F] extends `vec4${Abbr}`
            ? Record<`${F}.${'x' | 'y' | 'z' | 'w'}`, Cmp<T[F]>>
            : T
    : T;

export type ArrayBufferTables<Ts extends Tables> = {
    [k in keyof Ts]: {
        [c in keyof Ts[k]]: {
            buffer: ArrayBuffer;
        };
    };
};
export type Elem<T> = T extends ReadonlyArray<infer E> ? E : never;
export const OPS = ['==', '>', '>=', '<', '<=', '!='] as const;
export type OP = Elem<typeof OPS>;
export type VOP = `${'any' | 'all'}(${OP})`;

export type FType<T extends ITable, K extends keyof T> = T[K];

// a ts type for the wgsl type...
export type TSVec<WT> =
    WT extends VectorType<infer S>
        ? S extends 2
            ? [number, number]
            : S extends 3
              ? [number, number, number]
              : S extends 4
                ? [number, number, number, number]
                : never
        : never;
export type TsType<WT> = WT extends ScalarType ? number : TSVec<WT>;

export type Swizzled = `${string}.${'x' | 'y' | 'z' | 'w'}`;

export type SwizzledField<F extends string> = `${F}.${'x' | 'y' | 'z' | 'w'}`;

// so this is getting really annoying - it might be time to try the builder pattern here, too
export type Swizzle<S extends VLen> = S extends 2 ? 'x' | 'y' : S extends 3 ? 'x' | 'y' | 'z' : 'x' | 'y' | 'z' | 'w';

export type SwizzleIndexExpr<
    Ts extends Tables,
    From extends keyof Ts,
    Field extends keyof Ts[From],
> = Field extends string
    ? FType<Ts[From], Field> extends `vec${infer S extends VLen}u`
        ? `${Field}.${Swizzle<S>}`
        : FType<Ts[From], Field> extends 'u32'
          ? `${Field}`
          : never
    : never;

export type SwizzleExpr<Ts extends Tables, From extends keyof Ts, Field extends keyof Ts[From]> = Field extends string
    ? FType<Ts[From], Field> extends VectorType<infer S>
        ? `${Field}.${Swizzle<S>}` | `${Field}`
        : FType<Ts[From], Field> extends ScalarType
          ? `${Field}`
          : never
    : never;

// FType doesnt know about swizzle...

export type ComponentType<
    Ts extends Tables,
    Other extends keyof Ts,
    Field extends keyof Ts[Other],
    OE extends SwizzleExpr<Ts, Other, Field>,
> = Field extends string ? (OE extends SwizzledField<Field> ? FType<Ts[Other], Field> : FType<Ts[Other], OE>) : never;
// not sure why - but componentType goes super banans for simpler, non-index-style expressions... use Cmp instead
export type Cmp<V extends WgslType> = V extends `vec${infer S}${infer A extends Abbr}` ? `${A}32` : never;
// }
// any expr that resolves to a u32 type?
export type IndexExpr<Table, Field extends string, T> = {
    kind: 'table at field';
    table: Table;
    atExpr: IndexExpr<string, string, 'u32'> | string;
    field: Field;
    type: T;
};
export type ColumnExpr<From, Field extends string | '$index', T> = {
    kind: 'from field';
    from: From;
    field: Field;
    type: T;
};
export type PExpr<P extends `${alpha}${string}`> = {
    kind: 'predicate';
    lhs: IndexExpr<string, string, WgslType> | ColumnExpr<string, string, WgslType>;
    op: OP | VOP;
    rhs: P;
};
export type AST =
    | ColumnExpr<string, string, WgslType>
    | IndexExpr<string, string, WgslType>
    | PExpr<`${alpha}${string}`>;

export type Sel = { selection: string; type: WgslType };
export type RunFilterArgs<Ts extends Tables> = {
    parameters: GPUBuffer;
    sets: {
        resultCounter: GPUBuffer;
        rowCount: number;
        tables: BufferTables<Ts>;
        results: GPUBuffer;
    }[];
    enc: GPUCommandEncoder;
    timestampWrites?: GPUComputePassTimestampWrites;
};

export type RunIndexedFilterArgs<Ts extends Tables> = {
    parameters: GPUBuffer;
    sets: {
        resultCounter: GPUBuffer;
        rowCount: number;
        elements: GPUBuffer;
        tables: BufferTables<Ts>;
        results: GPUBuffer;
    }[];
    enc: GPUCommandEncoder;
    timestampWrites?: GPUComputePassTimestampWrites;
};
