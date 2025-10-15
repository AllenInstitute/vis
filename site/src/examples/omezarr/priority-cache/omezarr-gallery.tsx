import type { WebResource } from '@alleninstitute/vis-core';
import { SharedCacheProvider } from '../../common/react/priority-cache-provider';
import { OmeZarrView } from './omezarr-client';
import type { vec2 } from '@alleninstitute/vis-geometry';
import { OMEZARR_FILESET_OPTIONS } from 'src/examples/common/filesets/omezarr/demo-filesets';

const tissuecyte_1: WebResource = OMEZARR_FILESET_OPTIONS[11].res;
const tissuecyte_2: WebResource = OMEZARR_FILESET_OPTIONS[12].res;
const versa: WebResource = OMEZARR_FILESET_OPTIONS[13].res;

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
