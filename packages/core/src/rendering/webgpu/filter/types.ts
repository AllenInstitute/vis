import * as wgh from 'webgpu-utils'
type LT = 'f32' | 'u32' | 'i32'
type Abbr = 'f' | 'u' | 'i'
type Short = 2 | 3 | 4
// type VT = `vec${Short}<${LT}>`
type VT<S extends Short> = `vec${S}${Abbr}`
export type FT = LT | VT<2> | VT<3> | VT<4>
type alpha = 'a' | 'b' | 'c' | 'd' | 'e' | 'f' | 'g' | 'h' | 'i' | 'j' | 'k' | 'l' | 'm' | 'n' | 'o' | 'p' | 'q' | 'r' | 's' | 't' | 'u' | 'v' | 'w' | 'x' | 'y' | 'z';
type letter = alpha | Capitalize<alpha>

export type ITable = { [field: string]: FT }
export type BufferTable<T extends ITable> = {
    [field in keyof T]: GPUBuffer
}

export type Tables = { [table: string]: ITable }
export type BufferTables<Ts extends Tables> = {
    [tbl in keyof Ts]: BufferTable<Ts[tbl]>
}

export type Elem<T> = T extends ReadonlyArray<infer E> ? E : never
export const OPS = ['==', '>', '>=', '<', '<=', '!='] as const
export type OP = Elem<typeof OPS>
// export const VOPS = ['==' , '!=' , 'any <' , 'any >' , 'all <' , 'all <']
export type VOP = `${'any' | 'all'}(${OP})`

export type FType<T extends ITable, K extends keyof T> = T[K]
export type VarName = `${letter}${string}`
// type Var<T extends VarName> = `$${T}`
// I want a type error if the op type is a vOp and either operand is not...
export type PredicateExpr<T extends ITable, K extends keyof T, Param extends VarName> = K extends string ?
    (FType<T, K> extends VT<infer N> ?
        `${K} ${VOP} ${Param}` :
        `${K} ${OP} ${Param}`)
    : never
export type IndexedReference<T extends ITable, Ti extends keyof T, Ts extends Tables, O extends keyof Ts, F extends keyof Ts[O]> =
    keyof T extends string ? O extends string ? F extends string ?
    Ti extends string ?
    FType<T, Ti> extends 'u32' ?
    keyof Ts[O] extends string ? `${O}[${keyof T}].${F}` :
    never : never : never : never : never : never;

export type IndexedPredicateExpr<T extends ITable, Ti extends keyof T, Ts extends Tables, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName> =
    keyof T extends string ? O extends string ? F extends string ?
    Ti extends string ?
    FType<T, Ti> extends 'u32' ?
  keyof Ts[O] extends string ?
  (FType<Ts[O], F> extends VT<infer N> ?
      `${O}[${keyof T}].${F} ${VOP} ${Param}` :
      `${O}[${keyof T}].${F} ${OP} ${Param}`) :
    never : never : never : never : never : never

export type PredExpr<T extends ITable, Ti extends keyof T, Ts extends Tables, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName> =
    IndexedPredicateExpr<T, Ti, Ts, O, F, Param> |
    PredicateExpr<T, Ti, Param>;


export type RunFilterArgs<Ts extends Tables> = {
    parameters: GPUBuffer,
  sets: {
        resultCounter:GPUBuffer,
        rowCount: number,
        tables: BufferTables<Ts>,
        results: GPUBuffer,
    }[]
    enc: GPUCommandEncoder,
}

export type RunIndexedFilterArgs<Ts extends Tables> = {
    parameters: GPUBuffer,
  sets: {
        resultCounter:GPUBuffer,
        rowCount: number,
        elements: GPUBuffer,
        tables: BufferTables<Ts>,
        results: GPUBuffer,
    }[]
    enc: GPUCommandEncoder,
}

export type FilteredTable<Ts extends Tables, T extends ITable, Params extends Record<string, number | number[]>> = {
  and: <Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(pred: PredExpr<T, Ti, Ts, O, F, Param>) => FilteredTable<Ts, T,
    typeof pred extends
      PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> }>;
  or: <Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(pred: PredExpr<T, Ti, Ts, O, F, Param>) => FilteredTable<Ts, T,
    typeof pred extends
      PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> }>;
  build: (device: GPUDevice, label: string) => {
      shader: string,
      serializeParameters: (parameters: Params,buffer?:ArrayBuffer) => ArrayBuffer,
      pipeline: { pipeline: GPUComputePipeline, defs: wgh.ShaderDataDefinitions },
      run: (args: RunFilterArgs<Ts>) => void
  };
  buildIndexed: (device: GPUDevice, label: string) => {
    shader: string,
    serializeParameters: (parameters: Params) => ArrayBuffer,
    pipeline: { pipeline: GPUComputePipeline, defs: wgh.ShaderDataDefinitions },
    run: (args: RunIndexedFilterArgs<Ts>) => void
  };
  andOpen: <Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(pred: PredExpr<T, Ti, Ts, O, F, Param>) => FilteredTable<Ts, T,
    typeof pred extends
      PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> }>;
  orOpen: <Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(pred: PredExpr<T, Ti, Ts, O, F, Param>) => FilteredTable<Ts, T,
    typeof pred extends
      PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> }>;
  close: ()=>FilteredTable<Ts,T,Params>
}
export type SimplePredExpr = `${string} ${OP | VOP} ${string}`
export type PredLst = readonly ({ OP: 'and' | 'or' | 'and (' | 'or (', pred: SimplePredExpr }|{OP:')'})[]


// a ts type for the wgsl type...
export type TSVec<WT> = WT extends VT<infer S> ?
    S extends 2 ? [number, number] :
    S extends 3 ? [number, number, number] :
    S extends 4 ? [number, number, number, number] :
    never : never
export type TsType<WT> = WT extends LT ? number : TSVec<WT>


export type Given<Ts extends Tables> = {
    from: <Tbl extends keyof Ts>(tbl: Tbl) => GivenTable<Ts[Tbl], Ts>
}
export type GivenTable<T extends ITable, Ts extends Tables> = {
    select: <Ti extends keyof T, O extends keyof Ts, oF extends keyof Ts[O]>(f: Ti | '$index' | IndexedReference<T, Ti, Ts, O, oF>) => SelectedTable<T, Ts>
}

export type Sel = { selection: string, type: FT };

export type SelectedTable<T extends ITable, Ts extends Tables> = {
  select: <Ti extends keyof T, O extends keyof Ts, oF extends keyof Ts[O]>(f: Ti | '$index' | IndexedReference<T, Ti, Ts, O, oF>) => SelectedTable<T, Ts>
  where: <Ti extends keyof T,
    O extends keyof Ts,
    F extends keyof Ts[O],
    Param extends VarName,
  >(pred:  PredExpr<T, Ti, Ts, O, F, Param>) =>
    FilteredTable<Ts, T,
      typeof pred extends
        PredicateExpr<T, Ti, Param> ? { [k in Param]: TsType<T[Ti]> } : { [k in Param]: TsType<Ts[O][F]> }>
}
export type FilterShaderQueryContext<Ts extends Tables> = {
    // hmmm name too silly
  from: string;
  tables: Ts;
  selections: ReadonlyArray<Sel>;
  firstPred: SimplePredExpr;
  uniformName: string;
  uniformTypeName: string;
}
