---
editUrl: false
next: false
prev: false
title: "getVisibleTiles"
---

> **getVisibleTiles**(`dzi`, `camera`): [`DziTile`](/vis/api/dzi/src/type-aliases/dzitile/)[]

Defined in: [packages/dzi/src/loader.ts:115](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/dzi/src/loader.ts#L115)

## Parameters

### dzi

[`DziImage`](/vis/api/dzi/src/type-aliases/dziimage/)

the dzi image to read tiles from

### camera

#### screenSize

`vec2`

the size, in output pixels, at which the requested region will be displayed.

#### view

`box2D`

a parametric box [0:1] relative the the image as a whole. note that 0 is the TOP of the image.

## Returns

[`DziTile`](/vis/api/dzi/src/type-aliases/dzitile/)[]

a list of tiles at the most appropriate resolution which may be fetched and displayed
