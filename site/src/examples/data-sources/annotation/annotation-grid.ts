import type { vec4 } from '@alleninstitute/vis-geometry';
import type { SlideViewDataset } from '../../common/loaders/scatterplot/scatterbrain-loader';

export type AnnotationGridConfig = {
    type: 'AnnotationGridConfig';
    url: string;
    annotationUrl: string;
    levelFeature: string;
    stroke: {
        overrideColor?: vec4;
        opacity: number;
    };
    fill: {
        overrideColor?: vec4;
        opacity: number;
    };
};
export type AnnotationGrid = {
    type: 'AnnotationGrid';
    dataset: SlideViewDataset;
    annotationBaseUrl: string;
    levelFeature: string;
    stroke: {
        overrideColor?: vec4;
        opacity: number;
        width: number;
    };
    fill: {
        overrideColor?: vec4;
        opacity: number;
    };
};
