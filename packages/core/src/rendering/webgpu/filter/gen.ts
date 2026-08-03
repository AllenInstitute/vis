
// generate the interesting bits of the filter-shader

import entries from "lodash/entries";
import { OPS, type Elem, type FilterShaderQueryContext, type FT, type ITable, type OP, type PredLst, type SimplePredExpr, type Tables, type VOP } from "./types";
import { keys, map, reduce, values } from "lodash";

function isVecOp(s: OP | VOP): s is VOP {
  return s.startsWith('a')
}
function parseVecOp(op: VOP) {
  const aggregation = op.substring(0, 3)
  const sop = op.substring(3).split(')')[1]
  return [aggregation, sop] as ['any' | 'all', OP];
}
function isScalarOp(s: OP | VOP): s is OP {
  return (OPS as readonly string[]).includes(s)
}
// dont export this - its only legit if we know a bunch of stuff about the string
function fieldType(s: string, table: ITable) {
  return table[s]
}
export function indexExprType(s: string, tables: Tables, from: string) {
  const ext = looksLikeIndexExpr(s, tables, from)
  return ext ? ext.type : undefined;
}
export function looksLikeIndexExpr(s: string, tables: Tables, from: string) {
  // if(s.match(/[a].[b]\[.\]\.$0/))
  // todo: i am on a plane and I dont remember regex and I dont wanna buy wifi
  // table[field_of_from].field_of_table
  const [tbl, rest] = s.split('[')
  if (tbl && rest) {
    const [index_field, selection] = rest.split('].')
    if (index_field && selection) {

      if (tables[tbl] && tables[from] && tables[from][index_field] && tables[tbl][selection]) {
        // return the expected type
        return {
          fTable: tbl,
          selection,
          index_field,
          from,
          type: tables[tbl][selection]
        }
      }
    }
  }
  return false;
}
function genRef(ctx: FilterShaderQueryContext<Tables>, operand: string, indexing: string = 'element') {
  const indexed = looksLikeIndexExpr(operand, ctx.tables, ctx.from)
  if (operand === '$index') {
    return indexing;
  }
  if (indexed) {
    return `${indexed.fTable}_${indexed.selection}[${indexed.from}_${indexed.index_field}[${indexing}]]`
  } else if (operand in ctx.tables[ctx.from]!) {
    return `${ctx.from}_${operand}[${indexing}]`
  }
  // todo...
  return operand;
}
function genPred(ctx: FilterShaderQueryContext<Tables>, p: SimplePredExpr) {
  const [lhs, op, rhs] = p.split(' ') as [string, OP | VOP, string]
  // TODO! handle non-PARAMETER rhs exprs
  const param = `${ctx.uniformName}.${rhs}`
  if (isVecOp(op)) {
    const [agg, sop] = parseVecOp(op)
    return `${agg}(${genRef(ctx, lhs)} ${sop} ${param})` // any / all are built-in wgsl fns over vectors of booleans
  }
  return `${genRef(ctx, lhs)} ${op} ${param}`
}
export function generatePredicateExpr(ctx: FilterShaderQueryContext<Tables>, exprs: [SimplePredExpr, ...PredLst]) {
  return exprs.map(e => typeof e === 'string' ? genPred(ctx, e) : `${e.OP === 'and' ? ' && ' : ' || '} ${genPred(ctx, e.pred)}`).join('\n');
}
function extractPred(p: SimplePredExpr | Elem<PredLst>): SimplePredExpr {
  return typeof p === 'string' ? p : p.pred
}
export function genUniformParameterStruct(tables: Tables, from: string, exprs: [SimplePredExpr, ...PredLst]) {
  // extract the parameter name and expected type from each predicate
  // the type must be the same as that of the lhs
  // to know that, we need the tables...
  const decls = reduce(exprs,
    (acc: string, cur: SimplePredExpr | Elem<PredLst>) => (acc + `\n ${extractPredSubjectType(tables, from, extractPred(cur)) ?? 'ERROR!!'},`), 'struct Parameters {'
  ) + '};\n';
  return decls;
}

function extractPredSubjectType(tables: Tables, from: string, expr: SimplePredExpr) {
  const [lhs, _op, rhs] = expr.split(' ') as [string, OP | VOP, string]
  let lhsType = indexExprType(lhs, tables, from) || fieldType(lhs, tables[from]!)
  if (lhsType) {
    return `${rhs}:${lhsType}`
  }
  // todo - handle Error!
  return undefined
}
// we also need to generate a storage buffer per field per table...
// todo - someday support row-major tables - structs vs. parallel arrays
export function generateTableBindings(tableName: string, table: Record<string, FT>, group: number, bindingStart: number = 0) {
  const cols = entries(table)
  let bindingLookup = cols.reduce((acc, [f, _t], index) => ({ ...acc, [f]: index + bindingStart }), {} as Record<string, number>);
  const decls = cols.map(([f, t], index) => `@group(${group}) @binding(${index + bindingStart}) var<storage,read> ${tableName}_${f}: array<${t}>;`).join('\n');
  return { decls, numBindings: cols.length, bindingLookup }
}

export function generateShader(params: {
  workgroupSize: number,
  inputBindings: string,
  predicateExpr: string,
  uniformStruct: { name: string, typeName: string, decl: string },
  indexed: boolean,
  select: {
    expr: string,
    type: FT,
  }
}) {
  const { inputBindings, predicateExpr, uniformStruct, select, workgroupSize, indexed } = params;
  const selectExpr = select.expr;
  const host = /*wgsl*/`

    ${uniformStruct.decl}

    var<workgroup> results: array<u32,${workgroupSize}>;
    var<workgroup> count: atomic<u32>;

    // an array of 1... because this is a storage buffer? hmmmm not sure
    @group(0) @binding(0) var<uniform> ${uniformStruct.name}:${uniformStruct.typeName};

    // result count and results are in group1, as they change at the same rate as the input buffers
    @group(1) @binding(0) var<storage,read_write> used: array<atomic<u32>,1>;
    @group(1) @binding(1) var<storage, read_write> passing: array<${select.type}>;
    ${indexed ?
      '@group(1) @binding(2) var<storage, read_write> elements: array<u32>;' :
      ''};

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
                    passing[p] = ${selectExpr};
                    p++;
                }
            }
        }
    }`

  return host;
}

export function genQuery<Ts extends Tables>(ctx: FilterShaderQueryContext<Ts>, predicates: PredLst, wgSize: number, indexed: boolean) {
  let bindingStart = 3;
  let bindings: string = ''
  const bindingLookups: Record<string, Record<string, number>> = {}
  for (const t of keys(ctx.tables)) {
    const binding = generateTableBindings(t, ctx.tables[t]!, 1, bindingStart)
    bindings += `\n //${t}\n${binding.decls}\n`;
    bindingStart += binding.numBindings
    bindingLookups[t] = binding.bindingLookup
  }
  const predicate = generatePredicateExpr(ctx, [ctx.firstPred, ...predicates])
  const paramsDecl = genUniformParameterStruct(ctx.tables, ctx.from, [ctx.firstPred, ...predicates]);
  return {
    shader: generateShader(
      {
        workgroupSize: wgSize,
        inputBindings: bindings,
        predicateExpr: predicate,
        indexed,
        select: {
          expr: genRef(ctx, ctx.select, 'tmp - 1'),
          type: ctx.selectType,
        },
        uniformStruct: { name: ctx.uniformName, typeName: ctx.uniformTypeName, decl: paramsDecl }
      }),
    bindingLookups
  }
}
