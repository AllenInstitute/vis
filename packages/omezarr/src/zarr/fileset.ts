import { logger } from '@alleninstitute/vis-core';
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
import { VisZarrDataError } from '../errors';
import type { ZarrFetchStore } from './cached-loading/store';
import { OmeZarrLevel } from './level';
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

export type ZarrDimensionSelection = number | Interval | null;

export type ZarrSlice = Record<ZarrDimension, ZarrDimensionSelection>;

type ZarritaSelection = (number | zarr.Slice | null)[];

export type LoadedOmeZarrSlice<T extends zarr.DataType> = {
    shape: readonly number[];
    buffer: zarr.Chunk<T>;
}

export type ZarrDataRequest = {
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

export type OmeZarrMultiscaleSpecifier =
    | {
          index: number;
      }
    | {
          name: string;
      };

export type OmeZarrLevelSpecifier = {
    multiscale?: OmeZarrMultiscaleSpecifier | undefined;
} & (
    | {
          index: number;
      }
    | {
          path: string;
      }
);

export class OmeZarrFileset {
    #store: ZarrFetchStore;
    #root: zarr.Location<ZarrFetchStore>;
    #rootGroup: OmeZarrGroup;
    #arrays: Map<string, OmeZarrArray>;
    #zarritaGroups: Map<string, zarr.Group<zarr.FetchStore>>;
    #zarritaArrays: Map<string, zarr.Array<zarr.DataType, zarr.FetchStore>>;

    constructor(
        store: ZarrFetchStore,
        root: zarr.Location<ZarrFetchStore>,
        rootGroup: OmeZarrGroup,
        arrays: Map<string, OmeZarrArray>,
        zarritaGroups: Map<string, zarr.Group<zarr.FetchStore>>,
        zarritaArrays: Map<string, zarr.Array<zarr.DataType, zarr.FetchStore>>,
    ) {
        this.#store = store;
        this.#root = root;
        this.#rootGroup = rootGroup;
        this.#arrays = arrays;
        this.#zarritaGroups = zarritaGroups;
        this.#zarritaArrays = zarritaArrays;
    }

    get url(): string | URL {
        return this.#store.url;
    }

    get attrs(): OmeZarrGroupAttributes | undefined {
        return this.#rootGroup?.attributes;
    }

    getMultiscale(specifier: OmeZarrMultiscaleSpecifier | undefined): OmeZarrMultiscale | undefined {
        const multiscales = this.#rootGroup.attributes.multiscales;
        if (specifier === undefined) {
            return multiscales[0];
        }
        return 'index' in specifier ? multiscales[specifier.index] : multiscales.find((m) => m.name === specifier.name);
    }

    getLevel(specifier: OmeZarrLevelSpecifier): OmeZarrLevel | undefined {
        const targetDesc = 'index' in specifier ? `index [${specifier.index}]` : `path [${specifier.path}]`;

        const multiscale = this.getMultiscale(specifier.multiscale ?? { index: 0 });
        if (multiscale === undefined) {
            const message = `cannot get matching dataset and array for ${targetDesc}: multiple multiscales specified`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        let matching: { path: string; dataset: OmeZarrDataset; datasetIndex: number };

        if ('index' in specifier) {
            const i = specifier.index;
            // matching = selectedMultiscales.map((m) => {
            if (i < 0 || i >= multiscale.datasets.length) {
                const message = `cannot get matching dataset and array for ${targetDesc}: index out of bounds`;
                logger.error(message);
                throw new VisZarrDataError(message);
            }
            const dataset = multiscale.datasets[specifier.index];
            if (dataset === undefined) {
                const message = `cannot get matching dataset and array for index ${targetDesc}: no dataset found at that index`;
                logger.error(message);
                throw new VisZarrDataError(message);
            }
            matching = { path: dataset.path, datasetIndex: i, dataset };
        } else {
            const path = specifier.path;
            const datasetIndex = multiscale.datasets.findIndex((d) => d.path === path);
            const dataset = multiscale.datasets[datasetIndex];
            if (datasetIndex === -1 || dataset === undefined) {
                const message = `cannot get matching dataset and array for ${targetDesc}: no matching path found`;
                logger.error(message);
                throw new VisZarrDataError(message);
            }
            matching = { path, dataset, datasetIndex };
        }

        const { path, dataset, datasetIndex } = matching;
        const array = this.#arrays.get(`/${path}`); // TODO this is a short-term fix, a more ideal fix would calculate the path from the array's group
        if (array === undefined) {
            const message = `cannot get matching dataset and array for ${targetDesc}: no matching array found`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        return new OmeZarrLevel(path, multiscale, dataset, datasetIndex, array);
    }

    getLevels(): OmeZarrLevel[] {
        const multiscales = this.#rootGroup?.attributes.multiscales ?? [];
        const arrays = this.#arrays;

        const levels = [];
        for (const multiscale of multiscales) {
            let i = 0;
            for (const dataset of multiscale.datasets) {
                const path = dataset.path;
                const array = arrays.get(`/${path}`);
                if (array === undefined) {
                    const message = 'cannot get list of levels: mismatched array and dataset';
                    logger.error(message);
                    throw new VisZarrDataError(message);
                }
                levels.push(new OmeZarrLevel(path, multiscale, dataset, i, array));
                i += 1;
            }
        }
        return levels;
    }

    getNumLevels(multiscaleSpec?: OmeZarrMultiscaleSpecifier | undefined): number {
        const multiscale = this.getMultiscale(multiscaleSpec);
        return multiscale?.datasets.length ?? 0;
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
        multiscaleSpec?: OmeZarrMultiscaleSpecifier | undefined,
    ): OmeZarrLevel {
        const level = this.getLevel({ index: 0, multiscale: multiscaleSpec });
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

        const levels = Array.from(this.getLevels());

        // per the OME-Zarr spec, datasets/levels are ordered by scale
        const choice = levels.reduce((bestSoFar, cur) => {
            const planeSizeBest = bestSoFar.planeSizeInVoxels(plane);
            const planeSizeCur = cur.planeSizeInVoxels(plane);
            if (!planeSizeBest || !planeSizeCur) {
                return bestSoFar;
            }
            return dstToDesired(vxlPitch(planeSizeBest), pxPitch) > dstToDesired(vxlPitch(planeSizeCur), pxPitch)
                ? cur
                : bestSoFar;
        }, levels[0]);
        return choice ?? levels[levels.length - 1];
    }

    nextSliceStep(
        plane: CartesianPlane,
        relativeView: box2D, // a box in data-unit-space
        displayResolution: vec2, // in the plane given above
    ) {
        // figure out what layer we'd be viewing
        const level = this.pickBestScale(plane, relativeView, displayResolution);
        const slices = level.sizeInVoxels(plane.ortho);
        return slices === undefined ? undefined : 1 / slices;
    }

    #getDimensionIndex(dim: ZarrDimension, multiscaleSpec: OmeZarrMultiscaleSpecifier): number | undefined {
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
     * @returns the loaded slice data
     */
    async loadSlice<T extends zarr.DataType>(r: ZarrDataRequest, signal?: AbortSignal | undefined): Promise<LoadedOmeZarrSlice<T>> {
        const axes = this.getMultiscale(r.level.multiscale)?.axes;
        if (axes === undefined) {
            const message = 'invalid Zarr data: no axes found for specified multiscale';
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const path = this.getLevel(r.level)?.path;
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
