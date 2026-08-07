// generate the interesting bits of the filter-shader

import {
    type Elem,
    type FilterShaderQueryContext,
    type WgslType,
    type ITable,
    type OP,
    type PredLst,
    type Sel,
    type SimplePredExpr,
    type Tables,
    type VOP,
} from './types';

function isVecOp(s: OP | VOP): s is VOP {
    return s.startsWith('a');
}
function parseVecOp(op: VOP) {
    const aggregation = op.substring(0, 3);
    const sop = op.substring(4).split(')')[0];
    return [aggregation, sop] as ['any' | 'all', OP];
}

// dont export this - its only legit if we know a bunch of stuff about the string
function fieldType(s: string, table: ITable) {
    return table[s];
}
export function indexExprType(s: string, tables: Tables, from: string) {
    const ext = looksLikeIndexExpr(s, tables, from);
    return ext ? ext.type : undefined;
}
export function looksLikeIndexExpr(s: string, tables: Tables, from: string) {
    // the goal here is to parse an expr that looks like:
    // someTable[someColumn].someOtherColumn
    // could I have used Regex? yes, and perhaps that would be more elegant!
    // for now, this works, and its not too long

    const [tbl, rest] = s.split('[');
    if (tbl && rest) {
        const [index_field, selection] = rest.split('].');
        if (index_field && selection) {
            if (tables[tbl] && tables[from] && tables[from][index_field] && tables[tbl][selection]) {
                // return the expected type
                return {
                    fTable: tbl,
                    selection,
                    index_field,
                    from,
                    type: tables[tbl][selection],
                };
            }
        }
    }
    return false;
}
function genRef(ctx: FilterShaderQueryContext<Tables>, operand: string, indexing: string = 'element') {
    if (operand === '$index') {
        return indexing;
    }
    const indexed = looksLikeIndexExpr(operand, ctx.tables, ctx.from);
    if (indexed) {
        return `${indexed.fTable}_${indexed.selection}[${indexed.from}_${indexed.index_field}[${indexing}]]`;
    } else if (operand in ctx.tables[ctx.from]!) {
        return `${ctx.from}_${operand}[${indexing}]`;
    }
    return operand;
}
function genPred(ctx: FilterShaderQueryContext<Tables>, p: SimplePredExpr) {
    const [lhs, op, rhs] = p.split(' ') as [string, OP | VOP, string];
    // TODO! handle non-PARAMETER rhs exprs
    const param = `${ctx.uniformName}.${rhs}`;
    if (isVecOp(op)) {
        const [agg, sop] = parseVecOp(op);
        const str = `${agg}(${genRef(ctx, lhs)} ${sop} ${param})`; // any / all are built-in wgsl fns over vectors of booleans
        return str;
    }
    return `${genRef(ctx, lhs)} ${op} ${param}`;
}
function handlePredElem(ctx: FilterShaderQueryContext<Tables>, e: Elem<PredLst>) {
    switch (e.OP) {
        case 'and (':
            return `&& (${genPred(ctx, e.pred)}`;
        case 'or (':
            return `|| (${genPred(ctx, e.pred)}`;
        case ')':
            return ')';
        case 'and':
            return `&& ${genPred(ctx, e.pred)}`;
        case 'or':
            return `|| ${genPred(ctx, e.pred)}`;
    }
}
export function generatePredicateExpr(ctx: FilterShaderQueryContext<Tables>, exprs: [SimplePredExpr, ...PredLst]) {
    return exprs.map((e) => (typeof e === 'string' ? genPred(ctx, e) : handlePredElem(ctx, e))).join('\n');
}
function extractPred(p: SimplePredExpr | Elem<PredLst>): SimplePredExpr | undefined {
    return typeof p === 'string' ? p : 'pred' in p ? p.pred : undefined;
}
export function genUniformParameterStruct(tables: Tables, from: string, exprs: [SimplePredExpr, ...PredLst]) {
    const fields = exprs.reduce(
        (acc, cur: SimplePredExpr | Elem<PredLst>) => {
            const info = extractPredicateInfo(tables, from, extractPred(cur));
            return info === undefined ? acc : { ...acc, [info[0]]: info[1] };
        },
        {} as Record<string, WgslType>
    );

    const decls = Object.entries(fields)
        .map(([param, type]) => `${param}:${type}`)
        .join(',\n');

    return `struct Parameters {
    ${decls}
  };
  `;
}
function extractPredicateInfo(tables: Tables, from: string, expr: SimplePredExpr | undefined) {
    if (expr === undefined) {
        return undefined;
    }
    const [lhs, _op, rhs] = expr.split(' ') as [string, OP | VOP, string];
    let lhsType = indexExprType(lhs, tables, from) || fieldType(lhs, tables[from]!);
    if (lhsType) {
        return [rhs, lhsType] as const;
    }
    return undefined;
}

