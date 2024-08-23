import { loadDataset, loadScatterbrainJson, type ColumnRequest, type ScatterplotDataset } from "~/common/loaders/scatterplot/scatterbrain-loader";
import type { OptionalTransform, Simple2DTransform } from "../types";

export type UmapConfig = {
    type: 'UmapConfig';
    colorBy: ColumnRequest;
    filterValue: number;
    url: string;
    trn?: Simple2DTransform | undefined;
};
export type UmapScatterplot = {
    type: 'UmapScatterplot';
    dataset: ScatterplotDataset;
    colorBy: ColumnRequest;
    filter: number;
    pointSize: number;
} & OptionalTransform;

// create the real deal from the config
export function assembleUmap(config: UmapConfig, dataset: ScatterplotDataset):UmapScatterplot {
    const { colorBy, trn,filterValue } = config;
    return {
        type: 'UmapScatterplot',
        colorBy,
        filter:filterValue,
        dataset,
        pointSize: 14,
        toModelSpace: trn,
    };
}
export function createUmapDataset(config:UmapConfig){
    const { url } = config;
    return loadScatterbrainJson(url).then((metadata) => {
            const dataset = loadDataset(metadata, url);
            return assembleUmap(config, dataset);
        })
    }