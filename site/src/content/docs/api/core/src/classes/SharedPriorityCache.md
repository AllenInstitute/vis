---
editUrl: false
next: false
prev: false
title: "SharedPriorityCache"
---

Defined in: [packages/core/src/shared-priority-cache/shared-cache.ts:52](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/shared-priority-cache/shared-cache.ts#L52)

## Constructors

### Constructor

> **new SharedPriorityCache**(`store`, `limitInBytes`, `max_concurrent_fetches`): `SharedPriorityCache`

Defined in: [packages/core/src/shared-priority-cache/shared-cache.ts:56](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/shared-priority-cache/shared-cache.ts#L56)

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

Defined in: [packages/core/src/shared-priority-cache/shared-cache.ts:67](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/shared-priority-cache/shared-cache.ts#L67)

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
