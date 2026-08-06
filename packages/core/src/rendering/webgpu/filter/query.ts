import { buildFilterPipeline } from './build';
import { genQuery, indexExprType, looksLikeIndexExpr } from './gen';
import type {
    Tables,
    ITable,
    PredLst,
    FilterShaderQueryContext,
    VarName,
    FilteredTable,
    RunFilterArgs,
    PredExpr,
    Given,
    GivenTable,
    SelectedTable,
    BufferTables,
    SimplePredExpr,
    OP,
    VOP,
    IndexedReference,
    RunIndexedFilterArgs,
    PredicateExpr,
    TsType,
    WgslType,
    Sel,
} from './types';
import * as wgh from 'webgpu-utils';

// so, because and and or cannot be mixed without parens in WGSL
// we need a structure to provide grouping
// there are a lot of ways we could do this, but I think the easiest
// that isnt too limiting is CNF, which means the AND of a bunch of clauses,
// each clause being 1 or more predicates, combined via ORs
// that would be nice, and would make it hard to produce shaders that cant compile
// but - its very long-winded in terms of connecting the types up...
// so lets use a simpler system...
// function clause() {

// }
// class Clause<Ts extends Tables, T extends ITable, Params extends Record<string, number | number[]>, Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName> {
//   constructor(pred: PredExpr<T, Ti, Ts, O, F, Param>) {

//   }
//   or<Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(pred: PredExpr<T, Ti, Ts, O, F, Param>): FilteredTable<Ts, T, typeof pred extends
//     PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> }> {
//     return new Clause<Ts, T, typeof pred extends
//   PredicateExpr<T, Ti, Param> ? Params & { [k in Param]: TsType<T[Ti]> } : Params & { [k in Param]: TsType<Ts[O][F]> },

//   }
// }

export class FilterTable<Ts extends Tables, T extends ITable, Params extends Record<string, number | number[]>> {
    private predicates: PredLst;
    private ctx: FilterShaderQueryContext<Ts>;
    constructor(ctx: FilterShaderQueryContext<Ts>, preds?: PredLst) {
        this.predicates = preds ?? [];
        this.ctx = ctx;
    }
    and<Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(
        pred: PredExpr<T, Ti, Ts, O, F, Param>
    ): FilteredTable<
        Ts,
        T,
        typeof pred extends PredicateExpr<T, Ti, Param>
            ? Params & { [k in Param]: TsType<T[Ti]> }
            : Params & { [k in Param]: TsType<Ts[O][F]> }
    > {
        return new FilterTable<
            Ts,
            T,
            typeof pred extends PredicateExpr<T, Ti, Param>
                ? Params & { [k in Param]: TsType<T[Ti]> }
                : Params & { [k in Param]: TsType<Ts[O][F]> }
        >(this.ctx, [...this.predicates, { OP: 'and', pred }]);
    }
    or<Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(
        pred: PredExpr<T, Ti, Ts, O, F, Param>
    ): FilteredTable<
        Ts,
        T,
        typeof pred extends PredicateExpr<T, Ti, Param>
            ? Params & { [k in Param]: TsType<T[Ti]> }
            : Params & { [k in Param]: TsType<Ts[O][F]> }
    > {
        return new FilterTable<
            Ts,
            T,
            typeof pred extends PredicateExpr<T, Ti, Param>
                ? Params & { [k in Param]: TsType<T[Ti]> }
                : Params & { [k in Param]: TsType<Ts[O][F]> }
        >(this.ctx, [...this.predicates, { OP: 'or', pred }]);
    }
    andOpen<Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(
        pred: PredExpr<T, Ti, Ts, O, F, Param>
    ): FilteredTable<
        Ts,
        T,
        typeof pred extends PredicateExpr<T, Ti, Param>
            ? Params & { [k in Param]: TsType<T[Ti]> }
            : Params & { [k in Param]: TsType<Ts[O][F]> }
    > {
        return new FilterTable<
            Ts,
            T,
            typeof pred extends PredicateExpr<T, Ti, Param>
                ? Params & { [k in Param]: TsType<T[Ti]> }
                : Params & { [k in Param]: TsType<Ts[O][F]> }
        >(this.ctx, [...this.predicates, { OP: 'and (', pred }]);
    }
    orOpen<Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(
        pred: PredExpr<T, Ti, Ts, O, F, Param>
    ): FilteredTable<
        Ts,
        T,
        typeof pred extends PredicateExpr<T, Ti, Param>
            ? Params & { [k in Param]: TsType<T[Ti]> }
            : Params & { [k in Param]: TsType<Ts[O][F]> }
    > {
        return new FilterTable<
            Ts,
            T,
            typeof pred extends PredicateExpr<T, Ti, Param>
                ? Params & { [k in Param]: TsType<T[Ti]> }
                : Params & { [k in Param]: TsType<Ts[O][F]> }
        >(this.ctx, [...this.predicates, { OP: 'or (', pred }]);
    }
    close() {
        return new FilterTable<Ts, T, Params>(this.ctx, [...this.predicates, { OP: ')' }]);
    }

