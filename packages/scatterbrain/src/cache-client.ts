import type { Resource, SharedPriorityCache } from '@alleninstitute/vis-core';
import type { ColumnRequest, Item, } from './types';
import reduce from 'lodash/reduce';
import type { WebGLSafeBasicType } from './typed-array';


type Content<V extends Resource> = Record<string, V>

export function buildScatterbrainCacheClient<V extends Resource>(
    allNeededColumns: readonly string[],
    cache: SharedPriorityCache,
    toCacheValue: (buffer: ArrayBuffer, type: WebGLSafeBasicType) => V,
    onDataArrived: () => void,
) {
    const client = cache.registerClient<Item, Content<V>>({
        cacheKeys: (item) => {
            const { dataset, node, columns } = item;
            return reduce<Record<string, ColumnRequest>, Record<string, string>>(
                columns,
                (acc, col, key) => ({
                    ...acc,
                    [key]: `${dataset.metadata.metadataFileEndpoint}/${node.file}/${col.name}`,
                }),
                {},
            );
        },
        fetch: (item) => {
            const { dataset, node, columns } = item;
            const attrs = dataset.metadata.pointAttributes;
            const getColumnUrl = (columnName: string) =>
                `${dataset.metadata.metadataFileEndpoint}${columnName}/${dataset.metadata.visualizationReferenceId}/${node.file}`;
            const getGeneUrl = (columnName: string) =>
                `${dataset.metadata.geneFileEndpoint}${columnName}/${dataset.metadata.visualizationReferenceId}/${node.file}`;
            const getColumnInfo = (col: ColumnRequest) =>
                col.type === 'QUANTITATIVE'
                    ? ({ url: getGeneUrl(col.name), elements: 1, type: 'float' } as const)
                    : { url: getColumnUrl(col.name), elements: attrs[col.name].elements, type: attrs[col.name].type };

            const proms = reduce<Record<string, ColumnRequest>, Record<string, (signal: AbortSignal) => Promise<V>>>(
                columns,
                (getters, col, key) => {
                    const { url, type } = getColumnInfo(col);
                    return {
                        ...getters,
                        [key]: (signal) =>
                            fetch(url, { signal }).then((b) =>
                                b.arrayBuffer().then((buff) => toCacheValue(buff, type))
                            ),
                    };
                },
                {},
            );
            return proms;
        },
        isValue: (v): v is Content<V> => {
            for (const column of allNeededColumns) {
                if (!(column in v)) {
                    return false;
                }
            }
            return true;
        },
        onDataArrived,
    });
    return client;
}