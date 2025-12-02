---
editUrl: false
next: false
prev: false
title: "buildRGBTileRenderCommand"
---

> **buildRGBTileRenderCommand**(`regl`): (`p`) => `void`

Defined in: [packages/omezarr/src/sliceview/tile-renderer.ts:94](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/sliceview/tile-renderer.ts#L94)

## Parameters

### regl

`Regl`

an active REGL context

## Returns

a function (regl command) which renders 3 individual channels as the RGB
components of an image. Each channel is mapped to the output RGB space via the given Gamut.
the rendering is done in the given target buffer (or null for the screen).

> (`p`): `void`

### Parameters

#### p

`RGBTileRenderProps`

### Returns

`void`
