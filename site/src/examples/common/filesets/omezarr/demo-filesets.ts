import type { WebResource } from '@alleninstitute/vis-core';

export type OmeZarrFilesetOption = { value: string; label: string; zarrVersion: number; res: WebResource };

export const OMEZARR_FILESET_OPTIONS: OmeZarrFilesetOption[] = [
    {
        value: 'opt1',
        label: 'VERSA OME-Zarr Example (HTTPS) (color channels: [R, G, B])',
        zarrVersion: 2,
        res: { type: 'https', url: 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/' },
    },
    {
        value: 'opt2',
        label: 'VS200 Example Image (S3) (color channels: [CFP, YFP])',
        zarrVersion: 2,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/epifluorescence/1401210938/ome_zarr_conversion/1401210938.zarr/',
        },
    },
    {
        value: 'opt3',
        label: 'EPI Example Image (S3) (color channels: [R, G, B])',
        zarrVersion: 2,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/epifluorescence/1383646325/ome_zarr_conversion/1383646325.zarr/',
        },
    },
    {
        value: 'opt4',
        label: 'STPT Example Image (S3) (color channels: [R, G, B])',
        zarrVersion: 2,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/tissuecyte/823818122/ome_zarr_conversion/823818122.zarr/',
        },
    },
    {
        value: 'opt5',
        label: 'Smart-SPIM (experimental)',
        zarrVersion: 2,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://aind-open-data/SmartSPIM_787715_2025-04-08_18-33-36_stitched_2025-04-09_22-42-59/image_tile_fusing/OMEZarr/Ex_445_Em_469.zarr',
        },
    },
    {
        value: 'opt6',
        label: 'VS200 Brightfield #1458501514 (Zarr v3)',
        zarrVersion: 3,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://h301-scanning-802451596237-us-west-2/2402091625/ome_zarr_conversion/1458501514.zarr/',
        },
    },
    {
        value: 'opt7',
        label: 'VS200 Epifluorescence #1161134570 (Zarr v3)',
        zarrVersion: 3,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://cortex-aav-toolbox-802451596237-us-west-2/epifluorescence/1161134570/ome_zarr_conversion/1161134570.zarr',
        },
    },
    {
        value: 'opt8',
        label: 'VERSA Epifluorescence #1161864579 (Zarr v3)',
        zarrVersion: 3,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://cortex-aav-toolbox-802451596237-us-west-2/epifluorescence/1161864579/ome_zarr_conversion/1161864579.zarr',
        },
    },
    {
        value: 'opt9',
        label: 'STPT #802451596237 (Zarr v3)',
        zarrVersion: 3,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://public-development-802451596237-us-west-2/tissuecyte/478097069/ome_zarr_conversion/478097069.zarr/',
        },
    },
    {
        value: 'opt10',
        label: 'Tissuecyte #823818122',
        zarrVersion: 2,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/tissuecyte/823818122/ome_zarr_conversion/823818122.zarr/',
        },
    },
    {
        value: 'opt11',
        label: 'Tissuecyte #1196424284',
        zarrVersion: 2,
        res: {
            type: 's3',
            region: 'us-west-2',
            url: 's3://allen-genetic-tools/tissuecyte/1196424284/ome_zarr_conversion/1196424284.zarr/',
        },
    },
    {
        value: 'opt12',
        label: 'Neuroglancer Prototype VERSA #0500408166',
        zarrVersion: 2,
        res: {
            type: 'https',
            url: 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/',
        }
    }
];
