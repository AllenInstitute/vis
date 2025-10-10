import type { vec2 } from '@alleninstitute/vis-geometry';
import { OMEZARR_FILESET_OPTIONS } from '../common/filesets/omezarr/demo-filesets';
import { SharedCacheProvider } from '../common/react/priority-cache-provider';
import { OmeZarrView } from './omezarr-v3-client';

const screenSize: vec2 = [800, 800];

export function OmeZarrV3Demo() {
    return (
        <SharedCacheProvider>
            <OmeZarrView res={OMEZARR_FILESET_OPTIONS[5].res} screenSize={screenSize} />
        </SharedCacheProvider>
    );
}
