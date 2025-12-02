---
editUrl: false
next: false
prev: false
title: "defaultDecoder"
---

> **defaultDecoder**(`metadata`, `r`, `level`, `signal?`): `Promise`\<[`VoxelTileImage`](/vis/api/omezarr/src/type-aliases/voxeltileimage/)\>

Defined in: [packages/omezarr/src/sliceview/loader.ts:119](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/sliceview/loader.ts#L119)

a function which returns a promise of float32 data from the requested region of an omezarr dataset.
Note that omezarr decoding can be slow - consider wrapping this function in a web-worker (or a pool of them)
to improve performance (note also that the webworker message passing will need to itself be wrapped in promises)

## Parameters

### metadata

[`OmeZarrMetadata`](/vis/api/omezarr/src/classes/omezarrmetadata/)

an omezarr object

### r

[`ZarrRequest`](/vis/api/omezarr/src/type-aliases/zarrrequest/)

a slice request

### level

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)

### signal?

`AbortSignal`

## Returns

`Promise`\<[`VoxelTileImage`](/vis/api/omezarr/src/type-aliases/voxeltileimage/)\>

the requested voxel information from the given layer of the given dataset.

## See

getSlice
