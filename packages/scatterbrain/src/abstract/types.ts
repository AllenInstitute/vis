import type REGL from 'regl';

export type CachedTexture = {
    texture: REGL.Texture2D;
    bytes: number;
    type: 'texture'
}
export type CachedVertexBuffer = {
    buffer: REGL.Buffer;
    bytes: number;
    type: 'buffer'
}
export type ReglCacheEntry = CachedTexture | CachedVertexBuffer


export type Renderer<Dataset, Item, Settings, GpuData extends Record<string, ReglCacheEntry>> = {
    getVisibleItems: (data: Dataset, settings: Settings) => Array<Item>;
    isPrepared: (cacheData: Record<string, ReglCacheEntry | undefined>) => cacheData is GpuData,
    fetchItemContent: (item: Item, dataset: Dataset, settings: Settings, signal?: AbortSignal) => Record<string, () => Promise<ReglCacheEntry>>
    renderItem: (target: REGL.Framebuffer2D | null, item: Item, data: Dataset, settings: Settings, gpuData: GpuData) => void;
    cacheKey: (item: Item, requestKey: string, data: Dataset, settings: Settings) => string,
    destroy: (regl: REGL.Regl) => void;
}
