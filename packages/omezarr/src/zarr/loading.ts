import { getResourceUrl, logger, type WebResource } from '@alleninstitute/vis-core';
import { limit, type Interval } from '@alleninstitute/vis-geometry';
import * as zarr from 'zarrita';
import { z } from 'zod';
import { ZarrFetchStore } from './cached-loading/store';
import { OmeZarrFileset, type OmeZarrLevelSpecifier } from './fileset';
import {
    type OmeZarrArray,
    OmeZarrArrayTransform,
    type OmeZarrAxis,
    type OmeZarrData,
    type OmeZarrGroup,
    OmeZarrGroupTransform,
    type ZarrDimension,
} from './types';
import { VisZarrDataError } from '../errors';

// Documentation for OME-Zarr datasets (from which these types are built)
// can be found here:
// - top-level metadata: https://ngff.openmicroscopy.org/latest/#multiscale-md
// - array metadata: v2: https://zarr-specs.readthedocs.io/en/latest/v2/v2.0.html#arrays
//                   v3: https://zarr-specs.readthedocs.io/en/latest/v3/core/v3.0.html#array-metadata

type OmeZarrGroupLoadSet<T extends zarr.FetchStore> = {
    raw: zarr.Group<T>;
    transformed: OmeZarrGroup;
};

type OmeZarrArrayLoadSet<T extends zarr.FetchStore> = {
    raw: zarr.Array<zarr.DataType, T>;
    transformed: OmeZarrArray;
};

const loadGroup = async (location: zarr.Location<ZarrFetchStore>): Promise<OmeZarrGroupLoadSet<ZarrFetchStore>> => {
    const group = await zarr.open(location, { kind: 'group' });
    try {
        return { raw: group, transformed: OmeZarrGroupTransform.parse(group.attrs) };
    } catch (e) {
        if (e instanceof z.ZodError) {
            logger.error('could not load Zarr group metadata: parsing failed');
        }
        throw e;
    }
};

const loadArray = async (location: zarr.Location<ZarrFetchStore>): Promise<OmeZarrArrayLoadSet<ZarrFetchStore>> => {
    const array = await zarr.open(location, { kind: 'array' });
    try {
        return { raw: array, transformed: OmeZarrArrayTransform.parse(array) };
    } catch (e) {
        if (e instanceof z.ZodError) {
            logger.error('could not load Zarr array metadata: parsing failed');
        }
        throw e;
    }
};

export type ZarrDimensionSelection = number | Interval | null;

export type ZarrSlice = Record<ZarrDimension, ZarrDimensionSelection>;

type ZarritaSelection = (number | zarr.Slice | null)[];

export interface ZarritaOmeZarrData<T extends zarr.DataType> extends OmeZarrData<zarr.Chunk<T>> {
    buffer: zarr.Chunk<T>;
};

export type ZarrDataSpecifier = {
    level: OmeZarrLevelSpecifier;
    slice: ZarrSlice;
};

const buildSliceQuery = (
    r: Readonly<ZarrSlice>,
    axes: readonly OmeZarrAxis[],
    shape: readonly number[],
): ZarritaSelection => {
    const ordered = axes.map((a) => r[a.name as ZarrDimension]);

    if (ordered.some((a) => a === undefined)) {
        throw new VisZarrDataError('requested slice does not match specified dimensions of OME-Zarr dataset');
    }

    return ordered.map((d, i) => {
        const bounds = { min: 0, max: shape[i] };
        if (d === null) {
            return d;
        }
        if (typeof d === 'number') {
            return limit(bounds, d);
        }
        return zarr.slice(limit(bounds, d.min), limit(bounds, d.max));
    });
};

export type LoadOmeZarrMetadataOptions = {
    numWorkers?: number | undefined;
};

export interface OmeZarrConnection {
    url: URL;
    loadMetadata: () => Promise<OmeZarrFileset>;
    loadData: <T extends zarr.DataType>(
        spec: ZarrDataSpecifier,
        signal?: AbortSignal | undefined,
    ) => Promise<ZarritaOmeZarrData<T>>;
}

