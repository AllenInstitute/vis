---
editUrl: false
next: false
prev: false
title: "buildRGBTileRenderCommand"
---

> **buildRGBTileRenderCommand**(`regl`): (`p`) => `void`

Defined in: [packages/omezarr/src/sliceview/tile-renderer.ts:94](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/omezarr/src/sliceview/tile-renderer.ts#L94)

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
