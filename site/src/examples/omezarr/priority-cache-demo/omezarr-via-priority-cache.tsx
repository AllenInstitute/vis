import type { vec2 } from '@alleninstitute/vis-geometry';
import { SharedCacheProvider } from '../../common/react/priority-cache-provider';
import { OmeZarrView } from './omezarr-client'
import { OMEZARR_DEMO_FILESETS } from 'src/examples/common/filesets/omezarr';

const screenSize: vec2 = [800, 800];

export function OmezarrDemo() {
    return (
        <SharedCacheProvider>
            <OmeZarrView res={OMEZARR_DEMO_FILESETS[3].res} screenSize={screenSize} />
        </SharedCacheProvider>
    );
}
