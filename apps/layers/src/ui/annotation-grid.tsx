// in normal times, I would connect simple components with a map state to props function
// but - this is a janky demo, and I am already going real slow - so lets just do this the gross way

import React from 'react';
import type { Demo } from 'src/demo';
import { InputSlider } from '@czi-sds/components';
export function AnnotationGrid(props: { demo: Demo }) {
  const { demo } = props;
  // control the gamut with some sliders
  const l = demo.layers[demo.selectedLayer];
  if(l && l.type==='annotationGrid'){
    return (<InputSlider
          min={0}
          max={1}
          step={0.001}
          value={l.data.fill.opacity}
          onChange={(e, value) => {
            demo.setOpacity('fill', value as number)
          }}
        />)
  }
  return null;
}
