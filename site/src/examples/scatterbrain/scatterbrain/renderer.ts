import type { Cacheable, CachedVertexBuffer, SharedPriorityCache } from '@alleninstitute/vis-core';
import type REGL from 'regl';
import type { ColumnRequest, ScatterbrainDataset, SlideviewScatterbrainDataset, TreeNode } from './types';
import type { box2D } from '@alleninstitute/vis-geometry';
import { MakeTaggedBufferView } from 'src/examples/common/typed-array';
import { reduce } from 'lodash';
import { assign, defMain, output, program, uniform, input, vec4, defn, V4, V2, sym, mul, float, ret, type Vec2Sym, type FloatSym } from "@thi.ng/shader-ast";
import { GLSLVersion, targetGLSL } from "@thi.ng/shader-ast-glsl";
// import * as glsl from '@thi.ng/shader-ast-glsl'
// import type { ColumnRequest } from 'src/examples/common/loaders/scatterplot/scatterbrain-loader';
import { defShader } from "@thi.ng/webgl";
type Item = Readonly<{
    dataset: SlideviewScatterbrainDataset | ScatterbrainDataset
    node: TreeNode
    bounds: box2D
    columns: Record<string, ColumnRequest>
}>
type Content = {}

class VBO implements Cacheable {
    buffer: CachedVertexBuffer;
    constructor(buffer: CachedVertexBuffer) {
        this.buffer = buffer;
    }
    destroy() {
        this.buffer.buffer.destroy()
    }
    sizeInBytes() {
        return this.buffer.bytes;
    }
}

export function buildScatterbrainCacheClient(regl: REGL.Regl, cache: SharedPriorityCache) {
    const client = cache.registerClient<Item, Content>({
        cacheKeys: (item) => {
            const { dataset, node, columns } = item;
            return reduce<Record<string, ColumnRequest>, Record<string, string>>(columns, (acc, col, key) => ({ ...acc, [key]: `${dataset.metadata.metadataFileEndpoint}/${node.file}/${col.name}` }), {})
        },
        fetch: (item) => {
            const { dataset, node, columns } = item;
            const attrs = dataset.metadata.pointAttributes;
            const getColumnUrl = (columnName: string) => `${dataset.metadata.metadataFileEndpoint}${columnName}/${dataset.metadata.visualizationReferenceId}/${node.file}`;
            const getGeneUrl = (columnName: string) => `${dataset.metadata.geneFileEndpoint}${columnName}/${dataset.metadata.visualizationReferenceId}/${node.file}`;
            const getColumnInfo = (col: ColumnRequest) =>
                col.type === 'QUANTITATIVE' ?
                    { url: getGeneUrl(col.name), elements: 1, type: 'float' } as const
                    :
                    { url: getColumnUrl(col.name), elements: attrs[col.name].elements, type: attrs[col.name].type }

            const proms = reduce<Record<string, ColumnRequest>, Record<string, (signal: AbortSignal) => Promise<VBO>>>(columns, (getters, col, key) => {
                const { url, type } = getColumnInfo(col)
                return {
                    ...getters,
                    [key]: (signal) => fetch(url, { signal }).then(b => b.arrayBuffer().then(buff => {
                        const typed = MakeTaggedBufferView(type, buff)
                        return new VBO({ buffer: regl.buffer({ type: type, data: typed.data }), bytes: buff.byteLength, type: 'buffer' })
                    }))
                }
            }, {})
            return proms;
        },
        isValue: (v): v is Content => {
            // TODO!!
            // a problem here - unless we do some pre-cooking of shaders... the set of attrs we pass to the shader
            // is only known at runtime, because the user picks a configuration and we generate a shader based on that config
            // this is how its done in ABC atlas now, but to be fair - its not that helpful. No one but me reads the shaders,
            // the names of attrs are just featureTypeReferenceIds (gibberish) so its not super helpful to generate them in this way.
            // I'm considering pre-generating shaders with fixed #'s of vertex attr inputs... however the # of shaders is pretty combinatoric...
            // even with just 4 attrs (pos, A,B,C) how A B and C are used is also determined at runtime
            // for example, B and C could be genes, and thus need to be filtered with a range, where A could be metadata
            // or A could be the gene, B and C could be metadata, and C could be the color-by
            // there are so many permutations...
            // so thinking that through - we're stuck generating shaders - unless we want to push a TON of speculative 
            // execution down into the vertex shader, there's no way around it...
            return true;
        },
    })
    return client;
}

/*
perhaps the issue is not that we generate the shaders, but the very verbose string-building way in which we generate the shaders
there are alternatives, use.gpu style, or even how thi.ng/umbrella does it with a custom DSL...
*/

function whatever(ctx: WebGLRenderingContext) {
    const glsl = targetGLSL({ version: GLSLVersion.GLES_100 })
    const x = program([defn(V4, 'neat', [V2, V2], (what, who) => {
        let uv: FloatSym
        return [
            (uv = sym(mul(float(2), float(3)))),
            ret(vec4(uv, uv, uv, float(10)))
        ]
    })])
    // I feel confident that the above is actually less comprehensible than some GLSL template literals...


    const wtf = glsl(x) // ok this is the way to actually compile it to a string...
    const hey = defShader(ctx, {
        vs: (gl, unis, attribs) => [
            defMain(() =>
                [assign(gl.gl_Position, vec4(1, 2, 3, 0))]
            )
        ],
        fs: (gl, unis, wat, outs) => [
            defMain(() =>
                [assign(
                    outs.fragColor,
                    vec4(1, 2, 3, 1)
                ),]
            )
        ],
        attribs: {

        },
        uniforms: {

        }
    })
    hey.program
}