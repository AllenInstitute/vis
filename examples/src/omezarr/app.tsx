import React, { useEffect, useState } from 'react';
import { RenderServerProvider } from '~/common/react/render-server-provider';
import { SliceView } from './sliceview';
import { type OmeZarrDataset, loadOmeZarr } from '@alleninstitute/vis-omezarr';

// const demo_versa = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/';
const SPST = 'https://allen-genetic-tools.s3.us-west-2.amazonaws.com/tissuecyte/1263343692/ome-zarr/';
export function AppUi() {
    return <DataPlease />;
}

function DataPlease() {
    // load our canned data for now:
    const [omezarr, setfile] = useState<OmeZarrDataset | undefined>(undefined);
    useEffect(() => {
        loadOmeZarr(SPST).then((dataset) => {
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
