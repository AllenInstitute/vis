import { buildFilterPipeline } from './build';
import { assembleQuery } from './gen';
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
    FType,
    Cmp,
    BTables,
} from './types';
import * as lo from 'lodash';
const { mapValues } = lo;

const entries = <T extends {}>(r: T): ReadonlyArray<[keyof T, T[keyof T]]> => Object.entries(r) as any;

export function given<Ts extends Tables>(tables: Ts) {
    return {
        from: <From extends keyof Ts>(from: From) => {
            function column<E extends SwizzleExpr<Ts, From, keyof Ts[From]>>(
                k: E
            ): E extends `${infer Field}.${string}`
                ? ColumnExpr<string, string, Cmp<FType<Ts[From], Field>>>
                : E extends `${infer Field}`
                  ? ColumnExpr<string, string, FType<Ts[From], Field>>
                  : never {
                return {
                    kind: 'from field',
                    from: from as string,
                    field: k,
                    type: undefined as unknown as any,
                } as any;
            }
            function table<Other extends Exclude<keyof Ts, From>>(t: Other) {
                return {
                    at: <E extends SwizzleIndexExpr<Ts, From, keyof Ts[From]>>(
                        indexExpr: E | IndexExpr<string, string, 'u32'>
                    ) => {
                        return {
                            dot: <Field extends keyof Ts[Other], OE extends SwizzleExpr<Ts, Other, Field>>(
                                field: OE
                            ) => {
                                const IE: IndexExpr<string, string, ComponentType<Ts, Other, Field, OE>> = {
                                    kind: 'table at field',
                                    table: t as string,
                                    field: field,
                                    atExpr: indexExpr,
                                    type: undefined as unknown as ComponentType<Ts, Other, Field, OE>, // TODO!
                                };
                                return IE;
                            },
                        };
                    },
                };
            }
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
                constructor(preds: Array<ReturnType<typeof predicate<VLen, WgslType, `${alpha}${string}`>>>) {
                    this.predicates = preds;
                }
                or<S extends VLen, L extends ScalarType | VectorType<S>, P extends `${alpha}${string}`>(
                    lhs: IndexExpr<string, string, L> | ColumnExpr<string, string, L>,
                    op: L extends ScalarType ? OP : VOP,
                    rhs: onlyLetters<P>
                ) {
                    return new Clause<Params & { [k in P]: TsType<L> }>([...this.predicates, predicate(lhs, op, rhs)]);
                }
                paramDeclarations() {
                    return this.predicates.reduce(
                        (acc, p) => ({ ...acc, [p.rhs]: determineType(p.lhs) }),
                        {} as Record<string, string>
                    );
                }
                // finish(params: Params) {

                // }
            }

            function any<S extends VLen, L extends ScalarType | VectorType<S>, P extends `${alpha}${string}`>(
                lhs: IndexExpr<string, string, L> | ColumnExpr<string, string, L>,
                op: L extends ScalarType ? OP : VOP,
                rhs: onlyLetters<P>
            ) {
                return new Clause<{ [k in P]: TsType<L> }>([predicate(lhs, op, rhs)]);
            }
            class AndGroup<Params extends Record<string, string | number | number[]>> {
                ands: Clause<Record<string, any>>[];
                constructor(clauses: Clause<Record<string, any>>[]) {
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
                // finish(params: Params) {

                // }
            }
            function all<Params extends Record<string, string | number | number[]>>(clause: Clause<Params>) {
                return new AndGroup<Params>([clause]);
            }
            function isVecOp(s: OP | VOP): s is VOP {
                return s.startsWith('a');
            }
            function parseVecOp(op: VOP) {
                const aggregation = op.substring(0, 3);
                const sop = op.substring(4).split(')')[0];
                return [aggregation, sop] as ['any' | 'all', OP];
            }
            function compy(ast: AST, indexing: string, uniName: string): string {
                switch (ast.kind) {
                    case 'from field': {
                        const [column, swizzle] = ast.field.split('.');
                        return swizzle
                            ? `${ast.from}_${column}[${indexing}].${swizzle}`
                            : `${ast.from}_${column}[${indexing}]`;
                    }
                    case 'table at field':
                        const subExpr =
                            typeof ast.atExpr === 'string'
                                ? `[${compy({ kind: 'from field', field: ast.atExpr, from: from as string, type: undefined as any }, indexing, uniName)}]`
                                : `[${compy(ast.atExpr, indexing, uniName)}]`;
                        const [column, swizzle] = ast.field.split('.');
                        const sel: string = `${ast.table}_${column}${subExpr}`;
                        return swizzle ? `${sel}.${swizzle}` : sel;
                    case 'predicate':
                        const { lhs, op, rhs } = ast;
                        if (isVecOp(op)) {
                            const [agg, sop] = parseVecOp(op);
                            return `${agg}(${compy(lhs, indexing, uniName)} ${sop} ${uniName}.${rhs})`;
                        }
                        return `${compy(lhs, indexing, uniName)} ${op} ${uniName}.${rhs}`;
                }
            }
            function compilePredicate<Params extends Record<string, string | number | number[]>>(
                group: AndGroup<Params> | Clause<Params>,
                uniName: string
            ) {
                return group instanceof AndGroup
                    ? group.ands
                          .flatMap((c) => `(${c.predicates.flatMap((p) => compy(p, 'element', uniName)).join(' || ')})`)
                          .join(' && ')
                    : group.predicates.flatMap((p) => compy(p, 'element', uniName)).join(' || ');
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
            function determineType(
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
            ) {
                return entries(tables)
                    .flatMap(([name, table]) => {
                        return entries(table).map(([field, buffer]) => {
                            // I promise, these are all strings, its ok
                            const b = lookups[name as string]?.[field as string];
                            if (b) {
                                return { resource: buffer, binding: b };
                            }
                            console.log('omit ', name, field, ' its not referenced!');
                            return undefined;
                        });
                    })
                    .filter((x) => x !== undefined);
            }
            class Selection {
                selections: ReadonlyArray<Sel>;
                constructor(selections: ReadonlyArray<Sel>) {
                    this.selections = selections;
                }
                select(
                    selection: '$index' | IndexExpr<string, string, WgslType> | ColumnExpr<string, string, WgslType>
                ) {
                    const s = selection === '$index' ? 'tmp - 1' : compy(selection, 'tmp - 1', ''); // uni-name not relavant in selection...
                    const type = determineType(selection);
                    return new Selection([...this.selections, { selection: s, type }]);
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
                    // const uniDecl = `struct ${UNI_STRUCT_NAME} {
                    //   ${paramDecls}
                    //   };`
                    const predicateExpr = `(${compilePredicate(predicates, UNI_INSTANCE_NAME)})`;
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
                        return runner;
                    };

                    return {
                        shaderOnly: () => {
                            const Q = assembleQuery(
                                {
                                    from: from as string,
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
                            const Q = assembleQuery(
                                {
                                    from: from as string,
                                    selections: this.selections,
                                    tables,
                                    uniformName: UNI_INSTANCE_NAME,
                                    uniformTypeName: UNI_STRUCT_TYPE_NAME,
                                },
                                predicateExpr,
                                paramDecls,
                                64,
                                false
                            );
                            const pipe = buildFilterPipeline(device, Q.shader, 'main', label);
                            const uniDef = pipe.defs.structs[UNI_STRUCT_TYPE_NAME]!;
                            const serializeParameters = (parameters: Params, buffer?: ArrayBuffer) => {
                                const unis = wgh.makeStructuredView(uniDef, buffer);
                                unis.set(parameters);
                                return unis.arrayBuffer;
                            };
                            const runner = makeRunner({
                                device,
                                indexed: false,
                                label,
                                pipe,
                                safeLookups: columnBindings,
                                serializeParameters,
                                shader: Q.shader,
                                wgSize: WG_SIZE,
                            });
                            return {
                                run: runner,
                                serializeParameters,
                                pipeline: pipe,
                                parameterTypeDef: uniDef,
                                // validate:partial(validate,false) // todo fix validate
                            };
                        },
                        buildIndexed: (device: GPUDevice, label: string) => {
                            const Q = assembleQuery(
                                {
                                    from: from as string,
                                    selections: this.selections,
                                    tables,
                                    uniformName: UNI_INSTANCE_NAME,
                                    uniformTypeName: 'Params',
                                },
                                predicateExpr,
                                paramDecls,
                                64,
                                true
                            );
                            const pipe = buildFilterPipeline(device, Q.shader, 'main', label);
                            const uniDef = pipe.defs.structs[UNI_STRUCT_TYPE_NAME]!;
                            const serializeParameters = (parameters: Params, buffer?: ArrayBuffer) => {
                                const unis = wgh.makeStructuredView(uniDef, buffer);
                                unis.set(parameters);
                                return unis.arrayBuffer;
                            };
                            const runner = makeRunner({
                                device,
                                indexed: true,
                                label,
                                pipe,
                                safeLookups: columnBindings,
                                serializeParameters,
                                shader: Q.shader,
                                wgSize: WG_SIZE,
                            });
                            return {
                                run: runner,
                                serializeParameters,
                                pipeline: pipe,
                                parameterTypeDef: uniDef,
                                // validate:partial(validate,true)
                            };
                        },
                    };
                }
            }
            function select(
                selection: '$index' | IndexExpr<string, string, WgslType> | ColumnExpr<string, string, WgslType>
            ) {
                const s = selection === '$index' ? 'tmp - 1' : compy(selection, 'tmp - 1', '');
                const type = determineType(selection);
                return new Selection([{ selection: s, type }]);
            }

            return { column, table, any, all, clause: any, select };
        },
    };
}
type Parameters = Record<string, string | number | number[]>;

// validation at runtime?
function validate<Ts extends Tables, Params extends Parameters, Indexed extends boolean>(
    indexed: Indexed,
    dev: GPUDevice,
    filter: {
        serializeParameters: (params: Params) => ArrayBuffer;
        run: (args: Indexed extends true ? RunIndexedFilterArgs<Ts> : RunFilterArgs<Ts>) => void;
    },
    tables: BTables<Ts, { buffer: ArrayBuffer }>,
    params: Params,
    expected: { buffer: ArrayBuffer },
    elements: Uint32Array | number
) {
    const R = GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC;
    const M = GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ;
    const enc = dev.createCommandEncoder();
    const pBytes = filter.serializeParameters(params);
    const paramB = dev.createBuffer({
        size: pBytes.byteLength,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        label: 'validate params',
    });
    dev.queue.writeBuffer(paramB, 0, pBytes);
    const inputs: GPUBuffer[] = [];
    Object.entries;
    const tableBuffers = mapValues(tables, (table) =>
        mapValues(table, (column: { buffer: ArrayBuffer }) => {
            const buf = dev.createBuffer({ size: column.buffer.byteLength, usage: R });
            dev.queue.writeBuffer(buf, 0, column.buffer);
            inputs.push(buf);
            return buf;
        })
    );
    const rowCount: number = indexed ? (elements as Uint32Array).length : (elements as number);
    let elemBuffer: GPUBuffer | undefined;
    if (indexed && elements instanceof Uint32Array) {
        elemBuffer = dev.createBuffer({ size: elements.buffer.byteLength, usage: R });
        dev.queue.writeBuffer(elemBuffer, 0, elements.buffer);
    }
    const resultsCounter = dev.createBuffer({ size: 16, usage: R });
    const resolveCount = dev.createBuffer({ size: 16, usage: M });
    const results = dev.createBuffer({ size: rowCount * 32, usage: R });
    const resolve = dev.createBuffer({ size: rowCount * 32, usage: M });
    // @ts-expect-error
    filter.run({
        enc,
        parameters: paramB,
        sets: [
            {
                elements: elemBuffer,
                resultCounter: resultsCounter,
                results,
                rowCount,
                tables: tableBuffers,
            },
        ],
    });
    enc.copyBufferToBuffer(results, resolve);
    enc.copyBufferToBuffer(resultsCounter, resolveCount);
    dev.queue.submit([enc.finish()]);
    // ok now get the results and compare them!
    Promise.all([resolve.mapAsync(GPUMapMode.READ), resolveCount.mapAsync(GPUMapMode.READ)])
        .then(() => {
            const count = new Uint32Array(resolveCount.getMappedRange());
            const recvd = resolve.getMappedRange();
            // TODO: we dont know how large each result is... so just compare byte-by-byte for the length of the expected result?
            // if(count[0]!==expected)
            const dv = new DataView(recvd);
            const ex = new DataView(expected.buffer);
            let failBytes = 0;
            for (let i = 0; i < expected.buffer.byteLength; i++) {
                if (dv.getUint8(i) !== ex.getUint8(i)) {
                    console.error('filter validation failed at byte: ', i);
                    failBytes += 1;
                }
            }
            if (failBytes === 0) {
                console.log('validation success');
            }
        })
        .finally(() => {
            // destroy all things
            [resolve, resolveCount, paramB, resultsCounter, results, ...inputs].forEach((b) => b.destroy());
            if (elemBuffer) {
                elemBuffer.destroy();
            }
        });
}
