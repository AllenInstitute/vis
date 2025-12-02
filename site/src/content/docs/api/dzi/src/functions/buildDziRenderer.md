---
editUrl: false
next: false
prev: false
title: "buildDziRenderer"
---

> **buildDziRenderer**(`regl`): `Renderer`\<[`DziImage`](/vis/api/dzi/src/type-aliases/dziimage/), [`DziTile`](/vis/api/dzi/src/type-aliases/dzitile/), [`DziRenderSettings`](/vis/api/dzi/src/type-aliases/dzirendersettings/), `GpuProps`\>

Defined in: [packages/dzi/src/renderer.ts:29](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/dzi/src/renderer.ts#L29)

## Parameters

### regl

`Regl`

a valid REGL context (https://github.com/regl-project/regl)

## Returns

`Renderer`\<[`DziImage`](/vis/api/dzi/src/type-aliases/dziimage/), [`DziTile`](/vis/api/dzi/src/type-aliases/dzitile/), [`DziRenderSettings`](/vis/api/dzi/src/type-aliases/dzirendersettings/), `GpuProps`\>

an object which can fetch tiles from a DeepZoomImage, determine the visibility of those tiles given a simple camera, and render said tiles
using regl (which uses webGL)
