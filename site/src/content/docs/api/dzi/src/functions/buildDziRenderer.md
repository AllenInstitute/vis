---
editUrl: false
next: false
prev: false
title: "buildDziRenderer"
---

> **buildDziRenderer**(`regl`): `Renderer`\<[`DziImage`](/vis/api/dzi/src/type-aliases/dziimage/), [`DziTile`](/vis/api/dzi/src/type-aliases/dzitile/), [`DziRenderSettings`](/vis/api/dzi/src/type-aliases/dzirendersettings/), `GpuProps`\>

Defined in: [packages/dzi/src/renderer.ts:29](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/dzi/src/renderer.ts#L29)

## Parameters

### regl

`Regl`

a valid REGL context (https://github.com/regl-project/regl)

## Returns

`Renderer`\<[`DziImage`](/vis/api/dzi/src/type-aliases/dziimage/), [`DziTile`](/vis/api/dzi/src/type-aliases/dzitile/), [`DziRenderSettings`](/vis/api/dzi/src/type-aliases/dzirendersettings/), `GpuProps`\>

an object which can fetch tiles from a DeepZoomImage, determine the visibility of those tiles given a simple camera, and render said tiles
using regl (which uses webGL)
