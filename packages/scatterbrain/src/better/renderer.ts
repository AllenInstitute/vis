import type { Cacheable, CachedVertexBuffer, SharedPriorityCache } from '@alleninstitute/vis-core';
import type REGL from 'regl';
import type { ColumnRequest, ScatterbrainDataset, SlideviewScatterbrainDataset, TreeNode } from './types';
import type { box2D, Interval, vec2 } from '@alleninstitute/vis-geometry';
import { MakeTaggedBufferView } from '../typed-array';
import { isEqual, keys, map, omit, reduce } from 'lodash'
import { getVisibleItems, type NodeWithBounds } from './dataset';
import { buildScatterbrainRenderCommand, buildShaders, type Config, configureShader, type ShaderSettings, VBO } from './shader';
export type Item = Readonly<{
    dataset: SlideviewScatterbrainDataset | ScatterbrainDataset
    node: TreeNode
    bounds: box2D
    columns: Record<string, ColumnRequest>
}>
type Content = Record<string, VBO>


export function buildScatterbrainCacheClient(regl: REGL.Regl, cache: SharedPriorityCache, onDataArrived: () => void) {
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
            // TODO
            // figure out the set of columns that would be required given our settings
            // check if all those keys are in v, and each one is defined and instanceof VBO
            return true;
        },
        onDataArrived
    })
    return client;
}

// export function stuff(client: ReturnType<typeof buildScatterbrainCacheClient>, dataset: SlideviewScatterbrainDataset | ScatterbrainDataset, camera: { view: box2D, screenResolution: vec2 }) {
//     const visible = getVisibleItems(dataset, camera)
//     const items: Item[] = map(visible, (node) => ({ ...node, dataset, columns: { 'position': { type: 'METADATA', name: dataset.metadata.spatialColumn } } }))
//     client.setPriorities(items, []);

// }
type State = ShaderSettings & {
    camera: { view: box2D, screenResolution: vec2 }
}

// function buildRenderCommand(state: State, regl: REGL.Regl) {
//     const { dataset } = state;
//     const { config, columnNameToShaderName } = configureShader(state);
//     const renderer = buildScatterbrainRenderCommand(config, regl)

//     // lets use a fake set of textures for now 


// }
function columnsForItem<T extends object>(config: Config, col2shader: Record<string, string>, dataset: ScatterbrainDataset | SlideviewScatterbrainDataset) {
    const columns: Record<string, ColumnRequest> = {}
    const s2c = reduce(keys(col2shader), (acc, col) => ({ ...acc, [col2shader[col]]: col }), {} as Record<string, string>)

    for (const c of config.categoricalColumns) {
        columns[c] = { type: 'METADATA', name: s2c[c] }
    }
    for (const m of config.quantitativeColumns) {
        columns[m] = { type: 'QUANTITATIVE', name: s2c[m] }
    }
    columns[config.positionColumn] = { type: 'METADATA', name: dataset.metadata.spatialColumn }
    return (item: T,) => {
        return { ...item, dataset, columns }
    }
}
export function buildScatterbrainRenderer(regl: REGL.Regl, cache: SharedPriorityCache, canvas: HTMLCanvasElement) {
    let draw: ReturnType<typeof buildScatterbrainRenderCommand> | undefined;
    const client = buildScatterbrainCacheClient(regl, cache, () => {
        // mega hack for now - if new data shows up, try to just directly invoke the renderer with a stashed copy of the settings...
        if (prevSettings) {
            render(prevSettings)
        }
    });

    const lookup = regl.texture({ width: 10, height: 10, format: 'rgba' })
    const gradientData = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i += 4) {
        gradientData[i * 4 + 0] = i;
        gradientData[i * 4 + 1] = i;
        gradientData[i * 4 + 2] = i;
        gradientData[i * 4 + 3] = 255;
    }
    const gradient = regl.texture({ width: 256, height: 1, format: 'rgba', data: gradientData })
    let prevSettings: State | undefined;
    let augment: ((node: NodeWithBounds) => Item) | undefined
    const render = (state: State) => {
        const { camera, dataset } = state;
        if (!draw || !isEqual(prevSettings, omit(state, 'camera'))) {
            const { config, columnNameToShaderName } = configureShader(state);
            augment = columnsForItem<NodeWithBounds>(config, columnNameToShaderName, dataset);
            draw = buildScatterbrainRenderCommand(config, regl);
        }
        if (draw !== undefined) {
            const visible = getVisibleItems(dataset, camera)
            // TODO: use the columnNameToShaderName (in reverse) to build
            // the set of columns to request (an Item is a request)
            // the key will be the shaderName, the value will be a columnRequest that will satisfy that shader attribute.
            const items: Item[] = map(visible, augment!)
            client.setPriorities(items, []);

            for (const item of items) {
                if (client.has(item)) {
                    const gpuData = client.get(item)
                    if (gpuData) {
                        // draw it now
                        draw({
                            target: null,
                            camera,
                            categoricalLookupTable: lookup,
                            gradient,
                            offset: [0, 0],
                            quantitativeRangeFilters: { COLOR_BY_MEASURE: [0, 10] }, // TODO fill me in - shader names are the keys here
                            item: {
                                columnData: gpuData,
                                count: item.node.numSpecimens,
                            },

                        })
                    }
                }

            }
        }
        prevSettings = state
    }

    return render
}