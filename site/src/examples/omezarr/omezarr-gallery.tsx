import type { WebResource } from '@alleninstitute/vis-core';
import { SharedCacheProvider } from '../common/react/priority-cache-provider';
import { OmeZarrView } from './omezarr-client';
import type { vec2 } from '@alleninstitute/vis-geometry';

const tissuecyte_1: WebResource = {
  type: 's3',
  region: 'us-west-2',
  url: 's3://allen-genetic-tools/tissuecyte/823818122/ome_zarr_conversion/823818122.zarr/',
};
const tissuecyte_2: WebResource = {
  type: 's3',
  region: 'us-west-2',
  url: 's3://allen-genetic-tools/tissuecyte/1196424284/ome_zarr_conversion/1196424284.zarr/',
};
const versa: WebResource = {
  type: 'https',
  url: 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/',
};

const screenSize: vec2 = [300, 300];
export function OmezarrGalleryDemo() {
  return (
    <SharedCacheProvider>
      <div style={{ display: 'grid', gridRowGap: 50 }}>
        <div style={{ gridRow: 1, gridColumn: 1 }}>
          <OmeZarrView res={tissuecyte_2} screenSize={screenSize} />
        </div>
        <div style={{ gridRow: 1, gridColumn: 2 }}>
          <OmeZarrView res={tissuecyte_1} screenSize={screenSize} />
        </div>
        <div style={{ gridRow: 2, gridColumn: 1 }}>
          <OmeZarrView res={tissuecyte_2} screenSize={screenSize} />
        </div>
        <div style={{ gridRow: 2, gridColumn: 2 }}>
          <OmeZarrView res={tissuecyte_1} screenSize={screenSize} />
        </div>
        <div style={{ gridRow: 3, gridColumn: 1 }}>
          <OmeZarrView res={versa} screenSize={screenSize} />
        </div>
        <div style={{ gridRow: 3, gridColumn: 2 }}>
          <OmeZarrView res={versa} screenSize={screenSize} />
        </div>
      </div>
    </SharedCacheProvider>
  );
}
