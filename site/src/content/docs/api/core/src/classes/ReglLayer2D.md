---
editUrl: false
next: false
prev: false
title: "ReglLayer2D"
---

Defined in: [packages/core/src/layers/layer-2D.ts:11](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/layers/layer-2D.ts#L11)

## Type Parameters

### Renderable

`Renderable`

### RenderSettings

`RenderSettings` *extends* `RequiredSettings`

## Constructors

### Constructor

> **new ReglLayer2D**\<`Renderable`, `RenderSettings`\>(`regl`, `imgRenderer`, `renderFn`, `resolution`): `ReglLayer2D`\<`Renderable`, `RenderSettings`\>

Defined in: [packages/core/src/layers/layer-2D.ts:17](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/layers/layer-2D.ts#L17)

#### Parameters

##### regl

`Regl`

##### imgRenderer

`ImageRenderer`

##### renderFn

`RenderFn`\<`Renderable`, `RenderSettings` & `RequiredSettings`\>

##### resolution

`vec2`

#### Returns

`ReglLayer2D`\<`Renderable`, `RenderSettings`\>

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [packages/core/src/layers/layer-2D.ts:40](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/layers/layer-2D.ts#L40)

#### Returns

`void`

***

### getRenderResults()

> **getRenderResults**(`stage`): `Image`

Defined in: [packages/core/src/layers/layer-2D.ts:49](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/layers/layer-2D.ts#L49)

#### Parameters

##### stage

`"prev"` | `"cur"`

#### Returns

`Image`

***

### onChange()

> **onChange**(`props`, `cancel`): `void`

Defined in: [packages/core/src/layers/layer-2D.ts:52](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/layers/layer-2D.ts#L52)

#### Parameters

##### props

###### data

`Readonly`\<`Renderable`\>

###### settings

`Readonly`\<`RenderSettings`\>

##### cancel

`boolean` = `true`

#### Returns

`void`

***

### renderingInProgress()

> **renderingInProgress**(): `boolean`

Defined in: [packages/core/src/layers/layer-2D.ts:45](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/layers/layer-2D.ts#L45)

#### Returns

`boolean`
