import {
    isSlideViewData,
    loadDataset,
    loadScatterbrainJson,
    type ColumnRequest,
    type ColumnarMetadata,
    type SlideViewDataset,
} from 'Common/loaders/scatterplot/scatterbrain-loader';
import type { OptionalTransform, Simple2DTransform } from '../types';

export type ScatterplotGridConfig = {
    type: 'ScatterPlotGridConfig';
    colorBy: ColumnRequest;
    url: string;
    trn?: Simple2DTransform | undefined;
};
export type ScatterPlotGridSlideConfig = {
    type: 'ScatterPlotGridSlideConfig';
    slideId: string;
    colorBy: ColumnRequest;
    url: string;
    trn?: Simple2DTransform | undefined;
};

export type DynamicGridSlide = {
    type: 'DynamicGridSlide';
    dataset: SlideViewDataset;
    slideId: string;
    colorBy: ColumnRequest;
    pointSize: number;
} & OptionalTransform;

export type DynamicGrid = {
    type: 'DynamicGrid';
    dataset: SlideViewDataset;
    colorBy: ColumnRequest;
    pointSize: number;
} & OptionalTransform;

// create the real deal from the config
function assembleSlideConfig(config: ScatterPlotGridSlideConfig, dataset: SlideViewDataset): DynamicGridSlide {
    const { colorBy, slideId, trn } = config;
    return {
        type: 'DynamicGridSlide',
        colorBy,
        dataset,
        slideId,
        pointSize: 4,
        toModelSpace: trn,
    };
}
export function createSlideDataset(config: ScatterPlotGridSlideConfig): Promise<DynamicGridSlide | undefined> {
    const { url } = config;
    return loadScatterbrainJson(url).then((metadata) => {
        if (isSlideViewData(metadata)) {
            const dataset = loadDataset(metadata, url) as SlideViewDataset;
            return assembleSlideConfig(config, dataset);
        }
        return undefined;
    });
}

function assembleGridConfig(config: ScatterplotGridConfig, dataset: SlideViewDataset): DynamicGrid {
    const { colorBy, trn } = config;
    return {
        type: 'DynamicGrid',
        colorBy,
        dataset,
        pointSize: 4,
        toModelSpace: trn,
    };
}
export function createGridDataset(config: ScatterplotGridConfig): Promise<DynamicGrid | undefined> {
    const { url } = config;
    return loadScatterbrainJson(url).then((metadata) => {
        if (isSlideViewData(metadata)) {
            const dataset = loadDataset(metadata, url) as SlideViewDataset;
            return assembleGridConfig(config, dataset);
        }
        return undefined;
    });
}
