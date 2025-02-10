import type REGL from 'regl';

export type CachedTexture = {
    texture: REGL.Texture2D;
    bytes: number;
    type: 'texture';
};
export type CachedVertexBuffer = {
    buffer: REGL.Buffer;
    bytes: number;
    type: 'buffer';
};
export type ReglCacheEntry = CachedTexture | CachedVertexBuffer;

export type Renderer<Dataset, Item, Settings, GpuData extends Record<string, ReglCacheEntry>> = {
    /**
     * a function which returns items from the given dataset - this is the place to express spatial indexing
     * or any other filtering that may be appropriate
     * @param data the dataset to pull items from
     * @param settings the settings that determine what items are appropriate
     * @returns a list of the requested items, whatever they may be
     */
    getVisibleItems: (data: Dataset, settings: Settings) => Array<Item>;
    /**
     * fetch raw, expensive-to-load content (an "Item" is a placeholder for that content)
     * @param item An item to fetch content for
     * @param dataset the dataset which owns the given item
     * @param settings
     * @param signal an AbortSignal that allows the fetching of content to be cancelled
     * @returns a map of meaningful names (eg. position, color, amplitude, etc) to functions that promise raw content, like pixels or other raw, renderable information.
     * expect that the functions returned in this way have closures over the other arguments to this function -
     * that is to say, DONT mutate them (make them Readonly if possible)
     */
    fetchItemContent: (
        item: Item,
        dataset: Dataset,
        settings: Settings,
        signal?: AbortSignal,
    ) => Record<string, () => Promise<ReglCacheEntry>>;
    /**
     *
     * @param cacheData the results of fetching all the content for an Item
     * @returns true if the content matches the expectations of our rendering function
     */
    isPrepared: (cacheData: Record<string, ReglCacheEntry | undefined>) => cacheData is GpuData;
    /**
     * actually render the content of an item
     * @param target REGL framebuffer to render to (null is the canvas to which regl is bound - it is shared and mutable!)
     * @param item the item describing the content to render
     * @param data the dataset which owns the item
     * @param settings the configuration of the current rendering task
     * @param gpuData the data as fetched and uploaded to the GPU @see fetchItemContent and validated by @see isPrepared
     * @returns void - this function will render (mutate!) the content (pixels!) of the target
     */
    renderItem: (
        target: REGL.Framebuffer2D | null,
        item: Item,
        data: Dataset,
        settings: Settings,
        gpuData: GpuData,
    ) => void;
    /**
     * compute a unique (but please not random!) string that the cache system can use to identify the content
     * associated with this {item, settings, data}
     * @param item the item we're caching the data for
     * @param requestKey a key of gpuData (TODO: make this fact official via Typescript if possible)
     * @param data the dataset that owns the given item
     * @param settings the configuration of the current rendering task
     * @returns a string, suitable for use in a cache
     */
    cacheKey: (item: Item, requestKey: string, data: Dataset, settings: Settings) => string;
    /**
     * in some cases, rendering may rely on non-item-specific rendering resources (lookup tables, buffers, etc)
     * this function is the place to release those
     * @param regl the regl context (the same that was used to create this renderer)
     * @returns
     */
    destroy: (regl: REGL.Regl) => void;
};
