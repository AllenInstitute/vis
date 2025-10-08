import { logger, type WebResource } from '@alleninstitute/vis-core';
import * as zarr from 'zarrita';
import { z } from 'zod';
import { type OmeZarrArray, OmeZarrArrayTransform, type OmeZarrGroup, OmeZarrGroupTransform } from './types';
import { CachingMultithreadedFetchStore } from "./cached-loading/store";

// export type OmeZarrAttrsBundle = { 
//     root: OmeZarrAttrs, 
//     arrays: ReadonlyMap<string, OmeZarrArrayAttrs> 
// };

export class OmeZarrFileset {
    #store: CachingMultithreadedFetchStore;
    #root: zarr.Location<CachingMultithreadedFetchStore>;
    #rootGroup: OmeZarrGroup | null;
    #arrays: Map<string, OmeZarrArray>;

    constructor(res: WebResource) {
        this.#store = new CachingMultithreadedFetchStore(res.url);
        this.#root = zarr.root(this.#store);
        this.#rootGroup = null;
        this.#arrays = new Map();
    }

    async #loadGroup(location: zarr.FetchStore | zarr.Location<zarr.FetchStore>): Promise<OmeZarrGroup> {
        const group = await zarr.open(location, { kind: 'group' });
        try {
            return OmeZarrGroupTransform.parse(group.attrs);
        } catch (e) {
            if (e instanceof z.ZodError) {
                logger.error('could not load Zarr group metadata: parsing failed');
            }
            throw e;
        }
    }

    async #loadArray(location: zarr.FetchStore | zarr.Location<zarr.FetchStore>): Promise<OmeZarrArray> {
        const array = await zarr.open(location, { kind: 'array' });
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
                        return (await this.#loadArray(this.#root.resolve(dataset.path)))
                    })
                )
                .reduce((prev, curr) => prev.concat(curr))
                .filter((arr) => arr !== undefined),
        );
        arrayResults.forEach((arr) => {
            this.#arrays.set(arr.path, arr);
        });
    }
}