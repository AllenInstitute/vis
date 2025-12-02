---
editUrl: false
next: false
prev: false
title: "SharedPriorityCache"
---

Defined in: [packages/core/src/shared-priority-cache/shared-cache.ts:52](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/shared-cache.ts#L52)

## Constructors

### Constructor

> **new SharedPriorityCache**(`store`, `limitInBytes`, `max_concurrent_fetches`): `SharedPriorityCache`

Defined in: [packages/core/src/shared-priority-cache/shared-cache.ts:56](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/shared-cache.ts#L56)

#### Parameters

##### store

`Store`\<`string`, [`Cacheable`](/vis/api/core/src/interfaces/cacheable/)\>

##### limitInBytes

`number`

##### max\_concurrent\_fetches

`number` = `10`

#### Returns

`SharedPriorityCache`

## Methods

### registerClient()

> **registerClient**\<`Item`, `ItemContent`\>(`spec`): `CacheInterface`\<`Item`, `ItemContent`\>

Defined in: [packages/core/src/shared-priority-cache/shared-cache.ts:67](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/shared-cache.ts#L67)

#### Type Parameters

##### Item

`Item`

##### ItemContent

`ItemContent` *extends* `Record`\<`string`, [`Cacheable`](/vis/api/core/src/interfaces/cacheable/)\>

#### Parameters

##### spec

`ClientSpec`\<`Item`, `ItemContent`\>

#### Returns

`CacheInterface`\<`Item`, `ItemContent`\>
