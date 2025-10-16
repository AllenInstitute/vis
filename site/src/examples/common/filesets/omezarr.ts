import type { WebResource } from "@alleninstitute/vis-core";

export type OmeZarrDemoFileset = { value: string; label: string; res: WebResource };

export const OMEZARR_DEMO_FILESETS: OmeZarrDemoFileset[] = [
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
        label: 'Smart-SPIM (experimental)',
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://aind-open-data/SmartSPIM_787715_2025-04-08_18-33-36_stitched_2025-04-09_22-42-59/image_tile_fusing/OMEZarr/Ex_445_Em_469.zarr',
        },
    },
    {
        value: 'opt6',
        label: 'SmartSpim Lightsheet',
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/lightsheet/SmartSPIM_741764_2024-07-25_19-33-17_stitched_2024-07-26_16-49-41/OMEZarr/sagittal_MIP.zarr/',
        },
    },
    {
        value: 'opt7',
        label: 'V3 Zarr Example Image (S3) (color channels: [R, G, B])',
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://h301-scanning-802451596237-us-west-2/2402091625/ome_zarr_conversion/1458501514.zarr/',
        },
    },
    {
        value: 'opt8',
        label: 'STPT V3 example',
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://public-development-802451596237-us-west-2/tissuecyte/478097069/ome_zarr_conversion/478097069.zarr/',
        },
    },
    {
        value: 'opt9',
        label: 'Tissuecyte #1196424284',
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/tissuecyte/1196424284/ome_zarr_conversion/1196424284.zarr/',
        }
    },
];
