import { isSlideViewData, loadDataset, type ColumnRequest, type ColumnarMetadata, type SlideViewDataset } from "~/loaders/scatterplot/scatterbrain-loader";
import type { OptionalTransform, Simple2DTransform } from "../types";
type MaybePromise<T> = T | Promise<T>;
export type ScatterPlotGridSlideConfig = {
    type: 'ScatterPlotGridSlideConfig';
    slideId: string;
    colorBy: ColumnRequest;
    url: string;
    trn?: Simple2DTransform | undefined;
}

export type DynamicGridSlide = {
    type: 'DynamicGridSlide'
    dataset: SlideViewDataset;
    slideId: string;
    colorBy: ColumnRequest;
} & OptionalTransform;


async function loadJSON(url: string) {
    // obviously, we should check or something
    return fetch(url).then(stuff => stuff.json() as unknown as ColumnarMetadata)
}

// create the real deal from the config
function assembleSlideDatasetonfig(config: ScatterPlotGridSlideConfig, dataset: SlideViewDataset): DynamicGridSlide {
    const { colorBy, slideId, trn } = config
    return {
        type: 'DynamicGridSlide',
        colorBy,
        dataset,
        slideId,
        toModelSpace: trn,
    }
}
export function createSlideDataset(config: ScatterPlotGridSlideConfig,): Promise<DynamicGridSlide | undefined> {
    const { url } = config
    return loadJSON(url).then((metadata) => {
        if (isSlideViewData(metadata)) {
            const dataset = loadDataset(metadata, url) as SlideViewDataset;
            return assembleSlideDatasetonfig(config, dataset)
        }
        return undefined;
    });
}