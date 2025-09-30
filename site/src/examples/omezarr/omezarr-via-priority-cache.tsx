/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <explanation> */
/** biome-ignore-all lint/performance/noAccumulatingSpread: <explanation> */
import type { vec2 } from '@alleninstitute/vis-geometry';
import type { WebResource } from '@alleninstitute/vis-core';
import { SharedCacheProvider } from '../common/react/priority-cache-provider';
import { OmeZarrView } from './omezarr-client';
type DemoOption = { value: string; label: string; res: WebResource };

const demoOptions: DemoOption[] = [
    {
        value: 'opt1',
        label: 'VERSA OME-Zarr Example (HTTPS) (color channels: [R, G, B])',
        res: { type: 'https', url: 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/' },
    },
    {
        value: 'opt2',
        label: 'VS200 Example Image (S3) (color channels: [CFP, YFP])',
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/epifluorescence/1401210938/ome_zarr_conversion/1401210938.zarr/',
        },
    },
    {
        value: 'opt3',
        label: 'EPI Example Image (S3) (color channels: [R, G, B])',
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/epifluorescence/1383646325/ome_zarr_conversion/1383646325.zarr/',
        },
    },
    {
        value: 'opt4',
        label: 'STPT Example Image (S3) (color channels: [R, G, B])',
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/tissuecyte/823818122/ome_zarr_conversion/823818122.zarr/',
        },
    },
    {
        value: 'opt5',
        label: 'SmartSpim Lightsheet',
        res: {
            type: 's3',
            region: 'us-west-2',
            url:'s3://allen-genetic-tools/lightsheet/SmartSPIM_741764_2024-07-25_19-33-17_stitched_2024-07-26_16-49-41/OMEZarr/sagittal_MIP.zarr/'
        },
    },
];

const screenSize: vec2 = [800, 800];

export function OmezarrDemo() {
    return (
        <SharedCacheProvider>
            <OmeZarrView res={demoOptions[4].res} screenSize={screenSize} />
        </SharedCacheProvider>
    );
}
