import { entries, flatMap, keys, map, values } from 'lodash';
import { buildPipeline } from './build';
import { genQuery, indexExprType, looksLikeIndexExpr } from './gen';
import type { Tables, ITable, PredLst, FilterShaderQueryContext, VarName, FilteredTable, RunFilterArgs, PredExpr, Given, GivenTable, SelectedTable, BufferTables, SimplePredExpr, OP, VOP, IndexedReference, RunIndexedFilterArgs, PredicateExpr, TsType } from './types';
import * as wgh from 'webgpu-utils'


export class FilterTable<Ts extends Tables, T extends ITable, Params extends Record<string, number | number[]>> {
  private predicates: PredLst;
  private ctx: FilterShaderQueryContext<Ts>;
  constructor(ctx: FilterShaderQueryContext<Ts>, preds?: PredLst) {
    this.predicates = preds ?? [];
    this.ctx = ctx;
  }
  and<Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(pred: PredExpr<T, Ti, Ts, O, F, Param>): FilteredTable<Ts, T, typeof pred extends
    PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> }> {
    return new FilterTable<Ts, T, typeof pred extends
      PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> }>(this.ctx, [...this.predicates, { OP: 'and', pred }]);
  }
  or<Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(pred: PredExpr<T, Ti, Ts, O, F, Param>): FilteredTable<Ts, T, typeof pred extends
    PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> }> {
    return new FilterTable<Ts, T, typeof pred extends
      PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> }>(this.ctx, [...this.predicates, { OP: 'or', pred }]);
  }
  // build vs. buildIndexed are nearly identical - this function builds either
  // and does a little TS trickery to help us not repeat the body of the builder
  private buildHelper<Indexed extends boolean>(device: GPUDevice, label: string, indexed: Indexed): { shader: string, pipeline: ReturnType<typeof buildPipeline>, run: (args: Indexed extends true ? RunIndexedFilterArgs<Ts, Params> : RunFilterArgs<Ts, Params>) => GPUBuffer[] } {
    const wgSize = 64
    const Q = genQuery(this.ctx, this.predicates, wgSize, indexed);
    console.dir(Q)
    const pipe = buildPipeline(device, Q.shader, 'main', label);
    const safeLookups = omitUnreferencedColumns(
      [this.ctx.firstPred, ...map(this.predicates, p => p.pred)],
      this.ctx.tables, this.ctx.from, this.ctx.select, Q.bindingLookups);

    const runner = (args: Indexed extends true ? RunIndexedFilterArgs<Ts, Params> : RunFilterArgs<Ts, Params>) => {
      const { enc, parameters, sets } = args;
      // TODO - a buffer pool would be nice
      const uniDef = pipe.defs.structs[this.ctx.uniformTypeName]!
      const unis = wgh.makeStructuredView(pipe.defs.structs[this.ctx.uniformTypeName]!)

      const resultCounters = args.sets.map((s) => {
        const counterStorage = device.createBuffer({
          size: 4,
          usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC
        });
        device.queue.writeBuffer(counterStorage, 0, new Uint32Array([0]))
        return counterStorage;
      })
      const bindings = indexed ? (args as RunIndexedFilterArgs<Ts, Params>).sets.map((s, i) => {
        const counter = resultCounters[i]!
        return device.createBindGroup({
          layout: pipe.pipeline.getBindGroupLayout(1), entries: [
            { binding: 2, resource: s.elements },
            { binding: 1, resource: s.results },
            { binding: 0, resource: counter },
            ...mapTablesToBindings(s.tables, safeLookups),
          ]
        });
      }) : args.sets.map((s, i) => {
        const counter = resultCounters[i]!
        return device.createBindGroup({
          layout: pipe.pipeline.getBindGroupLayout(1), entries: [
            { binding: 1, resource: s.results },
            { binding: 0, resource: counter },
            ...mapTablesToBindings(s.tables, safeLookups),
          ]
        });
      })

      const ubo = device.createBuffer({
        size: uniDef.size,
        label: `${label} uniform buffer`,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM
      });
      unis.set(parameters);
      console.log('setting uni params:', parameters)
      device.queue.writeBuffer(ubo, 0, unis.arrayBuffer);
      console.log('serialized params:', unis.arrayBuffer)
      const bg0 = device.createBindGroup({
        layout: pipe.pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: ubo },
        ]
      })

      const pass = enc.beginComputePass({
        label,
      });
      pass.setPipeline(pipe.pipeline);
      pass.setBindGroup(0, bg0);
      for (let i = 0; i < sets.length; i++) {
        const s = sets[i]!;
        const bg1 = bindings[i]!;
        pass.setBindGroup(1, bg1);
        const dispatchCount = Math.ceil(s.rowCount / wgSize);
        pass.dispatchWorkgroups(dispatchCount);
      }
      pass.end();
      // leave encoder open - done!
      // return the counter-buffers we allocated so they can be read...hmm
      // maybe we force the caller to give us the buffers? blerg
      return resultCounters;
    }
    return {
      pipeline: pipe,
      shader: Q.shader,
      run: runner
    }
  }
  build(device: GPUDevice, label: string): ReturnType<FilteredTable<Ts, T, Params>['build']> {
    return this.buildHelper<false>(device, label, false);
  }
  buildIndexed(device: GPUDevice, label: string): ReturnType<FilteredTable<Ts, T, Params>['buildIndexed']> {
    return this.buildHelper<true>(device, label, true);
  }
}
// unfortunately - wgh doesnt do this for us like I thought it would
// instead, we have to dig it out of thepredicates
function collectReferencedColumns(preds: SimplePredExpr[], tables: Tables, from: string): { table: string, column: string }[] {
  return flatMap(preds, (p) => references(p, tables, from))
}
function references(pred: SimplePredExpr, tables: Tables, from: string) {
  const [lhs, _op, _rhs] = pred.split(' ') as [string, OP | VOP, string]

  const index = looksLikeIndexExpr(lhs, tables, from)
  if (index) {
    return [{ table: index.from, column: index.index_field }, { table: index.fTable, column: index.selection }]
  } else {
    return [{ table: from, column: lhs }]
  }
}
function omitUnreferencedColumns(preds: SimplePredExpr[], tables: Tables, from: string, select: string, bindings: Record<string, Record<string, number>>) {
  // for each table, for each column
  // find its binding in the defs
  // if we cant - we need to omit it at the point at which we create a bindgroup for it

  let safeLookups: Record<string, Record<string, number>> = {}
  const referenced = collectReferencedColumns(preds, tables, from)
  const keep = (table: string, column: string, b: number) => {
    if (!safeLookups[table]) {
      safeLookups[table] = {}
    }
    safeLookups[table][column] = b;
  }
  for (const ref of referenced) {
    const { table, column } = ref;
    const b = bindings[table]![column]!;
    keep(table, column, b)
  }
  if (select !== `$index`) {
    const projected = looksLikeIndexExpr(select, tables, from);
    if (projected) {
      keep(projected.from, projected.index_field, bindings[projected.from]![projected.index_field]!)
      keep(projected.fTable, projected.selection, bindings[projected.fTable]![projected.selection]!)
    } else {
      const b = bindings[from]![select]!;
      keep(from, select, b);
    }
  }

  return safeLookups;
}
function mapTablesToBindings<Ts extends Tables>(tables: BufferTables<Ts>, lookups: Record<string, Record<string, number>>) {
  return flatMap(entries(tables), ([name, table]) => {
    return map(entries(table), ([field, buffer]) => {
      const b = lookups[name]?.[field];
      if (b) {
        return { resource: buffer, binding: b }
      }
      console.log('omit ', name, field, ' its not referenced!')
      return undefined;
    })
  }).filter(x => x !== undefined)
}