export class CachedOmeZarrConnection implements OmeZarrConnection {
    #res: WebResource;
    #store: ZarrFetchStore;
    #root: zarr.Location<ZarrFetchStore>;
    #zarritaGroups: Map<string, zarr.Group<zarr.FetchStore>>;
    #zarritaArrays: Map<string, zarr.Array<zarr.DataType, zarr.FetchStore>>;
    #fileset: OmeZarrFileset | null;

    constructor(res: WebResource, workerModule: URL, options?: LoadOmeZarrMetadataOptions | undefined) {
        this.#res = res;
        const url = getResourceUrl(res);
        this.#store = new ZarrFetchStore(url, workerModule, { numWorkers: options?.numWorkers });
        this.#root = zarr.root(this.#store);
        this.#zarritaGroups = new Map<string, zarr.Group<ZarrFetchStore>>();
        this.#zarritaArrays = new Map<string, zarr.Array<zarr.DataType, ZarrFetchStore>>();
        this.#fileset = null;
    }

    get url(): URL {
        return new URL(getResourceUrl(this.#res));
    }

    get fileset(): OmeZarrFileset | null {
        return this.#fileset;
    }

    async loadMetadata(): Promise<OmeZarrFileset> {
        const { raw: rawRootGroup, transformed: rootGroup } = await loadGroup(this.#root);
        this.#zarritaGroups.set('/', rawRootGroup);

        const arrayResults = await Promise.all(
            rootGroup.attributes.multiscales
                .map((multiscale) =>
                    multiscale.datasets?.map(async (dataset) => {
                        return await loadArray(this.#root.resolve(dataset.path));
                    }),
                )
                .reduce((prev, curr) => prev.concat(curr))
                .filter((arr) => arr !== undefined),
        );

        const arrays: Record<string, OmeZarrArray> = {};

        arrayResults.forEach(({ raw, transformed }) => {
            arrays[transformed.path] = transformed;
            this.#zarritaArrays.set(raw.path, raw);
        });

        this.#fileset = new OmeZarrFileset(this.url, rootGroup, arrays);
        return this.#fileset;
    }

    /**
     * Loads and returns any voxel data from this OME-Zarr that matches the requested segment of the overall fileset,
     * as defined by a multiscale, a dataset, and a chunk slice.
     * @see https://zarrita.dev/slicing.html for more details on how slicing is handled.
     * @param spec The data request, specifying the coordinates within the OME-Zarr's data from which to source voxel data
     * @param signal An optional abort signal with which to cancel this request if necessary
     * @returns the loaded slice data
     */
    async loadData(
        spec: ZarrDataSpecifier,
        signal?: AbortSignal | undefined,
    ): Promise<ZarritaOmeZarrData<zarr.DataType>> {
        if (this.#fileset === null) {
            throw new VisZarrDataError('cannot load array data until metadata has been loaded; please call loadMetadata() first');
        }
        const axes = this.#fileset.getMultiscale(spec.level.multiscale)?.axes;
        if (axes === undefined) {
            const message = 'invalid Zarr data: no axes found for specified multiscale';
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const path = this.#fileset.getLevel(spec.level)?.path;
        if (path === undefined) {
            const message = 'invalid Zarr data: no path found for specified dataset';
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const arr = this.#zarritaArrays.get(`/${path}`);
        if (arr === undefined) {
            const message = 'invalid Zarr data: no array found for specified dataset';
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const shape = arr.shape;
        const query = buildSliceQuery(spec.slice, axes, shape);
        const result = await zarr.get(arr, query, { opts: { signal: signal ?? null } });
        if (typeof result === 'number') {
            const message = "could not fetch Zarr slice: parsed slice data's shape was undefined";
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        return {
            shape: result.shape,
            buffer: result,
        };
    }
}
