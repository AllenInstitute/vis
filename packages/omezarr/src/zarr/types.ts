import type { Interval, vec3, vec4 } from '@alleninstitute/vis-geometry';
import { makeRGBAColorVector } from '@alleninstitute/vis-core';
import type * as zarr from 'zarrita';
import { z } from 'zod';

export type ZarrDimension = 't' | 'c' | 'z' | 'y' | 'x';
export type OmeZarrDimension = ZarrDimension;

export type OmeZarrAxis = {
    name: string;
    type: string;
    scale?: number | undefined;
    unit?: string | undefined;
};

export const OmeZarrAxisSchema: z.ZodType<OmeZarrAxis> = z.object({
    name: z.string().toLowerCase(),
    type: z.string(),
    scale: z.number().optional(),
    unit: z.string().optional(),
});

export type OmeZarrCoordinateTranslation = {
    translation: number[];
    type: 'translation';
};

// due to a difference in types between ZodObject and ZodType,
// currently this schema cannot be associated directly with
// ZarrCoordinateScale using z.ZodType<T>
// TODO try to fix this in the future
export const OmeZarrCoordinateTranslationSchema = z.object({
    translation: z.number().array().min(4).max(5),
    type: z.literal('translation'),
});

export type OmeZarrCoordinateScale = {
    scale: number[];
    type: 'scale';
};

// due to a difference in types between ZodObject and ZodType,
// currently this schema cannot be associated directly with
// ZarrCoordinateScale using z.ZodType<T>
// TODO try to fix this in the future
export const OmeZarrCoordinateScaleSchema = z.object({
    scale: z.number().array().min(4).max(5),
    type: z.literal('scale'),
});

export type OmeZarrCoordinateTransform = OmeZarrCoordinateTranslation | OmeZarrCoordinateScale;

export const OmeZarrCoordinateTransformSchema: z.ZodType<OmeZarrCoordinateTransform> = z.discriminatedUnion('type', [
    OmeZarrCoordinateTranslationSchema,
    OmeZarrCoordinateScaleSchema,
]);

export type OmeZarrDataset = {
    coordinateTransformations: OmeZarrCoordinateTransform[];
    path: string;
};

export type OmeZarrShapedDataset = OmeZarrDataset & {
    shape: ReadonlyArray<number>;
    multiscaleIndex: number;
    datasetIndex: number;
};

export const OmeZarrDatasetSchema: z.ZodType<OmeZarrDataset> = z.object({
    coordinateTransformations: OmeZarrCoordinateTransformSchema.array().nonempty(),
    path: z.string(),
});

export type OmeZarrMultiscale = {
    axes: OmeZarrAxis[];
    datasets: OmeZarrDataset[];
    name: string;
    version?: string | undefined;
    type?: string | undefined;
};

export const OmeZarrMultiscaleSchema: z.ZodType<OmeZarrMultiscale> = z.object({
    name: z.string(),
    version: z.string().optional(),
    type: z.string().optional(),
    axes: OmeZarrAxisSchema.array().nonempty(),
    datasets: OmeZarrDatasetSchema.array().nonempty(),
});

export type OmeZarrOmeroChannelWindow = {
    min: number;
    start: number;
    end: number;
    max: number;
};

export const OmeZarrOmeroChannelWindowSchema: z.ZodType<OmeZarrOmeroChannelWindow> = z.object({
    min: z.number(),
    start: z.number(),
    end: z.number(),
    max: z.number(),
});

export type OmeZarrOmeroChannel = {
    active?: boolean | undefined;
    color: string;
    label?: string | undefined;
    window: OmeZarrOmeroChannelWindow;
};

export const OmeZarrOmeroChannelSchema: z.ZodType<OmeZarrOmeroChannel> = z.object({
    active: z.boolean().optional(),
    color: z.string(),
    label: z.string().optional(),
    window: OmeZarrOmeroChannelWindowSchema,
});

export type OmeZarrOmero = {
    channels: OmeZarrOmeroChannel[];
};

export type OmeZarrColorChannel = {
    rgb: vec3;
    rgba: vec4;
    window: Interval;
    range: Interval;
    active?: boolean | undefined;
    label?: string | undefined;
};

export const OmeZarrOmeroSchema: z.ZodType<OmeZarrOmero> = z.object({
    channels: OmeZarrOmeroChannelSchema.array().nonempty(),
});

export type BaseOmeZarrAttrs = {
    multiscales: OmeZarrMultiscale[];
    omero?: OmeZarrOmero | undefined; // omero is a transitional field, meaning it is expected to go away in a later version
};

export type OmeZarrAttrsV2 = BaseOmeZarrAttrs;

export type OmeZarrAttrsV3 = {
    ome: BaseOmeZarrAttrs;
};

// newer types that align a little more closely with how Zarr/OME-Zarr data
// is actually represented
export type OmeZarrNode = {
    nodeType: 'group' | 'array';
};

export type OmeZarrGroup = OmeZarrNode & {
    nodeType: 'group';
    zarrFormat: 2 | 3;
    attributes: OmeZarrGroupAttributes;
};

export type OmeZarrGroupAttributes = {
    multiscales: OmeZarrMultiscale[];
    omero?: OmeZarrOmero | undefined; // omero is a transitional field, meaning it is expected to go away in a later version
    version?: string | undefined;
};

export type OmeZarrArray = OmeZarrNode & {
    nodeType: 'array';
    path: string;
    chunkShape: number[];
    dataType: string;
    shape: number[];
    attributes: Record<string, unknown>;
};

export const OmeZarrAttrsBaseSchema: z.ZodType<OmeZarrAttrsV2> = z.object({
    multiscales: OmeZarrMultiscaleSchema.array().nonempty(),
    omero: OmeZarrOmeroSchema.optional(),
});

export const OmeZarrAttrsV2Schema = OmeZarrAttrsBaseSchema;

export const OmeZarrAttrsV3Schema: z.ZodType<OmeZarrAttrsV3> = z.object({
    ome: OmeZarrAttrsBaseSchema,
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

export function convertFromOmeroToColorChannels(omero: OmeZarrOmero): OmeZarrColorChannel[] {
    return omero.channels.map(convertFromOmeroChannelToColorChannel);
}

export function convertFromOmeroChannelToColorChannel(omeroChannel: OmeZarrOmeroChannel): OmeZarrColorChannel {
    const active = omeroChannel.active;
    const label = omeroChannel.label;
    const rgba = makeRGBAColorVector(omeroChannel.color);
    const rgb: vec3 = [rgba[0], rgba[1], rgba[2]];
    const { min: winMin, max: winMax } = omeroChannel.window;
    const { start: ranMin, end: ranMax } = omeroChannel.window;
    const window: Interval = { min: winMin, max: winMax };
    const range: Interval = { min: ranMin, max: ranMax };

    return { rgb, rgba, window, range, active, label };
}
