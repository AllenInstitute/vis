
import { IMGUI, radio } from "@thi.ng/imgui";
import { whenDefined } from "./utils";
import type { IGridLayout } from "@thi.ng/layout";
import type { AnnotationLayer, VolumetricSliceLayer } from "../types";
import type { AxisAlignedPlane } from "../../../omezarr-viewer/src/slice-renderer";

const planes = ['draw', 'pan'] as const;
export function annotationUi(gui: IMGUI, grid: IGridLayout<any>, mode: 'draw' | 'pan', layer: AnnotationLayer, setMode: (m: 'draw' | 'pan') => void) {
    whenDefined(radio(gui, grid, 'plane', true, planes.indexOf(mode), false, planes as any), (i) => setMode(planes[i]));

}