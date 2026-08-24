import type { AST, ColumnExpr, IndexExpr, ITable, ScalarType, Tables, WgslType } from "../types";
import { generateTableBindings, setupExprBuilder } from '../gen'
import { generateHistogramShader } from './gen-render'
import * as wgh from 'webgpu-utils';

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
type S = G | '$count'|'$unused'
type M = G |'$unused'
type SumLayout = [S,S,S,S]
type SatLayout = [M, M, M, M]

type AggregationConfig = {
    op: 'sum',
    layout: SumLayout;
}| {
    op: 'min' | 'max',
    layout: SatLayout;
}
function figureOut(tables:Tables,conf: AggregationConfig,toWgsl:(e:G)=>string) {
    // make sure all types agree
    const type = conf.layout.reduce((type: WgslType | null | undefined, elem) => {
        if (type === null) {
            return null; // types already disagree
        }
        if (elem === '$count' || elem === '$unused') {
            return type;
        }
        if (type === undefined) {
            // not yet determined
            determineType(tables, elem)
        }
        return type === determineType(tables, elem) ? type : null;
    }, undefined);
    // TODO panic if type == null or undefined

    // we can only write to certain formats
    // we can write a single channel, 2 channels, or 4 - never 3
    const [_r, g, b, a] = conf.layout;
    let components:1|2|4 = 4;
    let [R, G, B, A] = conf.layout.map(c => {
        if (c === '$count') {
            return '1'
        }
        if (c === '$unused') {
            return '0'
        }
        return toWgsl(c)
    });
    let expr = `vec4${type}(${R},${G},${B},${A})`
    if (all([g, b, a], (c) => c === '$unused')) {
        components = 1;
        expr = R
    } else if (all([b, a], (c => c === '$unused'))) {
        components = 2
      expr = `vec4${type}(${R},${G})`
    }
    return {type,components,expr}
}
function componentType(t: WgslType): ScalarType {
    if (t.startsWith('vec')) {
        const abbr = t.substring(4);
        switch (abbr) {
            case 'u':
                return 'u32';
            case 'i':
                return 'i32';
            case 'f':
                return 'f32';
        }
    }
    return t as ScalarType;
}
function inferType(table: ITable, e: string) {
    const [field, swizzle] = e.split('.');
    return swizzle ? componentType(table![field!]!) : table![field!]!;
}
function determineType(
    tables: Tables,
    expr: '$index' | IndexExpr<string, string, WgslType> | ColumnExpr<string, string, WgslType>
): WgslType {
    if (expr === '$index') return 'u32';
    switch (expr.kind) {
        case 'from field': {
            const [field, swizzle] = expr.field.split('.');
            return swizzle ? componentType(tables[expr.from]![field!]!) : tables[expr.from]![field!]!;
        }
        case 'table at field': {
            const [field, swizzle] = expr.field.split('.');
            return swizzle ? componentType(tables[expr.table]![field!]!) : tables[expr.table]![field!]!;
        }
    }
}
export function generateAggregationShader(tables: Tables, from: string,
  aggregation: AggregationConfig,
  col: G,
  row?: G,
) {
  const toWgsl = setupExprBuilder(from);

  // const structFieldDecls = aggregations.map((a, i) => `f_${i} : ${a.kind === 'count' ? 'u32' : a.expr.type}`).join(',\n')
  let bindingStart = 1;
  let bindings: string = '';

  const bindingLookups: Record<string, Record<string, number>> = {};
  for (const t of Object.keys(tables)) {
    const binding = generateTableBindings(t, tables[t]!, 1, bindingStart);
    bindings += `\n //${t}\n${binding.decls}\n`;
    bindingStart += binding.numBindings;
    bindingLookups[t] = binding.bindingLookup;
  }
    const { components, type, expr } = figureOut(tables, aggregation, (s) => toWgsl(s, 'element', ''))
    if (type === 'f32' || type === 'u32') {
      return generateHistogramShader({
          aggComponents: components,
          aggType: type,
          aggregationExpr:expr,
          colGroupExpr: toWgsl(col,'element',''),
          rowGroupExpr:row ? toWgsl(row,'element',''):'0',
          inputBindings:bindings
      })
    }
    // todo - throw or something?
    return undefined;
}
function buildPipeline(dev:GPUDevice,code:string,format:GPUTextureFormat,op:'min'|'max'|'add',label:string) {
    const module = dev.createShaderModule({
      label,
      code,
  });

  const defs = wgh.makeShaderDataDefinitions(code);
  const desc: wgh.PipelineDescriptor = {
      vertex: {
          entryPoint: 'vmain',
      },
      fragment: {
        entryPoint:'fmain',
      }
  };
  const layouts = wgh.makeBindGroupLayoutDescriptors(defs, desc);
  const pipeLayout: GPUPipelineLayout = dev.createPipelineLayout({
      bindGroupLayouts: layouts.map((d) => dev.createBindGroupLayout(d)),
  });
  const pipeline = dev.createRenderPipeline({
      label,
      vertex: {
          module,
        entryPoint:'vmain'
      }, fragment: {
          module,
          entryPoint: 'fmain',
          targets: [{
              format,
              blend: {
                  alpha: {
                      srcFactor: 'one',
                      dstFactor: 'one',
                      operation:op
                  }, color: {
                    srcFactor: 'one',
                    dstFactor: 'one',
                    operation:op
              }
            }
          }]
      },
      layout: pipeLayout,
  });
  return { defs, pipeline };
}
