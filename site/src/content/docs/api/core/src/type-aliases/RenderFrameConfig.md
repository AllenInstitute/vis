---
editUrl: false
next: false
prev: false
title: "RenderFrameConfig"
---

> **RenderFrameConfig**\<`Dataset`, `Item`, `Settings`, `RqKey`, `CacheKey`, `CacheEntryType`, `GpuData`\> = `object`

Defined in: [packages/core/src/abstract/async-frame.ts:39](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L39)

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

## Properties

### cacheKeyForRequest()

> **cacheKeyForRequest**: (`item`, `requestKey`, `dataset`, `settings`) => `CacheKey`

Defined in: [packages/core/src/abstract/async-frame.ts:62](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L62)

#### Parameters

##### item

`Item`

##### requestKey

`RqKey`

##### dataset

`Dataset`

##### settings

`Settings`

#### Returns

`CacheKey`

***

### dataset

> **dataset**: `Dataset`

Defined in: [packages/core/src/abstract/async-frame.ts:53](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L53)

***

### isPrepared()

> **isPrepared**: (`cacheData`) => `cacheData is GpuData`

Defined in: [packages/core/src/abstract/async-frame.ts:63](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L63)

#### Parameters

##### cacheData

`Record`\<`RqKey`, `CacheEntryType` \| `undefined`\>

#### Returns

`cacheData is GpuData`

***

### items

> **items**: `Item`[]

Defined in: [packages/core/src/abstract/async-frame.ts:51](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L51)

***

### lifecycleCallback

> **lifecycleCallback**: `RenderCallback`\<`Dataset`, `Item`\>

Defined in: [packages/core/src/abstract/async-frame.ts:61](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L61)

***

### maximumInflightAsyncTasks

> **maximumInflightAsyncTasks**: `number`

Defined in: [packages/core/src/abstract/async-frame.ts:48](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L48)

***

### mutableCache

> **mutableCache**: [`AsyncDataCache`](/vis/api/core/src/classes/asyncdatacache/)\<`RqKey`, `CacheKey`, `CacheEntryType`\>

Defined in: [packages/core/src/abstract/async-frame.ts:52](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L52)

***

### queueProcessingIntervalMS

> **queueProcessingIntervalMS**: `number`

Defined in: [packages/core/src/abstract/async-frame.ts:49](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L49)

***

### queueTimeBudgetMS

> **queueTimeBudgetMS**: `number`

Defined in: [packages/core/src/abstract/async-frame.ts:50](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L50)

***

### renderItem()

> **renderItem**: (`item`, `dataset`, `settings`, `gpuData`) => `void`

Defined in: [packages/core/src/abstract/async-frame.ts:64](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L64)

#### Parameters

##### item

`Item`

##### dataset

`Dataset`

##### settings

`Settings`

##### gpuData

`GpuData`

#### Returns

`void`

***

### requestsForItem()

> **requestsForItem**: (`item`, `dataset`, `settings`, `signal?`) => `Record`\<`RqKey`, (`signal`) => `Promise`\<`CacheEntryType`\>\>

Defined in: [packages/core/src/abstract/async-frame.ts:55](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L55)

#### Parameters

##### item

`Item`

##### dataset

`Dataset`

##### settings

`Settings`

##### signal?

`AbortSignal`

#### Returns

`Record`\<`RqKey`, (`signal`) => `Promise`\<`CacheEntryType`\>\>

***

### settings

> **settings**: `Settings`

Defined in: [packages/core/src/abstract/async-frame.ts:54](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/abstract/async-frame.ts#L54)
