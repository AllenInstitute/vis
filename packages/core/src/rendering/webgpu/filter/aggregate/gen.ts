import { AST, ColumnExpr, IndexExpr, ScalarType, Tables, WgslType } from "../types";
import {generateTableBindings, setupExprBuilder} from '../gen'
export type Agg = {
  kind: 'min' | 'max' | 'sum',
  expr: IndexExpr<string, string, ScalarType> |
  ColumnExpr<string, string, ScalarType>
} | {
  kind: 'count'
};

export function atomicAggregateExpr(agg:Agg, output:string, field:number) {
  // get the value out
  `atomicLoad(&output_${field.toFixed(0)}[loc])`
  switch (agg.kind) {
    case 'min':
    case 'max':
      return sat(agg.kind, output, field, agg.expr.type);
    case 'sum':
      return sum(output, field, agg.expr.type);
    case 'count':
      return count(output, field);
  }
}

function sum(output: string, field: number, type: 'u32' | 'f32' | 'i32') {
  if (type === 'f32') {
    // so complicated...
    return `atomicStore(&${output}_${field.toFixed(0)}[loc],
      bitcast<u32>(
      tmp + bitcast<f32>(atomicLoad(&${output}_${field.toFixed(0)}[loc])
      )
    )`
  }
  return`atomicAdd(&${output}_${field.toFixed(0)}[loc],tmp)`
}

function sat(op:'min'|'max', output: string, field: number, type: 'u32' | 'f32' | 'i32') {
  if (type === 'f32') {
    // so complicated...
    return `atomicStore(&${output}_${field.toFixed(0)}[loc],
      bitcast<u32>(
      ${op}(tmp, bitcast<f32>(atomicLoad(&${output}_${field.toFixed(0)}[loc]))
      )
    )`
  }
  return op === 'min' ?
    `atomicMin(&${output}_${field.toFixed(0)}[loc],tmp)` :
    `atomicMax(&${output}_${field.toFixed(0)}[loc],tmp)`
}
function count( output: string, field: number,) {
  return`atomicAdd(&${output}_${field.toFixed(0)}[loc],1)`
}

// I need to compile the exprs that set the location[i]
// I need to compile the expr that initilizes the local results
type G = IndexExpr<string, string, ScalarType> |
ColumnExpr<string, string, ScalarType>
export function generateAggregationShader(indexed:boolean, tables:Tables, from:string, aggregations:Agg[], col:G, row?:G) {
  const toWgsl = setupExprBuilder(from);
  function generateLocation(col: G, row?:G) {
    const c = toWgsl(col, 'element', '');
    const r = row ? toWgsl(row, 'element', '') : '1u';
    return `
      locations[element]=vec2u(
        ${c},
        ${r}
      );
    `
  }
  function generateResult(aggs: Agg[], structName:string) {
    const v = aggs.map(a =>
    {
      if (a.kind === 'count') {
        return '1'
      }
      return toWgsl(a.expr, 'element', '')
    }
    );
    return `
      results[element] = ${structName}(
        ${v.join(',\n')}
      );
    `
  }
  const outputName = 'output'
  const Temporary='Temporary'
  const localSetup = generateResult(aggregations, Temporary);
  const locationSetup = generateLocation(col, row);
  const finalResult = aggregations.map((a, i) => atomicAggregateExpr(a,outputName, i)).join(';\n')

  let bindingStart = 3;
  let bindings: string = '';

  const bindingLookups: Record<string, Record<string, number>> = {};
  for (const t of Object.keys(tables)) {
      const binding = generateTableBindings(t, tables[t]!, 1, bindingStart);
      bindings += `\n //${t}\n${binding.decls}\n`;
      bindingStart += binding.numBindings;
      bindingLookups[t] = binding.bindingLookup;
  }
  const outGroup = 0;
  // output bindings...
  let outBindings = ''
  for (let out_field = 0; out_field < aggregations.length;out_field++) {
    outBindings += `group(${outGroup}) binding(${bindingStart}) ${outputName}_${out_field}:array<atomic<u32>>;\n`
    bindingStart += 1;
  }
  return shaderPlz({
    workgroupSize: '64',
    atomicFinal: finalResult,
    indexed,
    inputBindings: bindings,
    outputBindings: outBindings,
    locationExpr: locationSetup,
    resultExpr: localSetup,
    structName:Temporary
  })
}


function shaderPlz(args: {
  workgroupSize: string,
  structName: string,
  outputBindings: string,
  inputBindings: string,
  indexed: boolean,
  resultExpr: string,
  locationExpr: string,
  atomicFinal: string
}) {
  const {workgroupSize,structName,atomicFinal,indexed,inputBindings,locationExpr,outputBindings,resultExpr}=args
  // AGGREGATE STUFF!
  return `var<workgroup> results: array<${structName},${workgroupSize}>;
  var<workgroup> locations: array<vec2u,${workgroupSize}>;
  var<workgroup> count: atomic<u32>;

  // an array of 1... because this is a storage buffer? hmmmm not sure
  @group(0) @binding(0) var<uniform> dimensions:vec2u; // Nx1 in the 1D case

  // result count and results are in group1, as they change at the same rate as the input buffers
  ${indexed ? '@group(1) @binding(2) var<storage, read_write> elements: array<u32>;' : ''};

  ${inputBindings}
  ${outputBindings} // cant use a single structure, because atomics!
  @compute @workgroup_size(${workgroupSize})

  // each thread will write to its own outputStruct in the results array
  // after all threads finish this task, which requires no sync at all,
  // each thread will be given a range of rows
  // all threads read all local results, and copy results who's locations match
  fn main(
      @builtin(global_invocation_id) global_id : vec3<u32>,
      @builtin(local_invocation_id) local_id: vec3<u32>,
  ){
      let element = ${indexed ? 'elements[global_id.x]' : 'global_id.x'};
      ${locationExpr}
      ${resultExpr}

      workgroupBarrier();
      // each thread gets an array of COLS (as often rows are just 1)
      let colsPerThread = max(1u,(dimensions.x/${workgroupSize}));
      // my row range = local_id.x
      let colStart = local_id.x*colsPerThread;
      var colEnd = colStart+colsPerThread;
      if(local_id.x==${workgroupSize}-1){
          colEnd = dimensions.x;
      }
      // ok!
      for(let i =0;i<${workgroupSize};i++){
          if(locations[i].x >= colStart && locations[i].x < colEnd){
              // atomically write the structure... which is hard... because you cant do that...
              let tmp = results[i];
              let loc = locations[i].x + (dimensions.x*locations[i].y);
              // also atomics cant be f32
              // we could use bitcast to cast them to floats, do the op, then put the new value back...
              ${atomicFinal};
          }
      }
  }
`
}
