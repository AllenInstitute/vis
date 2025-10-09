import { logger, type WebResource, WorkerPool } from '@alleninstitute/vis-core';
import {
    Box2D,
    type box2D,
    type CartesianPlane,
    type Interval,
    limit,
    Vec2,
    type vec2,
} from '@alleninstitute/vis-geometry';
import * as zarr from 'zarrita';
import { z } from 'zod';
import { VisZarrDataError } from '../errors';
import { CachingMultithreadedFetchStore } from './cached-loading/store';
import { OmeZarrArrayTransform, OmeZarrGroupTransform } from './omezarr-transforms';
import {
    convertFromOmeroToColorChannels,
    type OmeZarrArray,
    type OmeZarrAxis,
    type OmeZarrColorChannel,
    type OmeZarrDataset,
    type OmeZarrGroup,
    type OmeZarrGroupAttributes,
    type OmeZarrMultiscale,
    type ZarrDimension,
} from './types';
import { OmeZarrLevel } from './omezarr-level';

const WORKER_MODULE_URL = new URL('./cached-loading/fetch-slice.worker.ts', import.meta.url);
const NUM_WORKERS = 8;

export type ZarrDimensionSelection = number | Interval | null;

export type ZarrSelection = (number | zarr.Slice | null)[];

export type ZarrSlice = Record<ZarrDimension, ZarrDimensionSelection>;

export type OmeZarrFieldsetJsonOptions = {
    readable?: boolean | undefined;
    spaces?: number | undefined;
};

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

export type OmeZarrMultiscaleSpecifier =
    | {
          index: number;
      }
    | {
          name: string;
      };

