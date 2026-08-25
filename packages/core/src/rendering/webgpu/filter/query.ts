import { buildFilterPipeline } from './build';
import { assembleQuery, setupExprBuilder } from './gen';
import * as wgh from 'webgpu-utils';
import type {
    alpha,
    Tables,
    SwizzleIndexExpr,
    ComponentType,
    IndexExpr,
    SwizzleExpr,
    AST,
    BufferTables,
    ColumnExpr,
    OP,
    PExpr,
    RunFilterArgs,
    RunIndexedFilterArgs,
    Sel,
    TsType,
    VOP,
    WgslType,
    ScalarType,
    VLen,
    VectorType,
    onlyLetters,
    ArrayBufferTables,
    vKeys,
    ITable,
} from './types';
import { buildRunner } from './aggregate/runner'
import { mapValues } from 'lodash-es';
import { buildPipeline, generateAggregationShader } from './aggregate/gen';

const entries = <T extends {}>(r: T): ReadonlyArray<[string, T[keyof T]]> => Object.entries(r);

function predicate<S extends VLen, L extends ScalarType | VectorType<S>, P extends `${alpha}${string}`>(
    lhs: IndexExpr<string, string, L> | ColumnExpr<string, string, L>,
    op: L extends ScalarType ? OP : VOP,
    rhs: onlyLetters<P>
) {
    return {
        kind: 'predicate',
        lhs,
        op,
        rhs,
    } as const;
}
class Clause<Params extends Record<string, string | number | number[]>> {
    predicates: Array<PExpr<`${alpha}${string}`>>;
    constructor(
        readonly tables: Tables,
        preds: Array<ReturnType<typeof predicate<VLen, WgslType, `${alpha}${string}`>>>
    ) {
        this.predicates = preds;
    }
    or<S extends VLen, L extends ScalarType | VectorType<S>, P extends `${alpha}${string}`>(
        lhs: IndexExpr<string, string, L> | ColumnExpr<string, string, L>,
        op: L extends ScalarType ? OP : VOP,
        rhs: onlyLetters<P>
    ) {
        return new Clause<Params & { [k in P]: TsType<L> }>(this.tables, [...this.predicates, predicate(lhs, op, rhs)]);
    }
    paramDeclarations() {
        return this.predicates.reduce(
            (acc, p) => ({ ...acc, [p.rhs]: determineType(this.tables, p.lhs) }),
            {} as Record<string, string>
        );
    }
}

class AndGroup<Params extends Record<string, string | number | number[]>> {
    ands: Clause<Parameters>[];
    constructor(clauses: Clause<Parameters>[]) {
        this.ands = clauses;
    }
    and<GroupParams extends Record<string, string | number | number[]>>(clause: Clause<GroupParams>) {
        return new AndGroup<GroupParams & Params>([...this.ands, clause]);
    }
    paramDeclarations() {
        return this.ands.reduce(
            (acc, clause) => ({ ...acc, ...clause.paramDeclarations() }),
            {} as Record<string, string>
        );
    }
}





