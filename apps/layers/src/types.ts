import type { box2D, vec2 } from "@alleninstitute/vis-geometry";
import type { NormalStatus } from "@alleninstitute/vis-scatterbrain";
import type REGL from "regl";
import type { ReglLayer2D } from "./layer";
import { renderSlide, type RenderSettings as SlideRenderSettings } from "./data-renderers/dynamicGridSlideRenderer";
import { renderSlice, type RenderSettings as SliceRenderSettings } from "./data-renderers/volumeSliceRenderer";
import { renderAnnotationLayer, type RenderSettings as AnnotationRenderSettings, type SimpleAnnotation } from "./data-renderers/simpleAnnotationRenderer";
import type { ColumnData, ColumnRequest } from "Common/loaders/scatterplot/scatterbrain-loader";
import type { AxisAlignedPlane } from "../../omezarr-viewer/src/slice-renderer";
import type { AxisAlignedZarrSlice } from "./data-sources/ome-zarr/planar-slice";
import type { DynamicGridSlide } from "./data-sources/scatterplot/dynamic-grid";
import type { AxisAlignedZarrSliceGrid } from "./data-sources/ome-zarr/slice-grid";
import type { AnnotationGrid, RenderSettings as AnnotationGridRenderSettings, CacheContentType as GpuMesh } from "./data-renderers/annotation-renderer";
// note: right now, all layers should be considered 2D, and WebGL only...
export type Image = {
    texture: REGL.Framebuffer2D
    bounds: box2D | undefined; // if undefined, it means we allocated the texture, but its empty and should not be used (except to fill it)
}
export type CacheEntry = {
    type: 'texture2D';
    data: REGL.Texture2D
} | ColumnData
    | GpuMesh




export type ScatterPlotLayer = {
    type: 'scatterplot'
    data: DynamicGridSlide,
    render: ReglLayer2D<DynamicGridSlide, SlideRenderSettings<CacheEntry>>
};

export type VolumetricSliceLayer = {
    type: 'volumeSlice'
    data: AxisAlignedZarrSlice,
    render: ReglLayer2D<AxisAlignedZarrSlice, SliceRenderSettings<CacheEntry>>
};
export type AnnotationLayer = {
    type: 'annotationLayer',
    data: SimpleAnnotation,
    render: ReglLayer2D<SimpleAnnotation, AnnotationRenderSettings>
}
export type VolumetricGridLayer = {
    type: 'volumeGrid';
    data: AxisAlignedZarrSliceGrid;
    render: ReglLayer2D<AxisAlignedZarrSliceGrid, SliceRenderSettings<CacheEntry>>
}
export type SlideViewAnnotations = {
    type: 'annotationGrid',
    data: AnnotationGrid,
    render: ReglLayer2D<AnnotationGrid, AnnotationGridRenderSettings<CacheEntry>>
}
export type Layer = ScatterPlotLayer | VolumetricSliceLayer | AnnotationLayer | VolumetricGridLayer | SlideViewAnnotations