export function given<Ts extends Tables>(ts: Ts): Given<Ts> {
  return {
    from: <Tbl extends keyof Ts>(tbl: Tbl): GivenTable<Ts[Tbl], Ts> => {
      type T = Ts[Tbl];
      return {
        select: <Ti extends keyof T, O extends keyof Ts, oF extends keyof Ts[O]>(
          f: Ti | '$index' | IndexedReference<T, Ti, Ts, O, oF>
        ): SelectedTable<T, Ts> => {
          return {
            where: <Ti extends keyof T,
              O extends keyof Ts,
              F extends keyof Ts[O],
              Param extends VarName>(pred: PredExpr<T, Ti, Ts, O, F, Param>) => {
              return new FilterTable<Ts, T, typeof pred extends
                PredicateExpr<T, Ti, Param> ? { [k in Param]: TsType<T[Ti]> } : { [k in Param]: TsType<Ts[O][F]> }>({
                firstPred: pred,
                from: tbl as string,
                select: f as string,
                selectType: f === '$index' ?
                  'u32' :
                  indexExprType(f as string, ts, tbl as string) ?? ts[tbl]![f]!,
                tables: ts,
                uniformName: 'unis',
                uniformTypeName: 'Parameters',
                selectedField: f as string // I promise!
              })
            }
          }
        },
      }
    }
  }
}