// we also need to generate a storage buffer per field per table...
// todo - someday support row-major tables - structs vs. parallel arrays
export function generateTableBindings(
    tableName: string,
    table: Record<string, WgslType>,
    group: number,
    bindingStart: number = 0
) {
    const cols = Object.entries(table);
    let bindingLookup = cols.reduce(
        (acc, [f, _t], index) => ({ ...acc, [f]: index + bindingStart }),
        {} as Record<string, number>
    );
    const decls = cols
        .map(
            ([f, t], index) =>
                `@group(${group}) @binding(${index + bindingStart}) var<storage,read> ${tableName}_${f}: array<${t}>;`
        )
        .join('\n');
    return { decls, numBindings: cols.length, bindingLookup };
}

function generateOutputStructure(selections: ReadonlyArray<Sel>) {
    // the names of the values in the structure dont matter at all -
    const structName = `OutputStruct`;
    const fields = selections.map((s, i) => `field_${i.toFixed(0)}: ${s.type},`).join('\n');
    const decl = `struct ${structName} {\n ${fields} \n };`;
    const initializers = selections.map((s) => s.selection).join(', '); // === '$index' ? 'tmp - 1' : `${s.selection}[tmp - 1]`).join(', ');
    const construct = `${structName}(${initializers})`;

    return { structName, decl, construct };
}

export function generateShader(params: {
    workgroupSize: number;
    inputBindings: string;
    predicateExpr: string;
    uniformStruct: { name: string; typeName: string; decl: string };
    indexed: boolean;
    selections: ReadonlyArray<Sel>;
}) {
    const { inputBindings, predicateExpr, uniformStruct, selections, workgroupSize, indexed } = params;
    const { structName, decl: outputStructDecl, construct } = generateOutputStructure(selections);
    const host = /*wgsl*/ `

    ${uniformStruct.decl}
    ${outputStructDecl}
    var<workgroup> results: array<u32,${workgroupSize}>;
    var<workgroup> count: atomic<u32>;

    // an array of 1... because this is a storage buffer? hmmmm not sure
    @group(0) @binding(0) var<uniform> ${uniformStruct.name}:${uniformStruct.typeName};

    // result count and results are in group1, as they change at the same rate as the input buffers
    @group(1) @binding(0) var<storage,read_write> used: array<atomic<u32>,1>;
    @group(1) @binding(1) var<storage, read_write> passing: array<${structName}>;
    ${indexed ? '@group(1) @binding(2) var<storage, read_write> elements: array<u32>;' : ''};

    // input bindings (find-replace injected...)
    ${inputBindings}

    @compute @workgroup_size(${workgroupSize})
    fn main(
        @builtin(global_invocation_id) global_id : vec3<u32>,
        @builtin(local_invocation_id) local_id: vec3<u32>,
    ){
        let element = ${indexed ? 'elements[global_id.x]' : 'global_id.x'};
        let inbounds = global_id.x < arrayLength(&passing);
        let predicateResult = inbounds && ${predicateExpr};
        if(predicateResult){
            atomicAdd(&count,1u);
            results[local_id.x]=(element+1);
        }else {
            results[local_id.x]=0;
        }
        workgroupBarrier();
        // now a single thread uses atomicAdd() to allocate # of hits in the global result buffer
        // then it copies workgroup results (compacting them as it copies) to globalResults in the allocated block
        if(local_id.x==0){
            let c = atomicLoad(&count);
            let start = atomicAdd(&used[0],c);
            var p = start;
            for(var i = 0;i < ${workgroupSize};i++){
                if(results[i]>0){
                    let tmp = results[i];
                    passing[p] = ${construct};
                    p++;
                }
            }
        }
    }`;

    return host;
}

export function genQuery<Ts extends Tables>(
    ctx: FilterShaderQueryContext<Ts>,
    predicates: PredLst,
    wgSize: number,
    indexed: boolean
) {
    // const bindings = generateTableBindings(ctx.from as string, ctx.tables[ctx.from]!, 1)
    // for now, assume all tables will be used somehow
    // future - allow specification of which tables go in which groups
    // const bindings = map(keys(ctx.tables), (t) => generateTableBindings(t, ctx.tables[t]!, 1))
    let bindingStart = 3;
    let bindings: string = '';
    const bindingLookups: Record<string, Record<string, number>> = {};
    for (const t of Object.keys(ctx.tables)) {
        const binding = generateTableBindings(t, ctx.tables[t]!, 1, bindingStart);
        bindings += `\n //${t}\n${binding.decls}\n`;
        bindingStart += binding.numBindings;
        bindingLookups[t] = binding.bindingLookup;
    }
    const predicate = generatePredicateExpr(ctx, [ctx.firstPred, ...predicates]);
    const paramsDecl = genUniformParameterStruct(ctx.tables, ctx.from, [ctx.firstPred, ...predicates]);
    return {
        shader: generateShader({
            workgroupSize: wgSize,
            inputBindings: bindings,
            predicateExpr: predicate,
            indexed,
            selections: ctx.selections.map((s) => ({ selection: genRef(ctx, s.selection, 'tmp - 1'), type: s.type })),
            uniformStruct: { name: ctx.uniformName, typeName: ctx.uniformTypeName, decl: paramsDecl },
        }),
        bindingLookups,
    };
}
