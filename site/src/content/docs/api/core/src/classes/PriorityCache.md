---
editUrl: false
next: false
prev: false
title: "PriorityCache"
---

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:32](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L32)

## Extended by

- [`AsyncPriorityCache`](/vis/api/core/src/classes/asyncprioritycache/)

## Type Parameters

### T

`T` *extends* [`Cacheable`](/vis/api/core/src/interfaces/cacheable/)

## Constructors

### Constructor

> **new PriorityCache**\<`T`\>(`store`, `score`, `limitInBytes`): `PriorityCache`\<`T`\>

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:40](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L40)

#### Parameters

##### store

`Store`\<`string`, `T`\>

##### score

`ScoreFn`

##### limitInBytes

`number`

#### Returns

`PriorityCache`\<`T`\>

## Methods

### cached()

> **cached**(`key`): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:90](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L90)

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### get()

> **get**(`key`): `T` \| `undefined`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:82](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L82)

#### Parameters

##### key

`string`

#### Returns

`T` \| `undefined`

***

### has()

> **has**(`key`): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:86](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L86)

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### isFull()

> **isFull**(): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:94](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L94)

#### Returns

`boolean`

***

### put()

> **put**(`key`, `item`): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:55](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L55)

#### Parameters

##### key

`string`

##### item

`T`

#### Returns

`boolean`

***

### reprioritize()

> **reprioritize**(`score?`): `void`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:78](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L78)

#### Parameters

##### score?

`ScoreFn`

#### Returns

`void`
