import type * as zarr from 'zarrita';
import z from 'zod';
import {
    type OmeZarrArray,
    type OmeZarrAttrsV2,
    OmeZarrAttrsV2Schema,
    type OmeZarrAttrsV3,
    OmeZarrAttrsV3Schema,
    type OmeZarrGroup,
} from './types';

type ZarritaArray = zarr.Array<zarr.DataType, zarr.FetchStore>;

export const OmeZarrArrayTransform = z.transform<ZarritaArray, OmeZarrArray>((v: ZarritaArray) => {
    return {
        nodeType: 'array',
        path: v.path,
        chunkShape: v.chunks,
        dataType: v.dtype,
        shape: v.shape,
        attributes: v.attrs,
    } as OmeZarrArray;
});

export const OmeZarrGroupTransform = z
    .union([OmeZarrAttrsV2Schema, OmeZarrAttrsV3Schema])
    .transform<OmeZarrGroup>((v: OmeZarrAttrsV2 | OmeZarrAttrsV3) => {
        if ('ome' in v) {
            return {
                nodeType: 'group',
                zarrFormat: 3,
                attributes: v.ome,
            };
        }
        return {
            nodeType: 'group',
            zarrFormat: 2,
            attributes: v,
        };
    });
