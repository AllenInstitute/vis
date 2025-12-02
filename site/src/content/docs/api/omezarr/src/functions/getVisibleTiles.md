---
editUrl: false
next: false
prev: false
title: "getVisibleTiles"
---

> **getVisibleTiles**(`camera`, `plane`, `planeLocation`, `metadata`, `tileSize`): [`VoxelTile`](/vis/api/omezarr/src/type-aliases/voxeltile/)[]

Defined in: [packages/omezarr/src/sliceview/loader.ts:91](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/omezarr/src/sliceview/loader.ts#L91)

Gets the list of tiles of the given OME-Zarr image which are visible (i.e. they intersect with

## Parameters

### camera

an object describing the current view: the region of the omezarr, and the resolution at which it
will be displayed.

#### screenSize

`vec2`

#### view

`box2D`

### plane

`CartesianPlane`

the plane (eg. CartesianPlane('xy')) from which to draw tiles

### planeLocation

`number`

### metadata

[`OmeZarrMetadata`](/vis/api/omezarr/src/classes/omezarrmetadata/)

the OME-Zarr image to pull tiles from

### tileSize

`number`

the size of the tiles, in pixels. It is recommended to use a size that agrees with the chunking used in the dataset; however,
other utilities in this library will stitch together chunks to satisfy the requested tile size.

## Returns

[`VoxelTile`](/vis/api/omezarr/src/type-aliases/voxeltile/)[]

an array of objects representing tiles (bounding information, etc.) which are visible within the given dataset
