import type { SharedPriorityCache } from '@alleninstitute/vis-core';
import type { ColumnRequest, ScatterbrainDataset, SlideviewScatterbrainDataset } from '../../types';
import { Box2D, type vec4 } from '@alleninstitute/vis-geometry';
import keys from 'lodash/keys';
import reduce from 'lodash/reduce';
import type REGL from 'regl';
import { getVisibleItems, type NodeWithBounds } from '../../dataset';
import { buildScatterbrainRenderCommand, type Config, configureShader, type ShaderSettings, VBO } from './shader';
import { buildScatterbrainCacheClient } from '../../cache-client';
import { MakeTaggedBufferView } from '../../typed-array';
function columnsForItem<T extends object>(
    config: Config,
    col2shader: Record<string, string>,
    dataset: ScatterbrainDataset | SlideviewScatterbrainDataset,
) {
    const columns: Record<string, ColumnRequest> = {};
    const s2c = reduce(
        keys(col2shader),
        (acc, col) => ({ ...acc, [col2shader[col]]: col }),
        {} as Record<string, string>,
    );

    for (const c of config.categoricalColumns) {
        columns[c] = { type: 'METADATA', name: s2c[c] };
    }
    for (const m of config.quantitativeColumns) {
        columns[m] = { type: 'QUANTITATIVE', name: s2c[m] };
    }
    columns[config.positionColumn] = { type: 'METADATA', name: dataset.metadata.spatialColumn };
    return (item: T) => {
        return { ...item, dataset, columns };
    };
}

/**
 * a helper function that MUTATES ALL the values in the given @param texture
 * to set them to the color and filter status as given in the categories record
 * note that the texture's maping to categories is based on a lexical sorting of the names of the
 * categories
 * @param categories
 * @param regl
 * @param texture
 */
export function setCategoricalLookupTableValues(
    categories: Record<string, Record<number, { color: vec4; filteredIn: boolean }>>,
    texture: REGL.Texture2D,
) {
    const categoryKeys = keys(categories).toSorted();
    const columns = categoryKeys.length;
    const rows = reduce(categoryKeys, (highest, category) => Math.max(highest, keys(categories[category]).length), 1);
    const data = new Uint8Array(columns * rows * 4);
    const rgbf = [0, 0, 0, 0];
    const empty = [0, 0, 0, 0] as const;
    // write the rgb of the color, and encode the filter boolean into the alpha channel
    for (let columnIndex = 0; columnIndex < columns; columnIndex += 1) {
        const category = categories[categoryKeys[columnIndex]];
        const nRows = keys(category).length;
        for (let rowIndex = 0; rowIndex < nRows; rowIndex += 1) {
            const color = category[rowIndex]?.color ?? empty;
            const filtered = category[rowIndex]?.filteredIn ?? false;
            rgbf[0] = color[0] * 255;
            rgbf[1] = color[1] * 255;
            rgbf[2] = color[2] * 255;
            rgbf[3] = filtered ? 255 : 0;
            data.set(rgbf, rowIndex * columns * 4 + columnIndex * 4);
        }
    }
    // calling a texture as a function is REGL shorthand for total re-init of this texture, capable of resizing if needed
    // warning - this is not likely to be fast
    texture({ data, width: columns, height: rows });
}
/**
 * same as setCategoricalLookupTableValues, except it only writes a single value update to the texture.
 * note that the list of categories given must match those used to construct the texture, and are needed here
 * due to the lexical sorting order determining the column order of the @param texture
 * @param categories
 * @param update
 * @param regl
 * @param texture
 */
export function updateCategoricalValue(
    categories: readonly string[],
    update: { category: string; row: number; color: vec4; filteredIn: boolean },
    texture: REGL.Texture2D,
) {
    const { category, row, color, filteredIn } = update;
    const col = categories.toSorted().indexOf(category);
    if (texture.width <= col || texture.height <= row || row < 0 || col < 0) {
        // todo - it might be better to let regl throw the same error... think about it
        throw new Error(
            `attempted to update metadata lookup table with invalid coordinates: row=${row},col=${col} is not within ${texture.width}, ${texture.height}`,
        );
    }
    const data = new Uint8Array(4);
    data[0] = color[0] * 255;
    data[1] = color[1] * 255;
    data[2] = color[2] * 255;
    data[3] = filteredIn ? 255 : 0;
    texture.subimage(data, col, row);
}

type ScatterbrainRenderProps = Omit<Parameters<ReturnType<typeof buildScatterbrainRenderCommand>>[0], 'item'> & {
    visibilityThresholdPx: number;
    dataset: ScatterbrainDataset | SlideviewScatterbrainDataset;
    client: ReturnType<typeof buildScatterbrainCacheClient<VBO>>;
};
/**
 *
 * @param regl a regl context
 * @param settings settings describing the data and how it should be rendered
 * @returns a pair of functions:
 *  render: when called with renderable data, will determine the set of visible data, request that data from the client, and then draw all currently available data
 * connectToCache - called to produce a cacheClient, which must be passed to the render function
 */
export function buildRenderFrameFn(regl: REGL.Regl, settings: ShaderSettings) {
    const { dataset } = settings;
    const { config, columnNameToShaderName } = configureShader(settings);

    const prepareQtCell = columnsForItem<NodeWithBounds>(config, columnNameToShaderName, dataset);
    const drawQtCell = buildScatterbrainRenderCommand(config, regl);

    const render = (props: ScatterbrainRenderProps) => {
        const { camera, dataset, client, visibilityThresholdPx } = props;
        // compute the size of a screen pixel in data-space units
        const visibilityThreshold = (visibilityThresholdPx * Box2D.size(camera.view)[0]) / camera.screenResolution[0]; // (units*pixel)/pixel ==> units
        const visibleQtNodes = getVisibleItems(dataset, camera, visibilityThreshold).map(prepareQtCell);
        client.setPriorities(visibleQtNodes, []);
        for (const node of visibleQtNodes) {
            if (client.has(node)) {
                const drawable = client.get(node);
                if (drawable) {
                    drawQtCell({
                        ...props,
                        item: {
                            columnData: drawable,
                            count: node.node.numSpecimens,
                        },
                    });
                }
            }
        }
    };
    const connectToCache = (cache: SharedPriorityCache, onDataArrived: () => void) => {
        const allColumns = [...config.categoricalColumns, ...config.quantitativeColumns, config.positionColumn];
        const client = buildScatterbrainCacheClient<VBO>(
            allColumns,
            cache,
            (buff, type) => {
                const typed = MakeTaggedBufferView(type, buff);
                return new VBO({
                    buffer: regl.buffer({ type: type, data: typed.data }),
                    bytes: buff.byteLength,
                    type: 'buffer',
                });
            },
            onDataArrived,
        );
        return client;
    };
    return { render, connectToCache };
}
