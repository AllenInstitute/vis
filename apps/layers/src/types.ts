import type { box2D } from "@alleninstitute/vis-geometry";
import type { NormalStatus } from "@alleninstitute/vis-scatterbrain";
import type REGL from "regl";
import type { DynamicGridSlide, OptionalTransform, AxisAlignedZarrSlice } from "./data-renderers/types";
import type { ReglLayer2D } from "./layer";
import { renderSlide, type RenderSettings as SlideRenderSettings } from "./data-renderers/dynamicGridSlideRenderer";
import { renderSlice, type RenderSettings as SliceRenderSettings } from "./data-renderers/volumeSliceRenderer";
import { renderAnnotationLayer, type RenderSettings as AnnotationRenderSettings, type SimpleAnnotation } from "./data-renderers/annotationRenderer";
import type { ColumnData } from "~/loaders/scatterplot/scatterbrain-loader";
// note: right now, all layers should be considered 2D, and WebGL only...
export type Image = {
    texture: REGL.Framebuffer2D
    bounds: box2D|undefined; // if undefined, it means we allocated the texture, but its empty and should not be used (except to fill it)
}
export type CacheEntry = {
    type: 'texture2D';
    data: REGL.Texture2D
} | ColumnData;



export type ScatterPlotLayer = {
    type: 'scatterplot'
    data: DynamicGridSlide & OptionalTransform,
    render: ReglLayer2D<DynamicGridSlide & OptionalTransform, SlideRenderSettings<CacheEntry>>
};

export type VolumetricSliceLayer = {
    type: 'volumeSlice'
    data: AxisAlignedZarrSlice & OptionalTransform,
    render: ReglLayer2D<AxisAlignedZarrSlice & OptionalTransform, SliceRenderSettings<CacheEntry>>
};
export type AnnotationLayer = {
    type: 'annotationLayer',
    data: SimpleAnnotation,
    render: ReglLayer2D<SimpleAnnotation & OptionalTransform, AnnotationRenderSettings>
}
export type VolumeGridData = Omit<AxisAlignedZarrSlice, 'planeParameter'> & { slices: number } & OptionalTransform
export type VolumetricGridLayer = {
    type: 'volumeGrid';
    data: VolumeGridData;
    render: ReglLayer2D<VolumeGridData, SliceRenderSettings<CacheEntry>>
}
export type Layer = ScatterPlotLayer | VolumetricSliceLayer | AnnotationLayer | VolumetricGridLayer;