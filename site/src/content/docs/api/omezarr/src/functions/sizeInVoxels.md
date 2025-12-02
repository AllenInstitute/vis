---
editUrl: false
next: false
prev: false
title: "sizeInVoxels"
---

> **sizeInVoxels**(`dim`, `axes`, `dataset`): `number` \| `undefined`

Defined in: [packages/omezarr/src/zarr/loading.ts:265](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/omezarr/src/zarr/loading.ts#L265)

get the size in voxels of a layer of an omezarr on a given dimension

## Parameters

### dim

[`ZarrDimension`](/vis/api/omezarr/src/type-aliases/zarrdimension/)

the dimension to measure

### axes

readonly [`OmeZarrAxis`](/vis/api/omezarr/src/type-aliases/omezarraxis/)[]

the axes metadata for the zarr dataset

### dataset

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)

an entry in the datasets list in the multiscales list in a ZarrDataset object

## Returns

`number` \| `undefined`

the size, in voxels, of the given dimension of the given layer

## Example

```ts
(pseudocode of course) return omezarr.multiscales[0].datasets[LAYER].shape[DIMENSION]
```
