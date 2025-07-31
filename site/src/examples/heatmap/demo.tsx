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
const sead =
  'https://bkp-2d-visualizations.s3.amazonaws.com/sea-ad-tenx_20240531-20240724234246/98JE3Z1ILSDCIEMA6LQ/ScatterBrain.json';
const wmb_10x =
  'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json';
const slides =
  'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_ccf_05092024-20240510165753/DTVLE1YGNTJQMWVMKEU/ScatterBrain.json';
const xist = 3461;
const sx = '8RBF4DUUJ5SW83JZYW8';
const Class = 'FS00DXV0T9R1X9FJ4QE';
const supertype = 'CBGC0U30VV9JPR60TJU';
const subclass = 'QY5S8KMO5HLJUF0P00K';
const ntType = 'Y937CVUSVZC7KYOHWVO';
export function HeatMapDemo() {
  const [rows, setRows] = useState(countingUp(50));
  const [cols, setCols] = useState(countingUp(8000));
  return (
    <HeatmapView
      rows={rows}
      genes={cols}
      category={ntType}
      screenSize={[1600, 900]}
      url={wmb_10x}
      // url="https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json"
    />
  );
}
