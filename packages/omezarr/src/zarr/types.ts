import type { CartesianPlane, Interval, vec3, vec4 } from '@alleninstitute/vis-geometry';
import { VisZarrDataError, VisZarrIndexError } from '../errors';
import { logger, makeRGBAColorVector } from '@alleninstitute/vis-core';
import { z } from 'zod';

export type ZarrDimension = 't' | 'c' | 'z' | 'y' | 'x';

// these dimension indices are given for a 4-element shape array
const SHAPE_Z_DIM_INDEX = 1;
const SHAPE_Y_DIM_INDEX = 2;
const SHAPE_X_DIM_INDEX = 3;

export type OmeZarrAxis = {
    name: string;
    type: string;
    scale?: number | undefined;
    unit?: string | undefined;
};

export const OmeZarrAxisSchema: z.ZodType<OmeZarrAxis> = z.object({
    name: z.string(),
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
    version: string;
};

export const OmeZarrMultiscaleSchema: z.ZodType<OmeZarrMultiscale> = z.object({
    name: z.string(),
    version: z.string(),
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

export type OmeZarrAttrs = {
    multiscales: OmeZarrMultiscale[];
    omero?: OmeZarrOmero | undefined; // omero is a transitional field, meaning it is expected to go away in a later version
};

export const OmeZarrAttrsSchema: z.ZodType<OmeZarrAttrs> = z.object({
    multiscales: OmeZarrMultiscaleSchema.array().nonempty(),
    omero: OmeZarrOmeroSchema.optional(),
});

export type DehydratedOmeZarrArray = {
    path: string;
};

// For details on Zarr Array Metadata format, see: https://zarr-specs.readthedocs.io/en/latest/v2/v2.0.html
export type OmeZarrArrayMetadata = {
    path: string;
    shape: number[];
    attrs?: Record<string, unknown> | undefined;
};

export type DehydratedOmeZarrMetadata = {
    url: string;
    attrs: OmeZarrAttrs;
    arrays: OmeZarrArrayMetadata[];
    zarrVersion: number;
};

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

export type OmeZarrMetadataFlattened = {
    url: string;
    attrs: OmeZarrAttrs;
    arrays: ReadonlyArray<OmeZarrArrayMetadata>;
    zarrVersion: number;
    colorChannels: OmeZarrColorChannel[];
    redChannel: OmeZarrColorChannel | undefined;
    blueChannel: OmeZarrColorChannel | undefined;
    greenChannel: OmeZarrColorChannel | undefined;
};

export class OmeZarrMetadata {
    #url: string;
    #attrs: OmeZarrAttrs;
    #arrays: ReadonlyArray<OmeZarrArrayMetadata>;
    #zarrVersion: number;

    constructor(url: string, attrs: OmeZarrAttrs, arrays: ReadonlyArray<OmeZarrArrayMetadata>, zarrVersion: number) {
        this.#url = url;
        this.#attrs = attrs;
        this.#arrays = arrays;
        this.#zarrVersion = zarrVersion;
    }

    get url(): string {
        return this.#url;
    }

    get attrs(): OmeZarrAttrs {
        return this.#attrs;
    }

    get arrays(): ReadonlyArray<OmeZarrArrayMetadata> {
        return this.#arrays;
    }

    get zarrVersion(): number {
        return this.#zarrVersion;
    }

    toJSON(): OmeZarrMetadataFlattened {
        return {
            url: this.url,
            attrs: this.attrs,
            arrays: this.arrays,
            zarrVersion: this.zarrVersion,
            colorChannels: this.colorChannels,
            redChannel: this.redChannel,
            blueChannel: this.blueChannel,
            greenChannel: this.greenChannel,
        };
    }

    #getMultiscaleIndex(multiscale?: number | string): number {
        if (multiscale !== undefined) {
            if (typeof multiscale === 'number') {
                if (multiscale < 0) {
                    return -1;
                }
                return multiscale;
            }
            return this.#attrs.multiscales.findIndex((m) => m.name === multiscale);
        }
        return 0;
    }

    #getValidMultiscaleIndex(multiscale?: number | string): number {
        const multiscaleIndex = this.#getMultiscaleIndex(multiscale);
        if (multiscaleIndex < 0) {
            const message = `invalid multiscale requested: identifier [${multiscale}]`;
            logger.error(message);
            throw new VisZarrIndexError(message);
        }
        return multiscaleIndex;
    }

    #getDatasetIndex(dataset: number | string, multiscaleIndex: number): number {
        const datasets = this.#attrs.multiscales[multiscaleIndex]?.datasets ?? null;
        if (!datasets) {
            return -1;
        }
        if (typeof dataset === 'number') {
            if (dataset < 0 || dataset >= datasets.length) {
                return -1;
            }
            return dataset;
        }
        return datasets.findIndex((d) => d.path === dataset);
    }

    #getValidDatasetIndex(dataset: number | string, multiscaleIndex: number): number {
        const datasetIndex = this.#getDatasetIndex(dataset, multiscaleIndex);
        if (datasetIndex < 0) {
            const message = `invalid dataset requested: identifier [${dataset}]`;
            logger.error(message);
            throw new VisZarrIndexError(message);
        }
        return datasetIndex;
    }

    /** Private function that retrieves the X value from the `shape` of a given array, within a
     * specific multiscale representation of the data.
     */
    #getShapeX(array: OmeZarrArrayMetadata, multiscaleIndex: number): number {
        const shape = array.shape;
        if (!shape || shape.length < 4) {
            const message = `invalid dataset: .zarray formatting invalid, found array without valid shape; path [${multiscaleIndex}/${array.path}]`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const shapeIndex = shape.length === 5 ? SHAPE_X_DIM_INDEX + 1 : SHAPE_X_DIM_INDEX;
        return shape[shapeIndex];
    }

    /** Private function that retrieves the Y value from the `shape` of a given array, within a
     * specific multiscale representation of the data.
     */
    #getShapeY(array: OmeZarrArrayMetadata, multiscaleIndex: number): number {
        const shape = array.shape;
        if (!shape || shape.length < 4) {
            const message = `invalid dataset: .zarray formatting invalid, found array without valid shape; path [${multiscaleIndex}/${array.path}]`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const shapeIndex = shape.length === 5 ? SHAPE_Y_DIM_INDEX + 1 : SHAPE_Y_DIM_INDEX;
        return shape[shapeIndex];
    }

    /** Private function that retrieves the Z value from the `shape` of a given array, within a
     * specific multiscale representation of the data.
     */
    #getShapeZ(array: OmeZarrArrayMetadata, multiscaleIndex: number): number {
        const shape = array.shape;
        if (!shape || shape.length < 4) {
            const message = `invalid dataset: .zarray formatting invalid, found array without valid shape; path [${multiscaleIndex}/${array.path}]`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        // This checks to see if the shape provided has all 5 official OME-Zarr dimensions (t, c, z, y, x),
        // or just the 4 that we typically have in our data files (c, z, y, x)
        const shapeIndex = shape.length === 5 ? SHAPE_Z_DIM_INDEX + 1 : SHAPE_Z_DIM_INDEX;
        return shape[shapeIndex];
    }

    /** Private function to retrieve the maximum value for a given shape element, e.g.
     * the maximum value of one of the dimensions (t, c, z, y, x). It compares across all
     * the values of that dimension for all zarrays/datasets within a given multiscale
     * representation of the data.
     *
     * Note: Typically, we only receive the last 4 elements in the `shape` of a zarray.
     *
     * @param getShapeElement a function that retrieves one element from the `shape` of
     * a zarray
     * @returns the maxium value of that element across all arrays within the given
     * multiscale representation
     */
    #getShapeElementMax(
        getShapeElement: (a: OmeZarrArrayMetadata, multiscaleIndex: number) => number,
        multiscale?: number | string,
    ): number {
        const multiscaleIndex = this.#getValidMultiscaleIndex(multiscale);
        return this.#attrs.multiscales[multiscaleIndex].datasets
            .map((dataset) => {
                const array = this.#arrays.find((a) => a.path === dataset.path);
                if (!array) {
                    const message = `invalid dataset: .zarray missing for dataset [${multiscaleIndex}/${dataset.path}]`;
                    logger.error(message);
                    throw new VisZarrDataError(message);
                }
                return getShapeElement(array, multiscaleIndex);
            })
            .reduce((prev, curr) => Math.max(prev, curr));
    }

    /**
     * Given a specific @param multiscale representation of the Zarr data, finds the
     * largest X shape component among the shapes of the different dataset arrays.
     * @param multiscale the index or path of a specific multiscale representation (defaults to 0)
     * @returns the largest Z scale for the specified multiscale representation
     */
    maxX(multiscale: number | string = 0): number {
        return this.#getShapeElementMax(this.#getShapeX, multiscale);
    }

    /**
     * Given a specific @param multiscale representation of the Zarr data, finds the
     * largest Y shape component among the shapes of the different dataset arrays.
     * @param multiscale the index or path of a specific multiscale representation (defaults to 0)
     * @returns the largest Z scale for the specified multiscale representation
     */
    maxY(multiscale: number | string = 0): number {
        return this.#getShapeElementMax(this.#getShapeY, multiscale);
    }

    /**
     * Given a specific @param multiscale representation of the Zarr data, finds the
     * largest Z shape component among the shapes of the different dataset arrays.
     * @param multiscale the index or path of a specific multiscale representation (defaults to 0)
     * @returns the largest Z scale for the specified multiscale representation
     */
    maxZ(multiscale: number | string = 0): number {
        return this.#getShapeElementMax(this.#getShapeZ, multiscale);
    }

    maxOrthogonal(plane: CartesianPlane, multiscale: number | string = 0): number {
        if (plane.ortho === 'x') {
            return this.maxX(multiscale);
        }
        if (plane.ortho === 'y') {
            return this.maxY(multiscale);
        }
        if (plane.ortho === 'z') {
            return this.maxZ(multiscale);
        }
        throw new VisZarrDataError(`invalid plane: ortho set to '${plane.ortho}'`);
    }

    #makeShapedDataset(dataset: OmeZarrDataset, multiscaleIndex: number, datasetIndex: number) {
        const array = this.#arrays.find((a) => a.path === dataset.path);
        if (!array) {
            const message = `invalid dataset: .zarray missing for dataset [${multiscaleIndex}][${datasetIndex}]`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        return {
            ...dataset,
            shape: array.shape,
            multiscaleIndex,
            datasetIndex,
        };
    }

    getShapedDataset(indexOrPath: number | string, multiscale: number | string = 0): OmeZarrShapedDataset | undefined {
        try {
            const multiscaleIndex = this.#getValidMultiscaleIndex(multiscale);
            const datasetIndex = this.#getValidDatasetIndex(indexOrPath, multiscaleIndex);
            const dataset = this.#attrs.multiscales[multiscaleIndex].datasets[datasetIndex];
            return this.#makeShapedDataset(dataset, multiscaleIndex, datasetIndex);
        } catch (e) {
            if (e instanceof VisZarrIndexError) {
                logger.debug('encountered index error when retrieving shaped dataset; returning undefined');
                return undefined;
            }
            throw e;
        }
    }

    getFirstShapedDataset(multiscale: number | string = 0): OmeZarrShapedDataset | undefined {
        let multiscaleIndex: number;
        try {
            multiscaleIndex = this.#getValidMultiscaleIndex(multiscale);
            const dataset = this.#attrs.multiscales[multiscaleIndex].datasets[0];
            return this.#makeShapedDataset(dataset, multiscaleIndex, 0);
        } catch (e) {
            if (e instanceof VisZarrIndexError) {
                logger.debug('encountered index error when retrieving shaped dataset; returning undefined');
                return undefined;
            }
            throw e;
        }
    }

    getLastShapedDataset(multiscale: number | string = 0): OmeZarrShapedDataset | undefined {
        let multiscaleIndex: number;
        try {
            multiscaleIndex = this.#getValidMultiscaleIndex(multiscale);
            const datasets = this.#attrs.multiscales[multiscaleIndex].datasets;
            const dataset = datasets[datasets.length - 1];
            return this.#makeShapedDataset(dataset, multiscaleIndex, 0);
        } catch (e) {
            if (e instanceof VisZarrIndexError) {
                logger.debug('encountered index error when retrieving shaped dataset; returning undefined');
                return undefined;
            }
            throw e;
        }
    }
    getNumLayers(multiscale: number | string = 0) {
        const multiscaleIndex = this.#getValidMultiscaleIndex(multiscale);
        return this.#attrs.multiscales[multiscaleIndex].datasets.length;
    }
    getAllShapedDatasets(multiscale: number | string = 0): OmeZarrShapedDataset[] {
        const multiscaleIndex = this.#getValidMultiscaleIndex(multiscale);
        const datasets = this.#attrs.multiscales[multiscaleIndex].datasets;
        return datasets.map((dataset, i) => this.#makeShapedDataset(dataset, multiscaleIndex, i));
    }

    dehydrate(): DehydratedOmeZarrMetadata {
        return { url: this.#url, attrs: this.#attrs, arrays: [...this.#arrays], zarrVersion: this.#zarrVersion };
    }

    static async rehydrate(dehydrated: DehydratedOmeZarrMetadata): Promise<OmeZarrMetadata> {
        const { url, attrs, arrays, zarrVersion } = dehydrated;
        return new OmeZarrMetadata(url, attrs, arrays, zarrVersion);
    }

    #getChannelByMask(colorMask: string): OmeZarrColorChannel | undefined {
        if (!this.#attrs.omero || !this.#attrs.omero.channels) {
            logger.debug(`no omero data found for color mask ${colorMask}, returning undefined`);
            return undefined;
        }
        const omeroChannel = this.#attrs.omero.channels.find((ch) => ch.color === colorMask);
        if (!omeroChannel) {
            logger.debug(`no matching omero channel found for color mask ${colorMask}, returning undefined`);
            return undefined;
        }
        return convertFromOmeroChannelToColorChannel(omeroChannel);
    }

    get colorChannels(): OmeZarrColorChannel[] {
        return this.#attrs.omero ? convertFromOmeroToColorChannels(this.#attrs.omero) : [];
    }

    get redChannel(): OmeZarrColorChannel | undefined {
        return this.#getChannelByMask('#FF0000');
    }

    get greenChannel(): OmeZarrColorChannel | undefined {
        return this.#getChannelByMask('#00FF00');
    }

    get blueChannel(): OmeZarrColorChannel | undefined {
        return this.#getChannelByMask('#0000FF');
    }
}
