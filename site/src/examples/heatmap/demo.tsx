import { useState } from 'react';
import { HeatmapView } from './heatmap-client';
import { SharedCacheProvider } from '../common/react/priority-cache-provider';

function countingUp(r: number) {
  const buffer = new Array<number>(r);
  for (let i = 0; i < r; i++) {
    buffer[i] = i;
  }
  return buffer;
}
const Class = 'FS00DXV0T9R1X9FJ4QE';
const supertype = 'CBGC0U30VV9JPR60TJU';
export function HeatMapDemo() {
  const [rows, setRows] = useState(countingUp(400));
  const [cols, setCols] = useState(countingUp(50));
  return (
    <SharedCacheProvider>
      <HeatmapView
        rows={rows}
        genes={cols}
        category="QY5S8KMO5HLJUF0P00K"
        screenSize={[800, 800]}
        url="https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json"
        // url="https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json"
      />
    </SharedCacheProvider>
  );
}
