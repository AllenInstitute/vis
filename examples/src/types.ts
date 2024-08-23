import type { box2D } from '@alleninstitute/vis-geometry';
import type REGL from 'regl';
import { type RenderSettings as SlideRenderSettings } from './data-renderers/dynamicGridSlideRenderer';
import { type RenderSettings as SliceRenderSettings } from './data-renderers/volumeSliceRenderer';
import {
    type RenderSettings as AnnotationRenderSettings,
    type SimpleAnnotation,
} from './data-renderers/simpleAnnotationRenderer';
import type { AxisAlignedZarrSlice } from './data-sources/ome-zarr/planar-slice';
import type { DynamicGrid, DynamicGridSlide } from './data-sources/scatterplot/dynamic-grid';
import type { AxisAlignedZarrSliceGrid } from './data-sources/ome-zarr/slice-grid';
import type {
    RenderSettings as AnnotationGridRenderSettings,
    CacheContentType as GpuMesh,
} from './data-renderers/annotation-renderer';
import type { AnnotationGrid } from './data-sources/annotation/annotation-grid';
import type { ReglLayer2D } from '@alleninstitute/vis-scatterbrain';
import type { ScatterplotDataset } from './common/loaders/scatterplot/scatterbrain-loader';
import type { UmapScatterplot } from './data-sources/scatterplot/umap';
// note: right now, all layers should be considered 2D, and WebGL only...
export type Image = {
    texture: REGL.Framebuffer2D;
    bounds: box2D | undefined; // if undefined, it means we allocated the texture, but its empty and should not be used (except to fill it)
};
type ColumnBuffer = {
    type: 'vbo';
    data: REGL.Buffer;
};
export type CacheEntry =
    | {
          type: 'texture2D';
          data: REGL.Texture2D;
      }
    | ColumnBuffer
    | GpuMesh;

export type ScatterPlotLayer = {
    type: 'scatterplot';
    data: DynamicGridSlide;
    render: ReglLayer2D<DynamicGridSlide, SlideRenderSettings<CacheEntry>>;
};
export type ScatterPlotGridLayer = {
    type: 'scatterplotGrid';
    data: DynamicGrid;
    render: ReglLayer2D<DynamicGrid, SlideRenderSettings<CacheEntry>>;
};

export type VolumetricSliceLayer = {
    type: 'volumeSlice';
    data: AxisAlignedZarrSlice;
    render: ReglLayer2D<AxisAlignedZarrSlice, SliceRenderSettings<CacheEntry>>;
};
export type AnnotationLayer = {
    type: 'annotationLayer';
    data: SimpleAnnotation;
    render: ReglLayer2D<SimpleAnnotation, AnnotationRenderSettings>;
};
export type VolumetricGridLayer = {
    type: 'volumeGrid';
    data: AxisAlignedZarrSliceGrid;
    render: ReglLayer2D<AxisAlignedZarrSliceGrid, SliceRenderSettings<CacheEntry>>;
};
export type SlideViewAnnotations = {
    type: 'annotationGrid';
    data: AnnotationGrid;
    render: ReglLayer2D<AnnotationGrid, AnnotationGridRenderSettings<CacheEntry>>;
};
export type UmapLayer = {
    type:'umap',
    data: UmapScatterplot,
    render: ReglLayer2D<UmapScatterplot,SlideRenderSettings<CacheEntry>>
}
export type Layer =
    | ScatterPlotLayer
    | ScatterPlotGridLayer
    | VolumetricSliceLayer
    | VolumetricGridLayer
    | SlideViewAnnotations
    | AnnotationLayer
    | UmapLayer
