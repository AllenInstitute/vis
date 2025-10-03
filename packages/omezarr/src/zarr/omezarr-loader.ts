import { OmeZarrMetadata }
import { CachingMultithreadedFetchStore } from "./cached-loading/store";

export class OmeZarrLoader {
    #store: CachingMultithreadedFetchStore;

    constructor(url: string | URL) {
        this.#store = new CachingMultithreadedFetchStore(url);
    }

    loadMetadata(): Promise<OmeZarrMetadata> {

    }
}