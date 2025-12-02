---
editUrl: false
next: false
prev: false
title: "buildTileRenderCommand"
---

> **buildTileRenderCommand**(`regl`, `numChannels`): (`p`) => `void`

Defined in: [packages/omezarr/src/sliceview/tile-renderer.ts:148](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/omezarr/src/sliceview/tile-renderer.ts#L148)

## Parameters

### regl

`Regl`

an active REGL context

### numChannels

`number`

the number of channels this render command will support

## Returns

a function (regl command) which renders a set of individual channels (of any colorspace(s))
into a single RGB image. Each channel is mapped to the output RGB space via the given Gamut.
The rendering is done in the given target buffer (or null for the screen).

> (`p`): `void`

### Parameters

#### p

`TileRenderProps`

### Returns

`void`
