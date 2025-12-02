---
editUrl: false
next: false
prev: false
title: "pickBestScale"
---

> **pickBestScale**(`zarr`, `plane`, `relativeView`, `displayResolution`): [`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)

Defined in: [packages/omezarr/src/zarr/loading.ts:136](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/loading.ts#L136)

**`Function`**

given a region of a volume to view at a certain output resolution, find the layer in the ome-zarr dataset which
is most appropriate - that is to say, as close to 1:1 relation between voxels and display pixels as possible.

## Parameters

### zarr

[`OmeZarrMetadata`](/vis/api/omezarr/src/classes/omezarrmetadata/)

an object representing an omezarr file - see  loadMetadata

### plane

`CartesianPlane`

a plane in the volume - the dimensions of this plane will be matched to the displayResolution
when choosing an appropriate LOD layer

### relativeView

`box2D`

a region of the selected plane which is the "screen" - the screen has resolution

### displayResolution

`vec2`

## Returns

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)

an LOD (level-of-detail) layer from the given dataset, that is appropriate for viewing at the given
displayResolution.
