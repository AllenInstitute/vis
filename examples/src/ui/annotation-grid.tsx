import { InputSlider } from "@czi-sds/components";
import React from "react";
import type { Demo } from "src/layers";
export function AnnotationGrid(props: { demo: Demo }) {
	const { demo } = props;
	// control the gamut with some sliders
	const l = demo.layers[demo.selectedLayer];
	if (l && l.type === "annotationGrid") {
		return (
			<InputSlider
				min={0}
				max={1}
				step={0.001}
				value={l.data.fill.opacity}
				onChange={(e, value) => {
					demo.setOpacity("fill", value as number);
				}}
			/>
		);
	}
	return null;
}
