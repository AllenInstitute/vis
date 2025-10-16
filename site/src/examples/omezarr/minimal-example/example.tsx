import { CachedOmeZarrConnection, type OmeZarrConnection } from '@alleninstitute/vis-omezarr';
import { useEffect, useState } from 'react';
import { SliceView } from './sliceview';
import { OMEZARR_DEMO_FILESETS } from '../../common/filesets/omezarr';
import { RenderServerProvider } from '../../common/react/render-server-provider';

/**
 * HEY!!!
 * this is an example React Component for rendering A single slice of an OMEZARR image in a react component
 * This example is as bare-bones as possible! It is NOT the recommended way to do anything, its just trying to show
 * one way of using our rendering utilities for OmeZarr data, specifically in a react component.
 * Your needs for state-management, slicing logic, etc might all be different!
 */
export function BasicOmeZarrDemo() {
    // load our canned data for now:
    const [connection, setConnection] = useState<OmeZarrConnection | undefined>(undefined);

    useEffect(() => {
        const connection = new CachedOmeZarrConnection(
            OMEZARR_DEMO_FILESETS[0].res,
            () => new Worker(new URL('../../common/loaders/fetch.worker.ts', import.meta.url)),
        );
        setConnection(connection);
        connection.loadMetadata();
    }, []);
    return (
        <RenderServerProvider>
            <SliceView omezarr={connection} />
        </RenderServerProvider>
    );
}
