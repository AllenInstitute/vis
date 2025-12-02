---
editUrl: false
next: false
prev: false
title: "RenderServer"
---

Defined in: [packages/core/src/abstract/render-server.ts:48](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/render-server.ts#L48)

## Constructors

### Constructor

> **new RenderServer**(`maxSize`, `extensions`, `cacheByteLimit`): `RenderServer`

Defined in: [packages/core/src/abstract/render-server.ts:55](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/render-server.ts#L55)

#### Parameters

##### maxSize

`vec2`

##### extensions

`string`[]

##### cacheByteLimit

`number` = `...`

#### Returns

`RenderServer`

## Properties

### cache

> **cache**: [`AsyncDataCache`](/vis/api/core/src/classes/asyncdatacache/)\<`string`, `string`, [`ReglCacheEntry`](/vis/api/core/src/type-aliases/reglcacheentry/)\>

Defined in: [packages/core/src/abstract/render-server.ts:52](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/render-server.ts#L52)

***

### regl

> **regl**: `Regl`

Defined in: [packages/core/src/abstract/render-server.ts:51](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/render-server.ts#L51)

## Methods

### beginRendering()

> **beginRendering**\<`D`, `I`\>(`renderFn`, `callback`, `client`): `void`

Defined in: [packages/core/src/abstract/render-server.ts:167](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/render-server.ts#L167)

#### Type Parameters

##### D

`D`

##### I

`I`

#### Parameters

##### renderFn

`RenderFrameFn`\<`D`, `I`\>

##### callback

`ServerCallback`\<`D`, `I`\>

##### client

`HTMLCanvasElement`

#### Returns

`void`

***

### destroyClient()

> **destroyClient**(`client`): `void`

Defined in: [packages/core/src/abstract/render-server.ts:141](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/render-server.ts#L141)

#### Parameters

##### client

`HTMLCanvasElement`

#### Returns

`void`
