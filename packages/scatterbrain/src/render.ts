import * as REGL from 'regl'
import { ReglCacheEntry, type Renderer } from '@alleninstitute/vis-core'
import { ScatterbrainDataset, SlideviewScatterbrainDataset } from './types'
// lets get a renderer up and rolling
// then add features from there...



type Settings = {}
type Item = {}
type ScatterbrainRenderer = Renderer<ScatterbrainDataset | SlideviewScatterbrainDataset, Item, Settings, {}>
function buildScatterbrainRenderer(regl: REGL.Regl): ScatterbrainRenderer {

    return {
        getVisibleItems: function (data: ScatterbrainDataset, settings: Settings): Item[] {

        },
        fetchItemContent: function (item: Item, dataset: ScatterbrainDataset, settings: Settings): Record<string, (signal: AbortSignal) => Promise<ReglCacheEntry>> {
            throw new Error('Function not implemented.')
        },
        isPrepared: function (cacheData: Record<string, ReglCacheEntry | undefined>): cacheData is {} {
            throw new Error('Function not implemented.')
        },
        renderItem: function (target: REGL.Framebuffer2D | null, item: Item, data: ScatterbrainDataset, settings: Settings, gpuData: {}): void {
            throw new Error('Function not implemented.')
        },
        cacheKey: function (item: Item, requestKey: string, data: ScatterbrainDataset, settings: Settings): string {
            throw new Error('Function not implemented.')
        },
        destroy: function (regl: REGL.Regl): void {
            throw new Error('Function not implemented.')
        }
    }

}