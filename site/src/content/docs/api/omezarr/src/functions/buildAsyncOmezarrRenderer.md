---
editUrl: false
next: false
prev: false
title: "buildAsyncOmezarrRenderer"
---

> **buildAsyncOmezarrRenderer**(`regl`, `decoder`, `options?`): (`data`, `settings`, `callback`, `target`, `cache`) => `_FrameLifecycle1`

Defined in: [packages/omezarr/src/sliceview/slice-renderer.ts:182](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/omezarr/src/sliceview/slice-renderer.ts#L182)

## Parameters

### regl

`Regl`

### decoder

`Decoder`

### options?

`OmeZarrSliceRendererOptions`

## Returns

> (`data`, `settings`, `callback`, `target`, `cache`): `_FrameLifecycle1`

### Parameters

#### data

[`OmeZarrMetadata`](/vis/api/omezarr/src/classes/omezarrmetadata/)

#### settings

[`RenderSettings`](/vis/api/omezarr/src/type-aliases/rendersettings/)

#### callback

`_RenderCallback1`\<[`OmeZarrMetadata`](/vis/api/omezarr/src/classes/omezarrmetadata/), [`VoxelTile`](/vis/api/omezarr/src/type-aliases/voxeltile/)\>

#### target

`Framebuffer2D` | `null`

#### cache

`AsyncDataCache`\<`string`, `string`, `ReglCacheEntry`\>

### Returns

`_FrameLifecycle1`
