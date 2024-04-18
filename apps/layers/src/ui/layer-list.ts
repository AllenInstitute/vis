import { IMGUI, radio } from "@thi.ng/imgui";
import type { IGridLayout } from "@thi.ng/layout";
import type { Layer } from "../types";
import { whenDefined } from "./utils";


export function layerListUI(gui: IMGUI, grid: IGridLayout<any>, selectedIndex: number, layers: Layer[], pickLayer: (i: number) => void) {
    const names = layers.map(l => l.type)
    if (names.length > 0) {
        whenDefined(radio(gui, grid, 'layers', false, selectedIndex, false, names), pickLayer);
    }
}