import type { ColumnRequest } from '~/common/loaders/scatterplot/scatterbrain-loader';
import type { AnnotationGridConfig } from '~/data-sources/annotation/annotation-grid';
import type { ZarrSliceConfig } from '~/data-sources/ome-zarr/planar-slice';
import type { ZarrSliceGridConfig } from '~/data-sources/ome-zarr/slice-grid';
import type { ScatterplotGridConfig, ScatterPlotGridSlideConfig } from '~/data-sources/scatterplot/dynamic-grid';

const slide32 = 'MQ1B9QBZFIPXQO6PETJ';
const colorByGene: ColumnRequest = { name: '88', type: 'QUANTITATIVE' };
const scottpoc = 'https://tissuecyte-ome-zarr-poc.s3.amazonaws.com/40_128_128/1145081396';

export const examples = {
    reconstructed: {
        colorBy: colorByGene,
        type: 'ScatterPlotGridConfig',
        url: 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_ccf_04112024-20240419205547/4STCSZBXHYOI0JUUA3M/ScatterBrain.json',
    } as ScatterplotGridConfig,
    oneSlide: {
        colorBy: colorByGene,
        slideId: slide32,
        type: 'ScatterPlotGridSlideConfig',
        url: 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_ccf_04112024-20240419205547/4STCSZBXHYOI0JUUA3M/ScatterBrain.json',
    } as ScatterPlotGridSlideConfig,
    tissueCyte396: {
        type: 'ZarrSliceGridConfig',
        gamut: {
            R: { index: 0, gamut: { max: 600, min: 0 } },
            G: { index: 1, gamut: { max: 500, min: 0 } },
            B: { index: 2, gamut: { max: 400, min: 0 } },
        },
        plane: 'xy',
        slices: 142,
        url: scottpoc,
    } as ZarrSliceGridConfig,
    tissueCyteSlice: {
        type: 'zarrSliceConfig',
        gamut: {
            R: { index: 0, gamut: { max: 600, min: 0 } },
            G: { index: 1, gamut: { max: 500, min: 0 } },
            B: { index: 2, gamut: { max: 400, min: 0 } },
        },
        plane: 'xy',
        planeParameter: 0.5,
        url: scottpoc,
    } as ZarrSliceConfig,
    versa1: {
        url: 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/',
        type: 'ZarrSliceGridConfig',
        gamut: {
            R: { index: 0, gamut: { max: 20, min: 0 } },
            G: { index: 1, gamut: { max: 20, min: 0 } },
            B: { index: 2, gamut: { max: 20, min: 0 } },
        },
        plane: 'xy',
        slices: 4,
    } as ZarrSliceGridConfig,
    structureAnnotation: {
        type: 'AnnotationGridConfig',
        url: 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_ccf_04112024-20240419205547/4STCSZBXHYOI0JUUA3M/ScatterBrain.json',
        levelFeature: '73GVTDXDEGE27M2XJMT',
        annotationUrl:
            'https://stage-sfs.brain.devlims.org/api/v1/Annotation/4STCSZBXHYOI0JUUA3M/v3/TLOKWCL95RU03D9PETG/',
        stroke: {
            opacity: 1,
            overrideColor: [1, 0, 0, 1] as const,
        },
        fill: {
            opacity: 0.7,
        },
    } as AnnotationGridConfig,
};