    // build vs. buildIndexed are nearly identical - this function builds either
    // and does a little TS trickery to help us not repeat the body of the builder
    private buildHelper<Indexed extends boolean>(
        device: GPUDevice,
        label: string,
        indexed: Indexed
    ): {
        shader: string;
        serializeParameters: (parameters: Params, buffer?: ArrayBuffer) => ArrayBuffer;
        pipeline: ReturnType<typeof buildFilterPipeline>;
        run: (args: Indexed extends true ? RunIndexedFilterArgs<Ts> : RunFilterArgs<Ts>) => void;
    } {
        const wgSize = 64;
        const Q = genQuery(this.ctx, this.predicates, wgSize, indexed);
        const pipe = buildFilterPipeline(device, Q.shader, 'main', label);
        const withPreds = this.predicates.filter((p) => 'pred' in p);
        const safeLookups = omitUnreferencedColumns(
            [this.ctx.firstPred, ...withPreds.map((p) => p.pred)],
            this.ctx.tables,
            this.ctx.from,
            this.ctx.selections,
            Q.bindingLookups
        );

        const uniDef = pipe.defs.structs[this.ctx.uniformTypeName]!;
        const serializeParameters = (parameters: Params, buffer?: ArrayBuffer) => {
            const unis = wgh.makeStructuredView(uniDef, buffer);
            unis.set(parameters);
            return unis.arrayBuffer;
        };

        const runner = (args: Indexed extends true ? RunIndexedFilterArgs<Ts> : RunFilterArgs<Ts>) => {
            const { enc, parameters, sets, timestampWrites } = args;
            // here, we zero out the result counters
            // TODO - consider not doing this - if we didnt do that:
            // 1. we could potentially accumulate results onto results that had previously been captured in the results buffer
            // 2. we technically could invoke this whole thing in an open compute pass...? right?
            args.sets.forEach((s) => {
                device.queue.writeBuffer(s.resultCounter, 0, new Uint32Array([0]));
            });
            const bindings = indexed
                ? (args as RunIndexedFilterArgs<Ts>).sets.map((s, i) => {
                      return device.createBindGroup({
                          layout: pipe.pipeline.getBindGroupLayout(1),
                          entries: [
                              { binding: 2, resource: s.elements },
                              { binding: 1, resource: s.results },
                              { binding: 0, resource: s.resultCounter },
                              ...mapTablesToBindings(s.tables, safeLookups),
                          ],
                      });
                  })
                : args.sets.map((s, i) => {
                      return device.createBindGroup({
                          layout: pipe.pipeline.getBindGroupLayout(1),
                          entries: [
                              { binding: 1, resource: s.results },
                              { binding: 0, resource: s.resultCounter },
                              ...mapTablesToBindings(s.tables, safeLookups),
                          ],
                      });
                  });

            const bg0 = device.createBindGroup({
                layout: pipe.pipeline.getBindGroupLayout(0),
                entries: [{ binding: 0, resource: parameters }],
            });

            const pass = enc.beginComputePass(
                timestampWrites
                    ? {
                          label,
                          timestampWrites,
                      }
                    : { label }
            );
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
        };
        return {
            pipeline: pipe,
            serializeParameters,
            shader: Q.shader,
            run: runner,
        };
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
function collectReferencedColumns(
    preds: SimplePredExpr[],
    tables: Tables,
    from: string
): { table: string; column: string }[] {
    return preds.flatMap((p) => references(p, tables, from));
}
function references(pred: SimplePredExpr, tables: Tables, from: string) {
    const [lhs, _op, _rhs] = pred.split(' ') as [string, OP | VOP, string];

    const index = looksLikeIndexExpr(lhs, tables, from);
    if (index) {
        return [
            { table: index.from, column: index.index_field },
            { table: index.fTable, column: index.selection },
        ];
    } else {
        return [{ table: from, column: lhs }];
    }
}
function omitUnreferencedColumns(
    preds: SimplePredExpr[],
    tables: Tables,
    from: string,
    select: readonly Sel[],
    bindings: Record<string, Record<string, number>>
) {
    // for each table, for each column
    // find its binding in the defs
    // if we cant - we need to omit it at the point at which we create a bindgroup for it

    let safeLookups: Record<string, Record<string, number>> = {};
    const referenced = collectReferencedColumns(preds, tables, from);
    const keep = (table: string, column: string, b: number) => {
        if (!safeLookups[table]) {
            safeLookups[table] = {};
        }
        safeLookups[table][column] = b;
    };
    for (const ref of referenced) {
        const { table, column } = ref;
        const b = bindings[table]![column]!;
        keep(table, column, b);
    }
    for (const S of select) {
        const select = S.selection;
        if (select !== `$index`) {
            const projected = looksLikeIndexExpr(select, tables, from);
            if (projected) {
                keep(projected.from, projected.index_field, bindings[projected.from]![projected.index_field]!);
                keep(projected.fTable, projected.selection, bindings[projected.fTable]![projected.selection]!);
            } else {
                const b = bindings[from]![select]!;
                keep(from, select, b);
            }
        }
    }

    return safeLookups;
}
function mapTablesToBindings<Ts extends Tables>(
    tables: BufferTables<Ts>,
    lookups: Record<string, Record<string, number>>
) {
    return Object.entries(tables).flatMap(([name, table]) => {
        return Object.entries(table).map(([field, buffer]) => {
            const b = lookups[name]?.[field];
            if (b) {
                return { resource: buffer, binding: b };
            }
            return undefined;
        });
    }).filter((x) => x !== undefined);
}

type SelCtx<Ts extends Tables, Tbl extends keyof Ts> = {
    tables: Ts;
    tbl: Tbl;
    selections: ReadonlyArray<Sel>;
};
class Selection<Ts extends Tables, Tbl extends keyof Ts> {
    constructor(readonly ctx: SelCtx<Ts, Tbl>) {}
    select<Ti extends keyof Ts[Tbl], O extends keyof Ts, oF extends keyof Ts[O]>(
        f: Ti | '$index' | IndexedReference<Ts[Tbl], Ti, Ts, O, oF>
    ) {
        const { tables, tbl, selections } = this.ctx;
        const additionalSelection = {
            selection: f as string,
            type:
                f === '$index'
                    ? 'u32'
                    : (indexExprType(f as string, tables, tbl as string) ?? (tables[tbl]![f]! as WgslType)),
        } as const;
        const yay = [...selections, additionalSelection];
        return new Selection<Ts, Tbl>({
            ...this.ctx,
            selections: yay,
        });
    }
    where<Ti extends keyof Ts[Tbl], O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(
        pred: PredExpr<Ts[Tbl], Ti, Ts, O, F, Param>
    ) {
        const { tbl, tables: ts, selections } = this.ctx;

        return new FilterTable<
            Ts,
            Ts[Tbl],
            typeof pred extends PredicateExpr<Ts[Tbl], Ti, Param>
                ? { [k in Param]: TsType<Ts[Tbl][Ti]> }
                : { [k in Param]: TsType<Ts[O][F]> }
        >({
            firstPred: pred,
            from: tbl as string,
            selections,
            tables: ts,
            uniformName: 'unis',
            uniformTypeName: 'Parameters',
        });
    }
}

export function given<Ts extends Tables>(ts: Ts): Given<Ts> {
    return {
        from: <Tbl extends keyof Ts>(tbl: Tbl): GivenTable<Ts[Tbl], Ts> => {
            type T = Ts[Tbl];
            return {
                select: <Ti extends keyof T, O extends keyof Ts, oF extends keyof Ts[O]>(
                    f0: Ti | '$index' | IndexedReference<T, Ti, Ts, O, oF>
                ): SelectedTable<T, Ts> => {
                    const firstSelection = {
                        selection: f0 as string,
                        type:
                            f0 === '$index' ? 'u32' : (indexExprType(f0 as string, ts, tbl as string) ?? ts[tbl]![f0]!),
                    };
                    return {
                        select: <Ti extends keyof T, O extends keyof Ts, oF extends keyof Ts[O]>(
                            f: Ti | '$index' | IndexedReference<T, Ti, Ts, O, oF>
                        ): SelectedTable<T, Ts> => {
                            const second = {
                                selection: f as string,
                                type:
                                    f === '$index'
                                        ? 'u32'
                                        : (indexExprType(f as string, ts, tbl as string) ?? ts[tbl]![f]!),
                            };
                            return new Selection<Ts, Tbl>({
                                selections: [firstSelection, second],
                                tables: ts,
                                tbl,
                            });
                        },
                        where: <Ti extends keyof T, O extends keyof Ts, F extends keyof Ts[O], Param extends VarName>(
                            pred: PredExpr<T, Ti, Ts, O, F, Param>
                        ) => {
                            return new FilterTable<
                                Ts,
                                T,
                                typeof pred extends PredicateExpr<T, Ti, Param>
                                    ? { [k in Param]: TsType<T[Ti]> }
                                    : { [k in Param]: TsType<Ts[O][F]> }
                            >({
                                firstPred: pred,
                                from: tbl as string,
                                selections: [],
                                tables: ts,
                                uniformName: 'unis',
                                uniformTypeName: 'Parameters',
                            });
                        },
                    };
                },
            };
        },
    };
}