function compilePredicate<Params extends Record<string, string | number | number[]>>(
    toWgsl: ReturnType<typeof setupExprBuilder>,
    group: AndGroup<Params> | Clause<Params>,
    uniName: string
) {
    return group instanceof AndGroup
        ? group.ands
            .flatMap((c) => `(${c.predicates.flatMap((p) => toWgsl(p, 'element', uniName)).join(' || ')})`)
            .join(' && ')
        : group.predicates.flatMap((p) => toWgsl(p, 'element', uniName)).join(' || ');
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
function mapTablesToBindings<Ts extends Tables>(
    tables: BufferTables<Ts>,
    lookups: Record<string, Record<string, number>>
): { resource: GPUBuffer; binding: number }[] {
    return entries(tables)
        .flatMap(([name, table]) => {
            return entries(table).map(([field, buffer]) => {
                const b = lookups[name]?.[field];
                if (b) {
                    return { resource: buffer as GPUBuffer, binding: b };
                }
                return undefined;
            });
        })
        .filter((x) => x !== undefined);
}
class Selection<Ts extends Tables, From extends keyof Ts> {
    selections: ReadonlyArray<Sel>;
    toWgsl: ReturnType<typeof setupExprBuilder>;
    constructor(
        readonly tables: Ts,
        readonly from: From,
        selections: ReadonlyArray<Sel>
    ) {
        this.selections = selections;
        this.toWgsl = setupExprBuilder(this.from as string);
    }
    select(selection: '$index' | IndexExpr<string, string, WgslType> | ColumnExpr<string, string, WgslType>) {
        const s = selection === '$index' ? 'tmp - 1' : this.toWgsl(selection, 'tmp - 1', ''); // uni-name not relavant in selection...
        const type = determineType(this.tables, selection);
        return new Selection(this.tables, this.from, [...this.selections, { selection: s, type }]);
    }

    where<Params extends Parameters>(predicates: AndGroup<Params> | Clause<Params>) {
        // constants //

        const START_BINDING = 3;
        const UNI_INSTANCE_NAME = 'params';
        const UNI_STRUCT_TYPE_NAME = 'Params';
        const WG_SIZE = 64;
        const paramTypes = predicates.paramDeclarations();
        const paramDecls = entries(paramTypes)
            .map(([name, type]) => `${name}:${type}`)
            .join(',\n');

        const { tables } = this;

        const predicateExpr = `(${compilePredicate(this.toWgsl, predicates, UNI_INSTANCE_NAME)})`;
        let binding = START_BINDING;
        let columnBindings: Record<string, Record<string, number>> = {};
        // associate a binding with every field of every table
        for (const t of Object.keys(tables)) {
            columnBindings[t] = {};
            for (const col of Object.keys(tables[t]!)) {
                columnBindings[t]![col] = binding;
                binding += 1;
            }
        }

        const makeRunner = <Indexed extends boolean>(options: {
            device: GPUDevice;
            pipe: ReturnType<typeof buildFilterPipeline>;
            shader: string;
            safeLookups: Record<string, Record<string, number>>;
            indexed: Indexed;
            label: string;
            wgSize: number;
            serializeParameters: (p: Params, buffer?: ArrayBuffer) => ArrayBuffer;
        }) => {
            const { device, pipe, safeLookups, indexed, label, wgSize } = options;
            const runner = (args: Indexed extends true ? RunIndexedFilterArgs<Ts> : RunFilterArgs<Ts>) => {
                const { enc, parameters, sets, timestampWrites } = args;

                // zero out the result counters...
                args.sets.forEach((s) => {
                    device.queue.writeBuffer(s.resultCounter, 0, new Uint32Array([0]));
                });
                const bindings = indexed
                    ? (args as RunIndexedFilterArgs<Ts>).sets.map((s, i) => {
                        return device.createBindGroup({
                            layout: pipe.pipeline.getBindGroupLayout(1),
                            entries: [
                                { binding: 0, resource: s.resultCounter },
                                { binding: 1, resource: s.results },
                                { binding: 2, resource: s.elements },
                                ...mapTablesToBindings(s.tables, safeLookups),
                            ],
                        });
                    })
                    : args.sets.map((s, i) => {
                        return device.createBindGroup({
                            layout: pipe.pipeline.getBindGroupLayout(1),
                            entries: [
                                { binding: 0, resource: s.resultCounter },
                                { binding: 1, resource: s.results },
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
                    // console.log('running filter-->',s.results.label)
                    pass.setBindGroup(1, bg1);
                    const dispatchCount = Math.ceil(s.rowCount / wgSize);
                    pass.dispatchWorkgroups(dispatchCount);
                }
                pass.end();
            };
            function validate(
                dev: GPUDevice,
                serializeParameters: (p: Params, buffer?: ArrayBuffer) => ArrayBuffer,
                tables: ArrayBufferTables<Ts>,
                params: Params,
                expected: { buffer: ArrayBuffer },
                elements: Uint32Array | number
            ) {
                const R = GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
                const M = GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ;
                const enc = dev.createCommandEncoder();
                const pBytes = serializeParameters(params);
                const paramB = dev.createBuffer({
                    size: pBytes.byteLength,
                    usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
                    label: 'validate params',
                });
                dev.queue.writeBuffer(paramB, 0, pBytes);
                const inputs: GPUBuffer[] = [];

                const tableBuffers: BufferTables<Ts> = mapValues(
                    tables,
                    (table: Record<string, { buffer: ArrayBuffer }>) =>
                        mapValues(table, (column: { buffer: ArrayBuffer }) => {
                            const buf = dev.createBuffer({ size: column.buffer.byteLength, usage: R });
                            dev.queue.writeBuffer(buf, 0, column.buffer);
                            inputs.push(buf);
                            return buf;
                        })
                ) as BufferTables<Ts>; // TS cant tell, mapValues I think does erase the info...

                const rowCount: number = elements instanceof Uint32Array ? elements.length : elements;
                let elemBuffer: GPUBuffer | undefined;
                if (elements instanceof Uint32Array) {
                    elemBuffer = dev.createBuffer({ size: elements.buffer.byteLength, usage: R });
                    dev.queue.writeBuffer(elemBuffer, 0, elements.buffer);
                }
                const resultsCounter = dev.createBuffer({ size: 16, usage: R });
                const results = dev.createBuffer({ size: rowCount * 32, usage: R });
                const resolve = dev.createBuffer({ size: rowCount * 32, usage: M });
                // very awkward a bit longwinded, and there are some TS issues, but its ok!
                if (indexed) {
                    const iArgs: RunIndexedFilterArgs<Ts> = {
                        enc,
                        parameters: paramB,
                        sets: [
                            {
                                elements: elemBuffer!,
                                resultCounter: resultsCounter,
                                results,
                                rowCount,
                                tables: tableBuffers,
                            },
                        ],
                    };
                    (runner as (args: RunIndexedFilterArgs<Ts>) => void)(iArgs);
                } else {
                    const args: RunFilterArgs<Ts> = {
                        enc,
                        parameters: paramB,
                        sets: [
                            {
                                resultCounter: resultsCounter,
                                results,
                                rowCount,
                                tables: tableBuffers,
                            },
                        ],
                    };
                    (runner as (args: RunFilterArgs<Ts>) => void)(args);
                }
                enc.copyBufferToBuffer(results, resolve);
                dev.queue.submit([enc.finish()]);
                // ok now get the results and compare them!
                return resolve
                    .mapAsync(GPUMapMode.READ)
                    .then(() => {
                        const recvd = resolve.getMappedRange();
                        const dv = new DataView(recvd);
                        const copy = new Uint8Array(dv.buffer.byteLength);
                        copy.set(new Uint8Array(dv.buffer));
                        const ex = new DataView(expected.buffer);
                        for (let i = 0; i < expected.buffer.byteLength; i++) {
                            if (dv.getUint8(i) !== ex.getUint8(i)) {
                                return { status: 'failure', result: copy } as const;
                            }
                        }
                        return { status: 'success' } as const;
                    })
                    .finally(() => {
                        // destroy all things
                        resolve.unmap();
                        [resolve, paramB, resultsCounter, results, ...inputs].forEach((b) => b.destroy());
                        if (elemBuffer) {
                            elemBuffer.destroy();
                        }
                    });
            }

            return { runner, validate };
        };
        const buildHelper = <Indexed extends boolean>(device: GPUDevice, label: string, indexed: Indexed) => {
            const Q = assembleQuery(
                {
                    from: this.from as string,
                    selections: this.selections,
                    tables,
                    uniformName: UNI_INSTANCE_NAME,
                    uniformTypeName: UNI_STRUCT_TYPE_NAME,
                },
                predicateExpr,
                paramDecls,
                64,
                indexed
            );
            const pipe = buildFilterPipeline(device, Q.shader, 'main', label);
            const uniDef = pipe.defs.structs[UNI_STRUCT_TYPE_NAME]!;
            const serializeParameters = (parameters: Params, buffer?: ArrayBuffer) => {
                const unis = wgh.makeStructuredView(uniDef, buffer);
                unis.set(parameters);
                return unis.arrayBuffer;
            };

            const { runner, validate } = makeRunner({
                device,
                indexed,
                label,
                pipe,
                safeLookups: columnBindings,
                serializeParameters,
                shader: Q.shader,
                wgSize: WG_SIZE,
            });
            return {
                run: runner,
                validate,
                serializeParameters,
                pipeline: pipe,
                parameterTypeDef: uniDef,
            };
        };
        return {
            shaderOnly: () => {
                const Q = assembleQuery(
                    {
                        from: this.from as string,
                        selections: this.selections,
                        tables,
                        uniformName: UNI_INSTANCE_NAME,
                        uniformTypeName: 'Params',
                    },
                    predicateExpr,
                    paramDecls,
                    64,
                    false
                );
                return Q.shader;
            },

            build: (device: GPUDevice, label: string) => {
                return buildHelper(device, label, false);
            },
            buildIndexed: (device: GPUDevice, label: string) => {
                return buildHelper(device, label, true);
            },
        };
    }
}

export function given<Ts extends Tables>(tables: Ts) {
    function any<S extends VLen, L extends ScalarType | VectorType<S>, P extends `${alpha}${string}`>(
        lhs: IndexExpr<string, string, L> | ColumnExpr<string, string, L>,
        op: L extends ScalarType ? OP : VOP,
        rhs: onlyLetters<P>
    ) {
        return new Clause<{ [k in P]: TsType<L> }>(tables, [predicate(lhs, op, rhs)]);
    }
    function all<Params extends Record<string, string | number | number[]>>(clause: Clause<Params>) {
        return new AndGroup<Params>([clause]);
    }
    // these are fun...  they do belong in types.ts, but moving them there means they no longer directly deal with Ts
    // I think that discconnect pushes TS over the edge and they end up not working - everything turns to unknown

    /* oxlint-disable typescript/no-explicit-any */
    type UnionToIntersection<U> = (U extends any ? (x: U) => void : never) extends (x: infer I) => void ? I : never;

    type ExpandTableColumn<T extends keyof Ts, F extends keyof Ts[T]> = F extends string ? vKeys<Ts[T], F> & T : never;
    type ExpandTableVectors<T extends keyof Ts> = keyof Ts[T] extends string
        ? UnionToIntersection<ExpandTableColumn<T, keyof Ts[T]>>
        : never;
    return {
        from: <From extends keyof Ts>(from: From) => {
            type GroupSubject<Ts extends Tables, From extends keyof Ts, O extends keyof Ts> =
                IndexExpr<O & string, string, 'u32'> |
                ColumnExpr<From & string, string, 'u32'>
            type AggregationSubject<Ts extends Tables, From extends keyof Ts, O extends keyof Ts> =
                From extends string ?
                O extends string ?
                keyof Ts[From] extends string ?
                keyof Ts[O] extends string ?
                IndexExpr<O, string, ScalarType> |
                ColumnExpr<From, string, ScalarType>
                : never : never : never : never
            function groupBy<ColGroup extends keyof Ts, RowGroup extends keyof Ts>(col: GroupSubject<Ts, From, ColGroup>, row?: GroupSubject<Ts, From, RowGroup>,) {
                type G = IndexExpr<string, string, ScalarType> |
                    ColumnExpr<string, string, ScalarType>
                type S = G | '$count' | '$unused'
                type M = G | '$unused'
                type SumLayout = [S, S, S, S]
                type SatLayout = [M, M, M, M]

                type AggregationConfig = {
                    op: 'sum',
                    layout: SumLayout;
                } | {
                    op: 'min' | 'max',
                    layout: SatLayout;
                }
                function buildAggregate(dev: GPUDevice, conf: AggregationConfig) {
                    const shader = generateAggregationShader(tables, from as string, conf, col, row)
                    if (!shader) {
                        // todo think about how to handle...
                        return undefined;
                    }
                    const { code, format, op } = shader;
                    const pipe = buildPipeline(dev, code, format, op, 'histogram');
                    // create a runner 
                    return { run: buildRunner(dev, tables, pipe) }
                }
                return {
                    min: <R extends keyof Ts, G extends keyof Ts, B extends keyof Ts, A extends keyof Ts>(
                        r: '$unused' | AggregationSubject<Ts, From, R>,
                        g: '$unused' | AggregationSubject<Ts, From, G>,
                        b: '$unused' | AggregationSubject<Ts, From, B>,
                        a: '$unused' | AggregationSubject<Ts, From, A>) => {
                        return {
                            build: (device: GPUDevice) => {
                                return buildAggregate(device, { op: 'min', layout: [r, g, b, a] })
                            }
                        }
                    },
                    max: <R extends keyof Ts, G extends keyof Ts, B extends keyof Ts, A extends keyof Ts>(
                        r: '$unused' | AggregationSubject<Ts, From, R>,
                        g: '$unused' | AggregationSubject<Ts, From, G>,
                        b: '$unused' | AggregationSubject<Ts, From, B>,
                        a: '$unused' | AggregationSubject<Ts, From, A>) => {
                        return {
                            build: (device: GPUDevice) => {
                                return buildAggregate(device, { op: 'max', layout: [r, g, b, a] })
                            }
                        }
                    },
                    sum: <R extends keyof Ts, G extends keyof Ts, B extends keyof Ts, A extends keyof Ts>(
                        r: '$count' | '$unused' | AggregationSubject<Ts, From, R>,
                        g: '$count' | '$unused' | AggregationSubject<Ts, From, G>,
                        b: '$count' | '$unused' | AggregationSubject<Ts, From, B>,
                        a: '$count' | '$unused' | AggregationSubject<Ts, From, A>) => {
                        return {
                            build: (device: GPUDevice) => {
                                buildAggregate(device, { op: 'sum', layout: [r, g, b, a] })
                            }
                        }
                    },

                }
            }
            function column<E extends keyof ExpandTableVectors<From>>(
                k: E
            ): ColumnExpr<From, string, ExpandTableVectors<From>[E]> {
                return {
                    kind: 'from field',
                    from: from,
                    field: k as string,
                    type: inferType(tables[from], k as string) as ExpandTableVectors<From>[E],
                };
            }
            function table<Other extends Exclude<keyof Ts, From>>(t: Other) {
                return {
                    at: <E extends SwizzleIndexExpr<Ts, From, keyof Ts[From]>>(
                        indexExpr: E | IndexExpr<string, string, 'u32'>
                    ) => {
                        return {
                            dot: <OE extends keyof ExpandTableVectors<Other>>(field: OE) => {
                                const IE: IndexExpr<Other, string, ExpandTableVectors<Other>[OE]> = {
                                    kind: 'table at field',
                                    table: t,
                                    field: field as string,
                                    atExpr: indexExpr,
                                    type: inferType(tables[t], field as string) as ExpandTableVectors<Other>[OE],
                                };
                                return IE;
                            },
                        };
                    },
                };
            }

            const toWgsl = setupExprBuilder(from as string);
            function select(
                selection: '$index' | IndexExpr<string, string, WgslType> | ColumnExpr<string, string, WgslType>
            ) {
                const s = selection === '$index' ? 'tmp - 1' : toWgsl(selection, 'tmp - 1', '');
                const type = determineType(tables, selection);
                return new Selection(tables, from, [{ selection: s, type }]);
            }
            // const { groupBy, min, max, sum } = setupAggregator<Tables,From>(tables, from)
            return { column, table, any, all, clause: any, select, groupBy };
        },
    };
}
type Parameters = Record<string, string | number | number[]>;

// this function is not exported or called - its only purpose is to explode if something in the above file
// changes enough to mess up the types - we want restrictive types here, its the whole point
function typescriptCanary() {
    type hey = { cells: { A: 'f32'; B: 'vec2f' }; edges: { E: 'vec2u'; str: 'f32' } };
    const e = given({ cells: { A: 'f32', B: 'vec2f' }, edges: { E: 'vec2u', str: 'f32' } }).from('edges');

    e.groupBy(e.column('E.x'), e.column('E.y')).min(e.column('str'), e.table('cells').at('E.x').dot('A'), '$unused', '$unused')
    // .build(null as any).run(null as any, [{ count: 33, tables: {} }],)
    // @ts-expect-error
    e.select('$index').where(e.clause(e.table('cells').at('E.x').dot('B'), '==', 'mom'));
    // @ts-expect-error
    e.select('$index').where(e.clause(e.column('E.x'), 'all(==)', 'mom'));
}
