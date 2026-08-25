import type { AST, ColumnExpr, IndexExpr, ITable, ScalarType, Tables, WgslType } from '../types';
import { generateTableBindings, setupExprBuilder } from '../gen';
import { generateHistogramShader } from './histogram';
import * as wgh from 'webgpu-utils';
import { every } from 'lodash-es';
export type Agg =
    | {
          kind: 'min' | 'max' | 'sum';
          expr: IndexExpr<string, string, ScalarType> | ColumnExpr<string, string, ScalarType>;
      }
    | {
          kind: 'count';
      };

type G = IndexExpr<string, string, ScalarType> | ColumnExpr<string, string, ScalarType>;
type S = G | '$count' | '$unused';
type M = G | '$unused';
type SumLayout = [S, S, S, S];
type SatLayout = [M, M, M, M];

type AggregationConfig =
    | {
          op: 'sum';
          layout: SumLayout;
      }
    | {
          op: 'min' | 'max';
          layout: SatLayout;
      };
function figureOut(tables: Tables, conf: AggregationConfig, toWgsl: (e: G) => string) {
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
            return determineType(tables, elem);
        }
        return type === determineType(tables, elem) ? type : null;
    }, undefined);
    // TODO panic if type == null or undefined
    const typeSuffix = type === 'f32' ? 'f' : 'u';
    // we can only write to certain formats
    // we can write a single channel, 2 channels, or 4 - never 3
    const [_r, g, b, a] = conf.layout;
    let components: 1 | 2 | 4 = 4;
    let [R, G, B, A] = conf.layout.map((c) => {
        if (c === '$count') {
            return '1';
        }
        if (c === '$unused') {
            return '0';
        }
        return toWgsl(c);
    });
    let expr = `vec4${typeSuffix}(${R},${G},${B},${A})`;
    if (every([g, b, a], (c) => c === '$unused')) {
        components = 1;
        expr = R;
    } else if (every([b, a], (c) => c === '$unused')) {
        components = 2;
        expr = `vec2${typeSuffix}(${type}(${R}),${type}(${G}))`;
    }
    return { type, components, expr };
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
export function generateAggregationShader(
    tables: Tables,
    from: string,
    aggregation: AggregationConfig,
    col: G,
    row?: G
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
    const { components, type, expr } = figureOut(tables, aggregation, (s) => toWgsl(s, 'element', ''));
    if (type === 'f32' || type === 'u32') {
        const code = generateHistogramShader({
            aggComponents: components,
            aggType: type,
            aggregationExpr: expr,
            colGroupExpr: toWgsl(col, 'element', ''),
            rowGroupExpr: row ? toWgsl(row, 'element', '') : '0u',
            inputBindings: bindings,
        });
        let format: GPUTextureFormat = 'rgba32float';
        if (type === 'f32') {
            if (components === 1) {
                format = 'r32float';
            } else if (components === 2) {
                format = 'rg32float';
            } else {
                format = 'rgba32float';
            }
        } else if (type === 'u32') {
            if (components === 1) {
                format = 'r32uint';
            } else if (components === 2) {
                format = 'rg32uint';
            } else {
                format = 'rgba32uint';
            }
        }
        return { code, format, op: aggregation.op === 'sum' ? 'add' : aggregation.op } as const;
    }
    // todo - throw or something?
    return undefined;
}
export function buildPipeline(
    dev: GPUDevice,
    code: string,
    format: GPUTextureFormat,
    op: 'min' | 'max' | 'add',
    label: string
) {
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
            entryPoint: 'fmain',
        },
    };
    const layouts = wgh.makeBindGroupLayoutDescriptors(defs, desc);
    const pipeLayout: GPUPipelineLayout = dev.createPipelineLayout({
        bindGroupLayouts: layouts.map((d) => dev.createBindGroupLayout(d)),
    });
    const pipeline = dev.createRenderPipeline({
        label,
        primitive: {
            topology: 'point-list',
        },
        vertex: {
            module,
            entryPoint: 'vmain',
        },
        fragment: {
            module,
            entryPoint: 'fmain',

            targets: [
                {
                    format,
                    blend: {
                        alpha: {
                            srcFactor: 'one',
                            dstFactor: 'one',
                            operation: op,
                        },
                        color: {
                            srcFactor: 'one',
                            dstFactor: 'one',
                            operation: op,
                        },
                    },
                },
            ],
        },
        layout: pipeLayout,
    });
    return { defs, pipeline };
}
