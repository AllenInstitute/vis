import { entries } from 'lodash-es';
import {
    type WgslType,
    type Sel,
    type Tables,
    type AST,
    type OP,
    type VOP,
    type VectorType,
    type VLen,
    type ScalarType,
} from './types';

function generateOutputStructure(selections: ReadonlyArray<Sel>) {
    // the names of the values in the structure dont matter at all -
    const structName = `OutputStruct`;
    const fields = selections.map((s, i) => `field_${i.toFixed(0)}: ${s.type},`).join('\n');
    const structDecl = `struct ${structName} {\n ${fields} \n };`;
    const initializers = selections.map((s) => s.selection).join(', ');
    const construct = `${structName}(${initializers})`;

    return { structName, structDecl, construct };
}
function isVecOp(s: OP | VOP): s is VOP {
    return s.startsWith('a');
}
function scalarTypeOf(type: VectorType<VLen>): ScalarType {
    if (type.endsWith('u')) {
        return 'u32';
    } else if (type.endsWith('f')) {
        return 'f32';
    }
    return 'i32';
}
function parseVecOp(op: VOP) {
    const aggregation = op.substring(0, 3);
    const sop = op.substring(4).split(')')[0];
    return [aggregation, sop] as ['any' | 'all', OP];
}
export function setupExprBuilder(from: string, tables: Tables) {
    function columnAt(table: string, column: string, indexing: string, swizzle: string | undefined) {
        const type = tables[table][column];
        if (type.startsWith('vec3')) {
            // webGPU can handle vec3 as vertex data (tight 12byte pack) but not in a storage buffer, because why be nice to developers?
            // so we do this silly hack:
            const offsets: Record<string, string> = { x: '0', y: '1', z: '2' };
            if (swizzle) {
                if (swizzle in offsets) {
                    const offset = offsets[swizzle];
                    return `${table}_${column}[(${indexing})*3+${offset}]`;
                }
            }
            return `${type}(${table}_${column}[(${indexing})*3],${table}_${column}[(${indexing})*3+1],${table}_${column}[(${indexing})*3+2])`;
        }
        // otherwise, be normal about stuff
        return swizzle ? `${table}_${column}[${indexing}].${swizzle}` : `${table}_${column}[${indexing}]`;
    }

    function toWgsl(ast: AST, indexing: string, uniName: string): string {
        switch (ast.kind) {
            case 'from field': {
                const [column, swizzle] = ast.field.split('.');
                return columnAt(ast.from, column, indexing, swizzle);
            }
            case 'table at field':
                const subExpr =
                    typeof ast.atExpr === 'string'
                        ? `${toWgsl({ kind: 'from field', field: ast.atExpr, from: from as string, type: 'u32' }, indexing, uniName)}`
                        : `${toWgsl(ast.atExpr, indexing, uniName)}`;
                const [column, swizzle] = ast.field.split('.');
                return columnAt(ast.table, column, subExpr, swizzle);
            case 'predicate':
                const { lhs, op, rhs } = ast;
                if (isVecOp(op)) {
                    const [agg, sop] = parseVecOp(op);
                    return `${agg}(${toWgsl(lhs, indexing, uniName)} ${sop} ${uniName}.${rhs})`;
                }
                return `${toWgsl(lhs, indexing, uniName)} ${op} ${uniName}.${rhs}`;
        }
    }
    return toWgsl;
}
export function generateShader(params: {
    workgroupSize: number;
    inputBindings: string;
    predicateExpr: string;
    uniformStruct: { name: string; typeName: string; structDecl: string };
    indexed: boolean;
    selections: ReadonlyArray<Sel>;
}) {
    const { inputBindings, predicateExpr, uniformStruct, selections, workgroupSize, indexed } = params;
    const { structName, structDecl, construct } = generateOutputStructure(selections);
    const host = /*wgsl*/ `

    ${uniformStruct.structDecl}
    ${structDecl}
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
        let predicateResult = ${predicateExpr};
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
            // early return - if the start is past the last result:
            if(start >= arrayLength(&passing)){
              return;
            }
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

export function generateTableBindings(
    tableName: string,
    table: Record<string, WgslType>,
    group: number,
    bindingStart: number = 0
) {
    const cols = entries(table);
    let bindingLookup = cols.reduce(
        (acc, [f, _t], index) => ({ ...acc, [f]: index + bindingStart }),
        {} as Record<string, number>
    );
    const decls = cols
        .map(([f, t], index) =>
            t.startsWith('vec3')
                ? `@group(${group}) @binding(${index + bindingStart}) var<storage,read> ${tableName}_${f}: array<${scalarTypeOf(t as VectorType<3>)}>;`
                : `@group(${group}) @binding(${index + bindingStart}) var<storage,read> ${tableName}_${f}: array<${t}>;`
        )
        .join('\n');
    return { decls, numBindings: cols.length, bindingLookup };
}
export type FilterCtx<Ts extends Tables> = {
    from: string;
    tables: Ts;
    selections: ReadonlyArray<Sel>;
    uniformName: string;
    uniformTypeName: string;
};
export function assembleQuery<Ts extends Tables>(
    ctx: FilterCtx<Ts>,
    predExpr: string,
    paramsDecl: string,
    wgSize: number,
    indexed: boolean
) {
    let bindingStart = 3;
    let bindings: string = '';
    const bindingLookups: Record<string, Record<string, number>> = {};
    for (const t of Object.keys(ctx.tables)) {
        const binding = generateTableBindings(t, ctx.tables[t]!, 1, bindingStart);
        bindings += `\n //${t}\n${binding.decls}\n`;
        bindingStart += binding.numBindings;
        bindingLookups[t] = binding.bindingLookup;
    }
    const uniStructDecl = `struct ${ctx.uniformTypeName} {
      ${paramsDecl}
    };`;
    return {
        shader: generateShader({
            workgroupSize: wgSize,
            inputBindings: bindings,
            predicateExpr: predExpr,
            indexed,
            selections: ctx.selections.map((s) => ({ selection: s.selection, type: s.type })),
            uniformStruct: { name: ctx.uniformName, typeName: ctx.uniformTypeName, structDecl: uniStructDecl },
        }),
        bindingLookups,
    };
}
