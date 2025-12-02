---
editUrl: false
next: false
prev: false
title: "DziRenderSettings"
---

> **DziRenderSettings** = `object`

Defined in: [packages/dzi/src/renderer.ts:7](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/dzi/src/renderer.ts#L7)

## Properties

### camera

> **camera**: `object`

Defined in: [packages/dzi/src/renderer.ts:8](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/dzi/src/renderer.ts#L8)

#### screenSize

> **screenSize**: `vec2`

the resolution of the output screen on which to project the region of source pixels given by view

#### view

> **view**: `box2D`

a region of a dzi image, expressed as a relative parameter (eg. [0,0],[1,1] means the whole image)
