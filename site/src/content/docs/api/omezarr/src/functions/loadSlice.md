---
editUrl: false
next: false
prev: false
title: "loadSlice"
---

> **loadSlice**(`metadata`, `r`, `level`, `signal?`): `Promise`\<\{ `buffer`: `Chunk`\<`DataType`\>; `shape`: `number`[]; \}\>

Defined in: [packages/omezarr/src/zarr/loading.ts:334](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/omezarr/src/zarr/loading.ts#L334)

get voxels / pixels from a region of a layer of an omezarr dataset

## Parameters

### metadata

[`OmeZarrMetadata`](/vis/api/omezarr/src/classes/omezarrmetadata/)

a ZarrMetadata from which to request a slice of voxels

### r

[`ZarrRequest`](/vis/api/omezarr/src/type-aliases/zarrrequest/)

a slice object, describing the requested region of data - note that it is quite possible to request
data that is not "just" a slice. The semantics of this slice object should match up with conventions in numpy or other multidimensional array tools:

### level

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)

the layer within the LOD pyramid of the OME-Zarr dataset.

### signal?

`AbortSignal`

## Returns

`Promise`\<\{ `buffer`: `Chunk`\<`DataType`\>; `shape`: `number`[]; \}\>

the requested chunk of image data from the given layer of the omezarr LOD pyramid. Note that if the given layerIndex is invalid, it will be treated as though it is the highest index possible.

## See

https://zarrita.dev/slicing.html

## Throws

an error if the request results in anything of lower-or-equal dimensionality than a single value
