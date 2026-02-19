import type { WebResource } from '@alleninstitute/vis-core';
import { SharedCacheProvider } from '../../common/react/priority-cache-provider';
import { OmeZarrView } from '../priority-cache-demo/omezarr-client';
import type { vec2 } from '@alleninstitute/vis-geometry';
import { OMEZARR_DEMO_FILESETS } from 'src/examples/common/filesets/omezarr';

const tissuecyte_1: WebResource = OMEZARR_DEMO_FILESETS[3].res;
const tissuecyte_2: WebResource = OMEZARR_DEMO_FILESETS[8].res;
const versa: WebResource = OMEZARR_DEMO_FILESETS[0].res;

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
