---
editUrl: false
next: false
prev: false
title: "buildAsyncRenderer"
---

> **buildAsyncRenderer**\<`Dataset`, `Item`, `Settings`, `SemanticKey`, `CacheKeyType`, `GpuData`\>(`renderer`, `queueOptions?`): (`data`, `settings`, `callback`, `target`, `cache`) => `FrameLifecycle`

Defined in: [packages/core/src/abstract/async-frame.ts:197](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/async-frame.ts#L197)

## Type Parameters

### Dataset

`Dataset`

### Item

`Item`

### Settings

`Settings`

### SemanticKey

`SemanticKey` *extends* `string`

### CacheKeyType

`CacheKeyType` *extends* `string`

### GpuData

`GpuData` *extends* `Record`\<`SemanticKey`, [`ReglCacheEntry`](/vis/api/core/src/type-aliases/reglcacheentry/)\>

## Parameters

### renderer

[`Renderer`](/vis/api/core/src/type-aliases/renderer/)\<`Dataset`, `Item`, `Settings`, `GpuData`\>

### queueOptions?

`QueueOptions`

## Returns

> (`data`, `settings`, `callback`, `target`, `cache`): `FrameLifecycle`

### Parameters

#### data

`Dataset`

#### settings

`Settings`

#### callback

`RenderCallback`\<`Dataset`, `Item`\>

#### target

`Framebuffer2D` | `null`

#### cache

[`AsyncDataCache`](/vis/api/core/src/classes/asyncdatacache/)\<`SemanticKey`, `CacheKeyType`, [`ReglCacheEntry`](/vis/api/core/src/type-aliases/reglcacheentry/)\>

### Returns

`FrameLifecycle`
