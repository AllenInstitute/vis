import { IMGUI, radio, sliderH, } from "@thi.ng/imgui";
import { whenDefined } from "./utils";
import type { IGridLayout } from "@thi.ng/layout";
import type { VolumetricSliceLayer } from "../types";
import type { AxisAlignedPlane } from "../../../omezarr-viewer/src/slice-renderer";

const planes: AxisAlignedPlane[] = ['xy', 'xz', 'yz'] as const;
export function volumeSliceLayer(gui: IMGUI, grid: IGridLayout<any>, layer: VolumetricSliceLayer, changeSlice: (i: number) => void, pickDim: (p: AxisAlignedPlane) => void) {
    whenDefined(sliderH(gui, grid, 'slice param', 0, 1.0, 0.01, layer.data.planeParameter, 'slice'), changeSlice);
    whenDefined(radio(gui, grid, 'plane', true, planes.indexOf(layer.data.plane), false, planes), (i) => pickDim(planes[i]));

}