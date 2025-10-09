import { logger, type WebResource, WorkerPool } from '@alleninstitute/vis-core';
import { type Interval, limit } from '@alleninstitute/vis-geometry';
import * as zarr from 'zarrita';
import { z } from 'zod';
import { VisZarrDataError } from '../errors';
import { CachingMultithreadedFetchStore } from './cached-loading/store';
import { OmeZarrArrayTransform, OmeZarrGroupTransform } from './omezarr-transforms';
import type {
    OmeZarrArray,
    OmeZarrAxis,
    OmeZarrDataset,
    OmeZarrGroup,
    OmeZarrGroupAttributes,
    OmeZarrMultiscale,
    ZarrDimension,
} from './types';

const WORKER_MODULE_URL = new URL('./cached-loading/fetch-slice.worker.ts', import.meta.url);
const NUM_WORKERS = 8;

export type ZarrDimensionSelection = number | Interval | null;

export type ZarrSelection = (number | zarr.Slice | null)[];

export type ZarrSlice = Record<ZarrDimension, ZarrDimensionSelection>;

export type ZarrDataRequest = {
    multiscale?: string | undefined;
    dataset: string;
    slice: ZarrSlice;
};

export const buildSliceQuery = (
    r: Readonly<ZarrSlice>,
    axes: readonly OmeZarrAxis[],
    shape: readonly number[],
): ZarrSelection => {
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

export type OmeZarrDataContext = {
    path: string;
    multiscale: OmeZarrMultiscale;
    dataset: OmeZarrDataset;
    datasetIndex: number;
    array: OmeZarrArray;
};

export type OmeZarrDatasetSpecifier = {
    multiscale?: string;
} & (
    | {
          index: number;
      }
    | {
          path: string;
      }
);

export class OmeZarrFileset {
    #store: CachingMultithreadedFetchStore;
    #root: zarr.Location<CachingMultithreadedFetchStore>;
    #rootGroup: OmeZarrGroup | null;
    #arrays: Map<string, OmeZarrArray>;
    #zarritaGroups: Map<string, zarr.Group<zarr.FetchStore>>;
    #zarritaArrays: Map<string, zarr.Array<zarr.DataType, zarr.FetchStore>>;

    constructor(res: WebResource) {
        this.#store = new CachingMultithreadedFetchStore(res.url, new WorkerPool(NUM_WORKERS, WORKER_MODULE_URL));
        this.#root = zarr.root(this.#store);
        this.#rootGroup = null;
        this.#arrays = new Map();
        this.#zarritaGroups = new Map();
        this.#zarritaArrays = new Map();
    }

    async #loadGroup(location: zarr.Location<zarr.FetchStore>): Promise<OmeZarrGroup> {
        const group = await zarr.open(location, { kind: 'group' });
        this.#zarritaGroups.set(location.path, group);
        try {
            return OmeZarrGroupTransform.parse(group.attrs);
        } catch (e) {
            if (e instanceof z.ZodError) {
                logger.error('could not load Zarr group metadata: parsing failed');
            }
            throw e;
        }
    }

    async #loadArray(location: zarr.Location<zarr.FetchStore>): Promise<OmeZarrArray> {
        const array = await zarr.open(location, { kind: 'array' });
        this.#zarritaArrays.set(location.path, array);
        try {
            return OmeZarrArrayTransform.parse(array);
        } catch (e) {
            if (e instanceof z.ZodError) {
                logger.error('could not load Zarr array metadata: parsing failed');
            }
            throw e;
        }
    }

    async #loadRootAttrs(): Promise<OmeZarrGroup> {
        return await this.#loadGroup(this.#root);
    }

    async loadMetadata() {
        if (this.#rootGroup !== null) {
            logger.warn('attempted to load the same OME-Zarr fileset after it was already loaded');
            return;
        }
        this.#rootGroup = await this.#loadRootAttrs();

        const arrayResults = await Promise.all(
            this.#rootGroup.attributes.multiscales
                .map((multiscale) =>
                    multiscale.datasets?.map(async (dataset) => {
                        return await this.#loadArray(this.#root.resolve(dataset.path));
                    }),
                )
                .reduce((prev, curr) => prev.concat(curr))
                .filter((arr) => arr !== undefined),
        );

        arrayResults.forEach((arr) => {
            this.#arrays.set(arr.path, arr);
        });
    }

    get ready(): boolean {
        return this.#rootGroup !== null;
    }

    get url(): string | URL {
        return this.#store.url;
    }

    get attrs(): OmeZarrGroupAttributes | undefined {
        return this.#rootGroup?.attributes;
    }

    getAxes(multiscaleName: string | undefined): OmeZarrAxis[] | undefined {
        if (this.#rootGroup === null || this.#rootGroup.attributes.multiscales.length < 1) {
            const message =
                'cannot request multiscale axes: OME-Zarr fileset has no multiscale data (it may not have been loaded yet)';
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const multiscales = this.#rootGroup.attributes.multiscales;
        const multiscale =
            multiscaleName === undefined ? multiscales[0] : multiscales.find((v) => v.name === multiscaleName);
        return multiscale?.axes;
    }

    getDataContexts(): Iterable<OmeZarrDataContext> {
        const multiscales = this.#rootGroup?.attributes.multiscales ?? [];
        const arrays = this.#arrays;

        return {
            *[Symbol.iterator]() {
                for (const multiscale of multiscales) {
                    for (const dataset of multiscale.datasets) {
                        const path = dataset.path;
                        const array = arrays.get(path);
                        if (array === undefined) {
                            return;
                        }
                        yield { path, multiscale, dataset, array } as OmeZarrDataContext;
                    }
                }
            },
        };
    }

    getDataContext(specifier: OmeZarrDatasetSpecifier): OmeZarrDataContext | undefined {
        if (this.#rootGroup === undefined) {
            return;
        }
        const multiscales = this.#rootGroup?.attributes.multiscales ?? [];
        const selectedMultiscales = multiscales.filter((m) =>
            specifier.multiscale ? m.name === specifier.multiscale : true,
        );

        let matching: { path: string, multiscale: OmeZarrMultiscale, dataset: OmeZarrDataset, datasetIndex: number }[];

        if ('index' in specifier) {
            const i = specifier.index;
            if (selectedMultiscales.length > 1) {
                const message = `cannot get matching dataset and array for index [${i}]: multiple multiscales specified`;
                logger.error(message);
                throw new VisZarrDataError(message);
            }
            matching = selectedMultiscales.map((m) => {
                if (i < 0 || i >= m.datasets.length) {
                    const message = `cannot get matching dataset and array for index [${i}]: index out of bounds`;
                    logger.error(message);
                    throw new VisZarrDataError(message);
                }
                const dataset = m.datasets[specifier.index];
                if (dataset === undefined) {
                    const message = `cannot get matching dataset and array for index [${i}]: dataset undefined`;
                    logger.error(message);
                    throw new VisZarrDataError(message);
                }
                return { path: dataset.path, datasetIndex: i, multiscale: m, dataset };
            });

            if (matching.length > 1) {
                const message = `cannot get matching dataset and array for index [${i}]: multiple matching datasets found`;
                logger.error(message);
                throw new VisZarrDataError(message);
            }

        } else {
            const path = specifier.path;
            matching = selectedMultiscales.map((m) => {
                const datasets = m.datasets.filter((d) => d.path === path);
                if (datasets.length > 1) {
                    const message = `cannot get matching dataset and array for path [${path}]: multiple matching datasets found`;
                    logger.error(message);
                    throw new VisZarrDataError(message);
                }
                const dataset = datasets[0];
                if (dataset === undefined) {
                    const message = `cannot get matching dataset and array for path [${path}]: dataset was undefined`;
                    logger.error(message);
                    throw new VisZarrDataError(message);
                }
                const datasetIndex = m.datasets.findIndex((d) => d.path === dataset.path);
                if (datasetIndex === -1) {
                    const message = `cannot get matching dataset and array for path [${path}]: index of matching dataset was not found`;
                    logger.error(message);
                    throw new VisZarrDataError(message);
                }
                return { path, multiscale: m, dataset, datasetIndex };
            });

            if (matching.length > 1) {
                const message = `cannot get matching dataset and array for path [${path}]: multiple matching datasets found`;
                logger.error(message);
                throw new VisZarrDataError(message);
            }
        }

        if (matching.length < 1) {
            return;
        }

        const { path, multiscale, dataset, datasetIndex } = matching[0];
        const array = this.#arrays.get(path);
        if (multiscale === undefined || dataset === undefined || array === undefined) {
            const message = `cannot get matching dataset and array for path [${path}]: one or more elements were undefined`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        return { path, multiscale, dataset, datasetIndex, array };
    }

    /**
     * Loads and returns any voxel data from this OME-Zarr that matches the requested segment of the overall fileset,
     * as defined by a multiscale, a dataset, and a chunk slice.
     * @see https://zarrita.dev/slicing.html for more details on how slicing is handled.
     * @param r The data request, specifying the coordinates within the OME-Zarr's data from which to source voxel data
     * @param signal An optional abort signal with which to cancel this request if necessary
     * @returns ....
     */
    async loadSlice(r: ZarrDataRequest, signal?: AbortSignal | undefined) {
        const axes = this.getAxes(r.multiscale);
        if (axes === undefined) {
            const message = 'invalid Zarr data: no axes found for specified multiscale';
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const arr = this.#zarritaArrays.get(r.dataset);
        if (arr === undefined) {
            const message = 'invalid Zarr data: no array found for specified dataset';
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const shape = arr.shape;
        const query = buildSliceQuery(r.slice, axes, shape);
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
