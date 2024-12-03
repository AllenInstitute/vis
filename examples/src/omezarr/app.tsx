import React, { useEffect, useState } from 'react';
import { RenderServerProvider } from '~/common/react/render-server-provider';
import { SliceView } from './sliceview';
import { type OmeZarrDataset, loadOmeZarr } from '@alleninstitute/vis-omezarr';

const demo_versa = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/';
export function AppUi() {
    return <DataPlease />;
}
/**
 * HEY!!!
 * this is an example React Component for rendering A single slice of an OMEZARR image in a react component
 * This example is as bare-bones as possible! It is NOT the recommended way to do anything, its just trying to show
 * one way of:
 * 1. using our rendering utilities for OmeZarr data, specifically in a react component. Your needs for state-management,
 * slicing logic, etc might all be different!
 *
 */
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
