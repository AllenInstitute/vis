// in normal times, I would connect simple components with a map state to props function
// but - this is a janky demo, and I am already going real slow - so lets just do this the gross way

import React from 'react';
import type { Demo } from 'src/demo';
import { InputSlider } from '@czi-sds/components';
export function ScatterplotUI(props: { demo: Demo }) {
  const { demo } = props;
  // control the gamut with some sliders
  const l = demo.layers[demo.selectedLayer];
  if(l && l.type==='scatterplot' || l.type==='scatterplotGrid'){
    return (<div>
        <label>point size</label>
    <InputSlider
          min={0.5}
          max={20}
          step={0.001}
          value={l.data.pointSize}
          onChange={(e, value) => {
            demo.setPointSize(value as number)
          }}
        />
        <label>{`Color By Gene (by index: ${l.data.colorBy.name})`}</label>
        <InputSlider
          min={0}
          max={400}
          step={1}
          value={Number(l.data.colorBy.name)}
          onChange={(e, value) => {
            demo.setColorByIndex(value as number)
          }}
        />
        </div>)

  }
  return null;
}
