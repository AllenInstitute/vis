---
editUrl: false
next: false
prev: false
title: "beginFrame"
---

> **beginFrame**\<`Dataset`, `Item`, `Settings`, `RqKey`, `CacheKey`, `CacheEntryType`, `GpuData`\>(`config`): `FrameLifecycle`

Defined in: [packages/core/src/abstract/async-frame.ts:67](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/async-frame.ts#L67)

## Type Parameters

### Dataset

`Dataset`

### Item

`Item`

### Settings

`Settings`

### RqKey

`RqKey` *extends* `string`

### CacheKey

`CacheKey` *extends* `string`

### CacheEntryType

`CacheEntryType`

### GpuData

`GpuData` *extends* `Record`\<`RqKey`, `CacheEntryType`\>

## Parameters

### config

[`RenderFrameConfig`](/vis/api/core/src/type-aliases/renderframeconfig/)\<`Dataset`, `Item`, `Settings`, `RqKey`, `CacheKey`, `CacheEntryType`, `GpuData`\>

## Returns

`FrameLifecycle`