export type OmeZarrLevelSpecifier = {
    multiscale?: string | undefined;
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

    getMultiscale(specifier: OmeZarrMultiscaleSpecifier): OmeZarrMultiscale | undefined {
        if (!this.ready) {
            const message = 'cannot get multiscale: OME-Zarr metadata not yet loaded';
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        const multiscales = this.#rootGroup?.attributes.multiscales;
        if (multiscales === undefined) {
            const message = 'cannot get multiscale: no multiscales found';
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        return 'index' in specifier ? multiscales[specifier.index] : multiscales.find((m) => m.name === specifier.name);
    }

    getLevel(specifier: OmeZarrLevelSpecifier): OmeZarrLevel | undefined {
        if (this.#rootGroup === undefined) {
            return;
        }
        const multiscales = this.#rootGroup?.attributes.multiscales ?? [];
        const selectedMultiscales = multiscales.filter((m) =>
            specifier.multiscale ? m.name === specifier.multiscale : true,
        );

        let matching: { path: string; multiscale: OmeZarrMultiscale; dataset: OmeZarrDataset; datasetIndex: number }[];

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
        return new OmeZarrLevel(path, multiscale, dataset, datasetIndex, array);
    }

    getLevels(): Iterable<OmeZarrLevel> {
        const multiscales = this.#rootGroup?.attributes.multiscales ?? [];
        const arrays = this.#arrays;

        return {
            *[Symbol.iterator]() {
                for (const multiscale of multiscales) {
                    let i = 0;
                    for (const dataset of multiscale.datasets) {
                        const path = dataset.path;
                        const array = arrays.get(path);
                        if (array === undefined) {
                            return;
                        }
                        yield new OmeZarrLevel(path, multiscale, dataset, i, array);
                        i += 1;
                    }
                }
            },
        };
    }

    getColorChannels(): OmeZarrColorChannel[] {
        const omero = this.#rootGroup?.attributes.omero;
        return omero ? convertFromOmeroToColorChannels(omero) : [];
    }

    toJSON() {
        const rootGroup = this.#zarritaGroups.get(this.#root.path);
        return rootGroup ? { url: this.#root.path, ready: true, rootGroup } : { url: this.#root.path, ready: false };
    }

    pickBestScale(
        plane: CartesianPlane,
        relativeView: box2D, // a box in data-unit-space
        displayResolution: vec2, // in the plane given above
        multiscaleName?: string | undefined,
    ): OmeZarrLevel {
        if (!this.ready) {
            const message = 'cannot pick best-fitting scale: OME-Zarr metadata not yet loaded';
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        const level = this.getLevel({ index: 0, multiscale: multiscaleName });
        if (!level) {
            const message = 'cannot pick best-fitting scale: no initial dataset context found';
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        const realSize = level.sizeInUnits(plane);
        if (!realSize) {
            const message = 'invalid Zarr data: could not determine the size of the plane in the given units';
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        const vxlPitch = (size: vec2) => Vec2.div(realSize, size);

        // size, in dataspace, of a pixel 1/res
        const pxPitch = Vec2.div(Box2D.size(relativeView), displayResolution);
        const dstToDesired = (a: vec2, goal: vec2) => {
            const diff = Vec2.sub(a, goal);
            if (diff[0] * diff[1] > 0) {
                // the res (a) is higher than our goal -
                // weight this heavily to prefer smaller than the goal
                return 1000 * Vec2.length(Vec2.sub(a, goal));
            }
            return Vec2.length(Vec2.sub(a, goal));
        };

        const dataContexts = Array.from(this.getLevels());

        // per the OME-Zarr spec, datasets/levels are ordered by scale
        const choice = dataContexts.reduce((bestSoFar, cur) => {
            const planeSizeBest = bestSoFar.planeSizeInVoxels(plane);
            const planeSizeCur = cur.planeSizeInVoxels(plane);
            if (!planeSizeBest || !planeSizeCur) {
                return bestSoFar;
            }
            return dstToDesired(vxlPitch(planeSizeBest), pxPitch) > dstToDesired(vxlPitch(planeSizeCur), pxPitch)
                ? cur
                : bestSoFar;
        }, dataContexts[0]);
        return choice ?? dataContexts[dataContexts.length - 1];
    }

    nextSliceStep(
        plane: CartesianPlane,
        relativeView: box2D, // a box in data-unit-space
        displayResolution: vec2, // in the plane given above
    ) {
        if (!this.ready) {
            const message = 'cannot pick best-fitting scale: OME-Zarr metadata not yet loaded';
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        // figure out what layer we'd be viewing
        const level = this.pickBestScale(plane, relativeView, displayResolution);
        const slices = level.sizeInVoxels(plane.ortho);
        return slices === undefined ? undefined : 1 / slices;
    }

    #getDimensionIndex(dim: ZarrDimension, multiscaleSpec: OmeZarrMultiscaleSpecifier): number | undefined {
        if (!this.ready) {
            return undefined;
        }
        const multiscale = this.getMultiscale(multiscaleSpec);
        if (multiscale === undefined) {
            return undefined;
        }
        const index = multiscale.axes.findIndex((a) => a.name === dim);
        return index > -1 ? index : undefined;
    }

    #getMaximumForDimension(dim: ZarrDimension, multiscaleSpec: OmeZarrMultiscaleSpecifier): number {
        const multiscale = this.getMultiscale(multiscaleSpec);
        if (multiscale === undefined) {
            const message = `cannot get maximum ${dim}: no matching multiscale found`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        const arrays = multiscale.datasets.map((d) => this.#arrays.get(d.path));
        const dimIdx = this.#getDimensionIndex(dim, multiscaleSpec);
        if (dimIdx === undefined) {
            const message = `cannot get maximum ${dim}: '${dim}' is not a valid dimension for this multiscale`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const sortedValues = arrays.map((arr) => arr?.shape[dimIdx] ?? 0).sort();
        return sortedValues.at(sortedValues.length - 1) ?? 0;
    }

    /**
     * Given a specific @param multiscaleIdent representation of the Zarr data, finds the
     * largest X shape component among the shapes of the different dataset arrays.
     * @param multiscaleIdent the index or path of a specific multiscale representation (defaults to 0)
     * @returns the largest Z scale for the specified multiscale representation
     */
    maxX(multiscaleSpec: OmeZarrMultiscaleSpecifier): number {
        return this.#getMaximumForDimension('x', multiscaleSpec);
    }

    /**
     * Given a specific @param multiscale representation of the Zarr data, finds the
     * largest Y shape component among the shapes of the different dataset arrays.
     * @param multiscale the index or path of a specific multiscale representation (defaults to 0)
     * @returns the largest Z scale for the specified multiscale representation
     */
    maxY(multiscaleSpec: OmeZarrMultiscaleSpecifier): number {
        return this.#getMaximumForDimension('y', multiscaleSpec);
    }

    /**
     * Given a specific @param multiscale representation of the Zarr data, finds the
     * largest Z shape component among the shapes of the different dataset arrays.
     * @param multiscale the index or path of a specific multiscale representation (defaults to 0)
     * @returns the largest Z scale for the specified multiscale representation
     */
    maxZ(multiscaleSpec: OmeZarrMultiscaleSpecifier): number {
        return this.#getMaximumForDimension('z', multiscaleSpec);
    }

    maxOrthogonal(plane: CartesianPlane, multiscaleSpec: OmeZarrMultiscaleSpecifier): number {
        if (plane.ortho === 'x') {
            return this.maxX(multiscaleSpec);
        }
        if (plane.ortho === 'y') {
            return this.maxY(multiscaleSpec);
        }
        if (plane.ortho === 'z') {
            return this.maxZ(multiscaleSpec);
        }
        throw new VisZarrDataError(`invalid plane: ortho set to '${plane.ortho}'`);
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
