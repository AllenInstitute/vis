import type { OmeZarrShapedDataset, OmeZarrMetadata } from './types';
import { type ZarrRequest, buildQuery, loadZarrArrayFileFromStore } from './loading';
import { VisZarrDataError } from '../errors';
import * as zarr from 'zarrita';
import { logger } from '@alleninstitute/vis-core';
import { ZarrFetchStore, type CachingMultithreadedFetchStoreOptions } from './cached-loading/store';

export function decoderFactory(url: string, workerModule: URL, options?: CachingMultithreadedFetchStoreOptions) {
    const store = new ZarrFetchStore(url, workerModule, options);
    const getSlice = async (
        metadata: OmeZarrMetadata,
        req: ZarrRequest,
        level: OmeZarrShapedDataset,
        signal?: AbortSignal,
    ) => {
        if (metadata.url !== url) {
            throw new Error(
                'trying to use a decoder from a different store - we cant do that yet, although we could build a map of url->stores here if we wanted later - TODO',
            );
        }
        const scene = metadata.attrs.multiscales[0];
        const { axes } = scene;
        if (!level) {
            const message = 'invalid Zarr data: no datasets found';
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const arr = metadata.arrays.find((a) => a.path === level.path);
        if (!arr) {
            const message = `cannot load slice: no array found for path [${level.path}]`;
            logger.error(message);
            throw new VisZarrDataError(message);
        }
        const { raw } = await loadZarrArrayFileFromStore(store, arr.path, metadata.zarrVersion, false);
        const result = await zarr.get(raw, buildQuery(req, axes, level.shape), { opts: { signal: signal ?? null } });
        if (typeof result === 'number') {
            throw new Error('oh noes, slice came back all weird');
        }
        const { shape, data } = result;
        if (typeof data !== 'object' || !('buffer' in data)) {
            throw new Error('slice was malformed, array-buffer response required');
        }
        // biome-ignore lint/suspicious/noExplicitAny: <hard to prove - but the typeof check above is sufficient for this to be safe>
        return { shape, data: new Float32Array(data as any) };

    };
    return { decoder: getSlice, destroy: () => { store.destroy(); } };
}
