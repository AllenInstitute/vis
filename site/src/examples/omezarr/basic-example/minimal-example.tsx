import { RenderServerProvider } from "src/examples/common/react/render-server-provider";
import { SliceView } from "./sliceview";
import { useEffect, useState } from "react";
import { loadMetadata, type OmeZarrMetadata } from "@alleninstitute/vis-omezarr";
import { logger } from "@alleninstitute/vis-core";
import { OMEZARR_DEMO_FILESETS } from "src/examples/common/filesets/omezarr";

/**
 * HEY!!!
 * this is an example React Component for rendering A single slice of an OMEZARR image in a react component
 * This example is as bare-bones as possible! It is NOT the recommended way to do anything, its just trying to show
 * one way of:
 * 1. using our rendering utilities for OmeZarr data, specifically in a react component. Your needs for state-management,
 * slicing logic, etc might all be different!
 *
 */
export function DataPlease() {
    // load our canned data for now:
    const [omezarr, setfile] = useState<OmeZarrMetadata | undefined>(undefined);
    useEffect(() => {
        loadMetadata(OMEZARR_DEMO_FILESETS[0].res).then((dataset) => {
            setfile(dataset);
            logger.info('loaded!');
        });
    }, []);
    return (
        <RenderServerProvider>
            <SliceView omezarr={omezarr} />
        </RenderServerProvider>
    );
}
