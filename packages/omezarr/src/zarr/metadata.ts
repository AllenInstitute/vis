import { logger } from '@alleninstitute/vis-core';
import { Box2D, type box2D, type CartesianPlane, Vec2, type vec2 } from '@alleninstitute/vis-geometry';
import { VisZarrDataError } from '../errors';
import { OmeZarrLevel } from './level';
import {
    convertFromOmeroToColorChannels,
    type OmeZarrArray,
    type OmeZarrColorChannel,
    type OmeZarrDataset,
    type OmeZarrGroup,
    type OmeZarrGroupAttributes,
    type OmeZarrMultiscale,
    type ZarrDimension,
} from './types';

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

/**
 * An `OmeZarrFileset` represents the metadata describing a full fileset for a given OME-Zarr.
 * It provides access to all of the metadata information available about that fileset, and
 * makes it easy to access a particular level-of-detail's full contextual information 
 * (provided as instances of the `OmeZarrLevel` class).
 * 
 * `OmeZarrFileset`s are possible to construct given raw data, but they are generally produced
 * via the `loadMetadata` function of the `OmeZarrConnection` type. Connections have a close
 * relationship with the Fileset objects, and are able to load both metadata and the associated
 * data for a given OME-Zarr.
 * 
 * @see OmeZarrLevel
 * @see OmeZarrConnection
 */
export class OmeZarrMetadata {
    #url: URL;
    #rootGroup: OmeZarrGroup;
    #arrays: Record<string, OmeZarrArray>;

    constructor(url: URL, rootGroup: OmeZarrGroup, arrays: Record<string, OmeZarrArray>) {
        this.#url = url;
        this.#rootGroup = rootGroup;
        this.#arrays = arrays;
    }

    get url(): URL {
        return this.#url;
    }

    get attrs(): OmeZarrGroupAttributes {
        return this.#rootGroup.attributes;
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
        const array = this.#arrays[`/${path}`]; // TODO this is a short-term fix, a more ideal fix would calculate the path from the array's group
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
                const array = arrays[`/${path}`];
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
        return {
            url: this.#url,
            root: this.#rootGroup,
            arrays: this.#arrays,
        };
    }

    /**
     * Given a region of a volume to view at a certain output resolution, find the level-of-detail (LOD) in the ome-zarr
     * fileset which is most appropriate - that is to say, as close to 1:1 relation between voxels and display pixels as possible.
     * @param plane a plane in the volume - the dimensions of this plane will be matched to the displayResolution
     * when choosing an appropriate LOD layer
     * @param relativeView a region of the selected plane which is the "screen" - the screen has resolution `displayResolution`.
     * An example relative view of `[0, 0], [1, 1]` would suggest we're trying to view the entire slice at the given resolution.
     * @param displayResolution
     * @param multiscaleSpec an optional specification of which multiscale to pick within (will default to the first defined)
     * @returns an LOD level from the given dataset, that is appropriate for viewing at the given displayResolution.
     */
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
        multiscaleSpec?: OmeZarrMultiscaleSpecifier | undefined
    ) {
        // figure out what layer we'd be viewing
        const level = this.pickBestScale(plane, relativeView, displayResolution, multiscaleSpec);
        const slices = level.sizeInVoxels(plane.ortho);
        return slices === undefined ? undefined : 1 / slices;
    }

    #getDimensionIndex(dim: ZarrDimension, multiscaleSpec: OmeZarrMultiscaleSpecifier | undefined): number | undefined {
        const multiscale = this.getMultiscale(multiscaleSpec);
        if (multiscale === undefined) {
            return undefined;
        }
        const index = multiscale.axes.findIndex((a) => a.name === dim);
        return index > -1 ? index : undefined;
    }

    #getMaximumForDimension(dim: ZarrDimension, multiscaleSpec: OmeZarrMultiscaleSpecifier | undefined): number {
        const multiscale = this.getMultiscale(multiscaleSpec);
        if (multiscale === undefined) {
            const message = `cannot get maximum ${dim}: no matching multiscale found`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }

        const arrays = multiscale.datasets.map((d) => this.#arrays[d.path]);
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
     * Given a specific multiscale representation of the Zarr data, finds the largest X shape component 
     * among the shapes of the different dataset arrays.
     * @param multiscaleSpec the index or path of a specific multiscale representation (defaults to 0)
     * @returns the largest Z scale for the specified multiscale representation
     */
    maxX(multiscaleSpec?: OmeZarrMultiscaleSpecifier | undefined): number {
        return this.#getMaximumForDimension('x', multiscaleSpec);
    }

    /**
     * Given a specific multiscale representation of the Zarr data, finds the largest Y shape component 
     * among the shapes of the different dataset arrays.
     * @param multiscaleSpec the index or path of a specific multiscale representation (defaults to 0)
     * @returns the largest Z scale for the specified multiscale representation
     */
    maxY(multiscaleSpec?: OmeZarrMultiscaleSpecifier | undefined): number {
        return this.#getMaximumForDimension('y', multiscaleSpec);
    }

    /**
     * Given a specific multiscale representation of the Zarr data, finds the largest Z shape component 
     * among the shapes of the different dataset arrays.
     * @param multiscaleSpec the index or path of a specific multiscale representation (defaults to 0)
     * @returns the largest Z scale for the specified multiscale representation
     */
    maxZ(multiscaleSpec?: OmeZarrMultiscaleSpecifier | undefined): number {
        return this.#getMaximumForDimension('z', multiscaleSpec);
    }

    /**
     * Given a specific plane and multiscale, determines the maximum value of the orthogonal axis to 
     * that plane within that multiscale.
     * @param plane a cartesian plane
     * @param multiscaleSpec identifies the multiscale to operate within
     * @returns the maximum value of the axis orthogonal to `plane`
     */
    maxOrthogonal(plane: CartesianPlane, multiscaleSpec?: OmeZarrMultiscaleSpecifier | undefined): number {
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
}
