import { makeOmeZarrSliceLoaderWorker } from '@alleninstitute/vis-omezarr';
// a web-worker which fetches slices of data, decodes them, and returns the result as a flat float32 array, using transferables

const ctx = self;

makeOmeZarrSliceLoaderWorker(ctx);
