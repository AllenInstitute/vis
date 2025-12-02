---
editUrl: false
next: false
prev: false
title: "planeSizeInVoxels"
---

> **planeSizeInVoxels**(`plane`, `axes`, `dataset`): `vec2` \| `undefined`

Defined in: [packages/omezarr/src/zarr/loading.ts:281](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/loading.ts#L281)

**`Function`**

get the size of a plane of a volume (given a specific layer) in voxels
see  sizeInVoxels

## Parameters

### plane

`CartesianPlane`

the plane to measure (eg. 'xy')

### axes

readonly [`OmeZarrAxis`](/vis/api/omezarr/src/type-aliases/omezarraxis/)[]

the axes metadata of an omezarr object

### dataset

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)

a layer of the ome-zarr resolution pyramid

## Returns

`vec2` \| `undefined`

a vec2 containing the requested sizes, or undefined if the requested plane is malformed, or not present in the dataset
