import { loadMetadata, type OmeZarrMetadata } from '@alleninstitute/vis-omezarr';
import { RenderServerProvider } from '../common/react/render-server-provider';
import { AnnotatedOmeZarrView } from './AnnotatedOmeZarr';
import { useEffect, useState } from 'react';
import { isPointAnnotation, ParseNGPrecomputedInfo, type PointAnnotationInfo } from '@alleninstitute/vis-precomputed';

const SPIM = {
    type: 's3',
    region: 'us-west-2',
    url: 's3://aind-open-data/SmartSPIM_787715_2025-04-08_18-33-36_stitched_2025-04-09_22-42-59/image_tile_fusing/OMEZarr/Ex_445_Em_469.zarr',
    //   url: 's3://allen-genetic-tools/tissuecyte/823818122/ome_zarr_conversion/823818122.zarr/',
} as const;
const dots =
    'https://aind-open-data.s3.amazonaws.com/SmartSPIM_787715_2025-04-08_18-33-36_stitched_2025-04-09_22-42-59/image_cell_segmentation/Ex_445_Em_469/visualization/detected_precomputed/';
function useJunk() {
    const [omezarr, setOmezarr] = useState<OmeZarrMetadata | null>(null);
    const [annotations, setAnnotations] = useState<PointAnnotationInfo | null>(null);
    useEffect(() => {
        loadMetadata(SPIM).then((v) => {
            setOmezarr(v);
        });
        fetch(`${dots}info`)
            .then((x) => x.json())
            .then((json) => ParseNGPrecomputedInfo(json))
            .then((yay) => {
                if (yay && isPointAnnotation(yay)) {
                    setAnnotations({ ...yay, url: dots });
                }
            });
    }, []);

    const loading = omezarr === null || annotations === null;
    return [loading, annotations, omezarr] as const;
}

export function Demo() {
    const [_loading, points, img] = useJunk();
    return (
        <RenderServerProvider>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
                {points && img && <AnnotatedOmeZarrView img={img} points={points} screenSize={[600, 600]} />}
            </div>
        </RenderServerProvider>
    );
}
