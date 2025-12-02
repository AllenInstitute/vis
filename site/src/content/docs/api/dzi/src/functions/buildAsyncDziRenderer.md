---
editUrl: false
next: false
prev: false
title: "buildAsyncDziRenderer"
---

> **buildAsyncDziRenderer**(`regl`): (`data`, `settings`, `callback`, `target`, `cache`) => `_FrameLifecycle1`

Defined in: [packages/dzi/src/renderer.ts:89](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/dzi/src/renderer.ts#L89)

## Parameters

### regl

`Regl`

a valid REGL context (https://github.com/regl-project/regl)

## Returns

a function which creates a "Frame" of actions. each action represents loading
and subsequently rendering a tile of the image as requested via its configuration -

> (`data`, `settings`, `callback`, `target`, `cache`): `_FrameLifecycle1`

### Parameters

#### data

[`DziImage`](/vis/api/dzi/src/type-aliases/dziimage/)

#### settings

[`DziRenderSettings`](/vis/api/dzi/src/type-aliases/dzirendersettings/)

#### callback

`_RenderCallback1`\<[`DziImage`](/vis/api/dzi/src/type-aliases/dziimage/), [`DziTile`](/vis/api/dzi/src/type-aliases/dzitile/)\>

#### target

`Framebuffer2D` | `null`

#### cache

`AsyncDataCache`\<`string`, `string`, `ReglCacheEntry`\>

### Returns

`_FrameLifecycle1`

## See

RenderSettings
