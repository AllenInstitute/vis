import React, { useEffect, useState } from 'react';
import { RenderServerProvider } from '~/common/react/render-server-provider';
import { SliceView } from './sliceview';
import { type OmeZarrDataset, loadOmeZarr } from '@alleninstitute/vis-omezarr';

const demo_versa = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/';

export function AppUi() {
    return <DataPlease />;
}

function DataPlease() {
    // load our canned data for now:
    const [omezarr, setfile] = useState<OmeZarrDataset | undefined>(undefined);
    useEffect(() => {
        loadOmeZarr(demo_versa).then((dataset) => {
            setfile(dataset);
            console.log('loaded!');
        });
    }, []);
    return (
        <RenderServerProvider>
            <SliceView omezarr={omezarr} />
        </RenderServerProvider>
    );
}
