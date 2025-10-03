import * as zarr from 'zarrita';
import { z } from 'zod';
import { OmeZarrArrayMetadata, OmeZarrAttrs, OmeZarrAttrsSchema, OmeZarrMetadata } from './types';
import { CachingMultithreadedFetchStore } from "./cached-loading/store";
import { logger } from '@alleninstitute/vis-core';

export class OmeZarrFileset {
    #store: CachingMultithreadedFetchStore;
    #root: zarr.Location<CachingMultithreadedFetchStore>;
    #rootAttrs: OmeZarrAttrs | undefined;
    #arrayAttrs: Map<string, OmeZarrArrayMetadata>

    constructor(url: string | URL) {
        this.#store = new CachingMultithreadedFetchStore(url);
        this.#root = zarr.root(this.#store);
    }

    async #loadRootAttrs(store: zarr.FetchStore): Promise<OmeZarrAttrs> {
        const group = await zarr.open(store, { kind: 'group' });
        try {
            return OmeZarrAttrsSchema.parse(group.attrs);
        } catch (e) {
            if (e instanceof z.ZodError) {
                logger.error('could not load Zarr file: parsing failed');
            }
            throw e;
        }
    }

    loadMetadata(): Promise<OmeZarrMetadata> {
        
    }
}