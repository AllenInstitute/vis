import { loadDataset, loadScatterbrainJson, type ColumnRequest, type ScatterplotDataset } from "~/common/loaders/scatterplot/scatterbrain-loader";
import type { OptionalTransform, Simple2DTransform } from "../types";

export type UmapConfig = {
    type: 'UmapConfig';
    url: string;
    trn?: Simple2DTransform | undefined;
};
export type UmapScatterplot = {
    type: 'UmapScatterplot';
    dataset: ScatterplotDataset;
} & OptionalTransform;

// create the real deal from the config
export function assembleUmap(config: UmapConfig, dataset: ScatterplotDataset):UmapScatterplot {
    const { trn } = config;
    return {
        type: 'UmapScatterplot',
        dataset,
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