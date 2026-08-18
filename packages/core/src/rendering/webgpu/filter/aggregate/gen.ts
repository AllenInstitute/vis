import type { AST, ColumnExpr, IndexExpr, ScalarType, Tables, WgslType } from "../types";
import { generateTableBindings, setupExprBuilder } from '../gen'
export type Agg = {
  kind: 'min' | 'max' | 'sum',
  expr: IndexExpr<string, string, ScalarType> |
  ColumnExpr<string, string, ScalarType>
} | {
  kind: 'count'
};

export function atomicAggregateExpr(agg: Agg, output: string, field: number) {
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
    // return `atomicStore(&${output}_${field.toFixed(0)}[loc],
    //   bitcast<u32>(
    //   tmp.f_${field} + bitcast<f32>(atomicLoad(&${output}_${field.toFixed(0)}[loc])
    //   )
    // ))`
    // lets try weak Exchange...
    // return `atomicAdd(&${output}_${field.toFixed(0)}[loc],bitcast<u32>(tmp.f_${field}))`
    // man, this is real gross...
    // we cant(?) have a var that is a ptr, so just use interpolation to make this not 
    // so annoying to read
    const ptr = `&${output}_${field.toFixed(0)}[loc]`;
    const gross = /*wgsl*/`
    var expected = atomicLoad(${ptr});
    loop {
      let sum = tmp.f_${field} + bitcast<f32>(expected);
      let result = atomicCompareExchangeWeak(${ptr},expected,bitcast<u32>(sum));
      if(result.exchanged){
        break;
      }
      // if not - update our expected value (because some other thread touched it!)
      expected = result.old_value;
    }`;
    return gross;
  }
  return `atomicAdd(&${output}_${field.toFixed(0)}[loc],tmp)`
}

function sat(op: 'min' | 'max', output: string, field: number, type: 'u32' | 'f32' | 'i32') {
  if (type === 'f32') {
    // so complicated...
    return `atomicStore(&${output}_${field.toFixed(0)}[loc],
      bitcast<u32>(
      ${op}(tmp.f_${field}, bitcast<f32>(atomicLoad(&${output}_${field.toFixed(0)}[loc]))
      )
    )`
  }
  return op === 'min' ?
    `atomicMin(&${output}_${field.toFixed(0)}[loc],tmp.f_${field})` :
    `atomicMax(&${output}_${field.toFixed(0)}[loc],tmp.f_${field})`
}
function count(output: string, field: number,) {
  return `atomicAdd(&${output}_${field.toFixed(0)}[loc],1)`
}

// I need to compile the exprs that set the location[i]
// I need to compile the expr that initilizes the local results
type G = IndexExpr<string, string, ScalarType> |
  ColumnExpr<string, string, ScalarType>
export function generateAggregationShader(indexed: boolean, tables: Tables, from: string, aggregations: Agg[], col: G, row?: G) {
  const toWgsl = setupExprBuilder(from);
  function generateLocation(col: G, row?: G) {
    const c = toWgsl(col, 'element', '');
    const r = row ? toWgsl(row, 'element', '') : '0';
    return `
      locations[local_id.x]=vec3u(
        ${c},
        ${r},
        u32(global_id.x < dimensions.z)
      );
    `
  }

  function generateMergeFn(aggs:Agg[], structName:string){

    const fields = aggs.map((a,i)=>{
      const field = `f_${i}`
      switch(a.kind) {
        case 'count':
        case 'sum':
         return `to.${field}+other.${field}`
        case 'max':
        case 'min':
          return `${a.kind}(to.${field}, other.${field})`
      }
    });
    const merg = /*wgsl*/ `
    fn aggregate(to: ${structName}, i:u32)-> ${structName} {
      let other = results[i];
      return ${structName}(${fields.join(', ')});
    }
    `
    return merg;
  }
  function generateResult(aggs: Agg[], structName: string) {
    const v = aggs.map(a => {
      if (a.kind === 'count') {
        return '1'
      }
      return toWgsl(a.expr, 'element', '')
    }
    );
    return `
      results[local_id.x] = ${structName}(
        ${v.join(',\n')}
      );
    `
  }
  const outputName = 'output'
  const Temporary = 'Temporary'
  const localSetup = generateResult(aggregations, Temporary);
  const locationSetup = generateLocation(col, row);
  const finalResult = aggregations.map((a, i) => atomicAggregateExpr(a, outputName, i)).join(';\n')
  const structFieldDecls = aggregations.map((a, i) => `f_${i} : ${a.kind === 'count' ? 'u32' : a.expr.type}`).join(',\n')
  let bindingStart = 1;
  let bindings: string = '';

  const bindingLookups: Record<string, Record<string, number>> = {};
  for (const t of Object.keys(tables)) {
    const binding = generateTableBindings(t, tables[t]!, 1, bindingStart);
    bindings += `\n //${t}\n${binding.decls}\n`;
    bindingStart += binding.numBindings;
    bindingLookups[t] = binding.bindingLookup;
  }
  // const outGroup = 1;
  // output bindings...
  // let outBindings = ''
  // for (let out_field = 0; out_field < aggregations.length; out_field++) {
  //   outBindings += `@group(${outGroup}) @binding(${bindingStart}) var<storage,read_write> ${outputName}_${out_field}:array<atomic<u32>>;\n`
  //   bindingStart += 1;
  // }
  const shader =
    shaderPlz({
      workgroupSize: '64',
      mergeFn: generateMergeFn(aggregations,Temporary),
      indexed,
      inputBindings: bindings,
      // outputBindings: outBindings,
      locationExpr: locationSetup,
      resultExpr: localSetup,
      structName: Temporary,
      structFieldDecls
    })
  console.warn(shader)
  return shader;
}


