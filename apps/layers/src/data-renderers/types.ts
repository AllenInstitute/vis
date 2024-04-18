
// generic rendering of renderable things...

import type { Interval, box2D, vec2, vec4 } from "@alleninstitute/vis-geometry";
import type { NormalStatus } from "@alleninstitute/vis-scatterbrain";
import type { ZarrDataset } from "~/loaders/ome-zarr/zarr-data";
import type { SlideViewDataset, ColumnRequest } from "~/loaders/scatterplot/scatterbrain-loader";
import type { AxisAlignedPlane } from "../../../omezarr-viewer/src/slice-renderer";

export type Camera = {
    view: box2D;
    screen: vec2;
}

export type OptionalTransform = {
    toModelSpace?: {
        offset: vec2;
        scale: vec2;
    }
}

export type DynamicGridSlide = {
    type: 'DynamicGridSlide'
    dimensions: 2;
    dataset: SlideViewDataset;
    slideId: string;
    colorBy: ColumnRequest;
}

export type AxisAlignedZarrSlice = {
    type: 'AxisAlignedZarrSlice'
    dimensions: 2;
    dataset: ZarrDataset;
    plane: AxisAlignedPlane;
    planeParameter: number;
    gamut: Interval[]; // one for each channel in the given dataset
}



type Path = {
    points: vec2[];
    bounds: box2D;
    color: vec4;
}
type Drawing = {
    paths: readonly Path[];
    // todo more later...
}
export type AnnotationLayer = {
    type: "AnnotationLayer"
    dimensions: 2;
    drawing: Drawing;
}
export type TwoDimensional = {
    dimensions: 2
};
export type RenderCallback = (event: { status: NormalStatus } | { status: 'error', error: unknown }) => void;

