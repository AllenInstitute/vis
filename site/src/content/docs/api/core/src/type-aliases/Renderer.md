---
editUrl: false
next: false
prev: false
title: "Renderer"
---

> **Renderer**\<`Dataset`, `Item`, `Settings`, `GpuData`\> = `object`

Defined in: [packages/core/src/abstract/types.ts:15](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/types.ts#L15)

## Type Parameters

### Dataset

`Dataset`

### Item

`Item`

### Settings

`Settings`

### GpuData

`GpuData` *extends* `Record`\<`string`, [`ReglCacheEntry`](/vis/api/core/src/type-aliases/reglcacheentry/)\>

## Properties

### cacheKey()

> **cacheKey**: (`item`, `requestKey`, `data`, `settings`) => `string`

Defined in: [packages/core/src/abstract/types.ts:70](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/types.ts#L70)

compute a unique (but please not random!) string that the cache system can use to identify the content
associated with this {item, settings, data}

#### Parameters

##### item

`Item`

the item we're caching the data for

##### requestKey

`string`

a key of gpuData (TODO: make this fact official via Typescript if possible)

##### data

`Dataset`

the dataset that owns the given item

##### settings

`Settings`

the configuration of the current rendering task

#### Returns

`string`

a string, suitable for use in a cache

***

### destroy()

> **destroy**: (`regl`) => `void`

Defined in: [packages/core/src/abstract/types.ts:77](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/types.ts#L77)

in some cases, rendering may rely on non-item-specific rendering resources (lookup tables, buffers, etc)
this function is the place to release those

#### Parameters

##### regl

`REGL.Regl`

the regl context (the same that was used to create this renderer)

#### Returns

`void`

***

### fetchItemContent()

> **fetchItemContent**: (`item`, `dataset`, `settings`) => `Record`\<`string`, (`signal`) => `Promise`\<[`ReglCacheEntry`](/vis/api/core/src/type-aliases/reglcacheentry/)\>\>

Defined in: [packages/core/src/abstract/types.ts:34](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/types.ts#L34)

fetch raw, expensive-to-load content (an "Item" is a placeholder for that content)

#### Parameters

##### item

`Item`

An item to fetch content for

##### dataset

`Dataset`

the dataset which owns the given item

##### settings

`Settings`

#### Returns

`Record`\<`string`, (`signal`) => `Promise`\<[`ReglCacheEntry`](/vis/api/core/src/type-aliases/reglcacheentry/)\>\>

a map of meaningful names (eg. position, color, amplitude, etc) to functions that promise raw content, like pixels or other raw, renderable information.
expect that the functions returned in this way have closures over the other arguments to this function -
that is to say, DONT mutate them (make them Readonly if possible)

***

### getVisibleItems()

> **getVisibleItems**: (`data`, `settings`) => `Item`[]

Defined in: [packages/core/src/abstract/types.ts:23](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/types.ts#L23)

a function which returns items from the given dataset - this is the place to express spatial indexing
or any other filtering that may be appropriate

#### Parameters

##### data

`Dataset`

the dataset to pull items from

##### settings

`Settings`

the settings that determine what items are appropriate

#### Returns

`Item`[]

a list of the requested items, whatever they may be

***

### isPrepared()

> **isPrepared**: (`cacheData`) => `cacheData is GpuData`

Defined in: [packages/core/src/abstract/types.ts:44](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/types.ts#L44)

#### Parameters

##### cacheData

`Record`\<`string`, [`ReglCacheEntry`](/vis/api/core/src/type-aliases/reglcacheentry/) \| `undefined`\>

the results of fetching all the content for an Item

#### Returns

`cacheData is GpuData`

true if the content matches the expectations of our rendering function

***

### renderItem()

> **renderItem**: (`target`, `item`, `data`, `settings`, `gpuData`) => `void`

Defined in: [packages/core/src/abstract/types.ts:54](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/abstract/types.ts#L54)

actually render the content of an item

#### Parameters

##### target

REGL framebuffer to render to (null is the canvas to which regl is bound - it is shared and mutable!)

`REGL.Framebuffer2D` | `null`

##### item

`Item`

the item describing the content to render

##### data

`Dataset`

the dataset which owns the item

##### settings

`Settings`

the configuration of the current rendering task

##### gpuData

`GpuData`

the data as fetched and uploaded to the GPU

#### Returns

`void`

void - this function will render (mutate!) the content (pixels!) of the target

#### See

 - fetchItemContent and validated by
 - isPrepared