export function shaderPlz(args: {
  workgroupSize: string,
  structName: string,
  structFieldDecls: string,
  // outputBindings: string,
  inputBindings: string,
  indexed: boolean,
  resultExpr: string,
  locationExpr: string,
  mergeFn: string
}) {
  const { workgroupSize, structName, structFieldDecls, mergeFn, indexed, inputBindings, locationExpr, resultExpr } = args
  // AGGREGATE STUFF!
  return /*wgsl*/`
  struct ${structName} {
    ${structFieldDecls}
  };
  var<workgroup> results: array<${structName},${workgroupSize}>;
  var<workgroup> locations: array<vec3u,${workgroupSize}>;



  @group(0) @binding(0) var<uniform> dimensions:vec3u; // Nx1 in the 1D case, z is always # rows of input
  // todo - inject the name of the From table, so we can use arrayLength($from) instead of a uniform...
  @group(0) @binding(1) var<storage,read_write> output: array<${structName}>;
  @group(0) @binding(2) var<storage,read_write> locks: array<atomic<u32>>; //output[i] must be guarded by lock[i]

  // result count and results are in group1, as they change at the same rate as the input buffers
  ${indexed ? '@group(1) @binding(0) var<storage, read_write> elements: array<u32>;' : ''};
  ${inputBindings}

  // note that we dont think 16K bytes is enough to just put a whole table in workgroup memory
  // so - we use a sparse list of results (one per thread, plus the xy coord of where to put it (location)
  ${mergeFn}

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
      // I think... invalid access is stoping this from working?
      ${locationExpr}
      ${resultExpr}

      workgroupBarrier();
      
      let me = local_id.x;
      let myLoc = locations[me];
      if(myLoc.z > 0){
        for(var i:u32 =0;i<${workgroupSize};i++){
            if(locations[i].z > 0){
              if(all(myLoc.xy == locations[i].xy)){
                // we need to merge our result with i, unless the thread for i would do it for us...
                if(i < me){
                  // the thread for i will do all the work for myLoc-tagged values;
                  locations[me].z=2;
                  break;
                }else if(i==me){
                  // dont merge me with myself...
                  continue;
                }else {
                  // merge i with my result,
                  // note that i will be > me
                  // note that i wont be pre-merged with other stuff, because the thread i
                  // would have hit i=me (in its copy of this loop) and stopped before doing anything, because they all start at 0
                  results[me]=aggregate(results[me],i);
                }
              }
            }
        }

      }
      workgroupBarrier();
      // todo - not clear if the final copy as a single thread is the right call...
      if(me == 0){
        for(var i:u32 =0;i<${workgroupSize};i++){
          if(locations[i].z==1){
            let loc = locations[i].x + (dimensions.x*locations[i].y);
            // this is a valid result... 
            // get the lock for the location
            // merge our value with global[loc] once we get it
            loop {
              let lockAccess = atomicCompareExchangeWeak(&locks[loc], 0u, 1u);
              if (lockAccess.exchanged) {
                  // lock acquired!
                    // output[global_id.x+i]=results[i];
                    // output[global_id.x+i].f_1=global_id.x+i;//locations[i].z;
                  output[loc]=aggregate(output[loc],i);
                  atomicStore(&locks[loc],0u); // release the lock
                  break;
              }
            }
          }
        }
      }

  }
`
}

function buildAggregator(device: GPUDevice) {

}


// so this approch is 1 (certainly slow) and 2 does not even work at all
// lets synthesize a merge fn that merges the structure we make
// lets use a spin-lock to merge the final results
// lets use a sparse list of results..