---
editUrl: false
next: false
prev: false
title: "AsyncPriorityCache"
---

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:122](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L122)

## Extends

- [`PriorityCache`](/vis/api/core/src/classes/prioritycache/)\<`T`\>

## Type Parameters

### T

`T` *extends* [`Cacheable`](/vis/api/core/src/interfaces/cacheable/)

## Constructors

### Constructor

> **new AsyncPriorityCache**\<`T`\>(`store`, `score`, `limitInBytes`, `maxFetches`, `onDataArrived?`): `AsyncPriorityCache`\<`T`\>

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:129](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L129)

#### Parameters

##### store

`Store`\<`string`, `T`\>

##### score

(`k`) => `number`

##### limitInBytes

`number`

##### maxFetches

`number`

##### onDataArrived?

(`key`, `result`) => `void`

#### Returns

`AsyncPriorityCache`\<`T`\>

#### Overrides

[`PriorityCache`](/vis/api/core/src/classes/prioritycache/).[`constructor`](/vis/api/core/src/classes/prioritycache/#constructor)

## Methods

### cached()

> **cached**(`key`): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:90](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L90)

#### Parameters

##### key

`string`

#### Returns

`boolean`

#### Inherited from

[`PriorityCache`](/vis/api/core/src/classes/prioritycache/).[`cached`](/vis/api/core/src/classes/prioritycache/#cached)

***

### cachedOrPending()

> **cachedOrPending**(`key`): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:208](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L208)

#### Parameters

##### key

`string`

#### Returns

`boolean`

***

### enqueue()

> **enqueue**(`key`, `fetcher`): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:144](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L144)

#### Parameters

##### key

`string`

##### fetcher

(`abort`) => `Promise`\<`T`\>

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

#### Inherited from

[`PriorityCache`](/vis/api/core/src/classes/prioritycache/).[`get`](/vis/api/core/src/classes/prioritycache/#get)

***

### has()

> **has**(`key`): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:86](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L86)

#### Parameters

##### key

`string`

#### Returns

`boolean`

#### Inherited from

[`PriorityCache`](/vis/api/core/src/classes/prioritycache/).[`has`](/vis/api/core/src/classes/prioritycache/#has)

***

### isFull()

> **isFull**(): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:94](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L94)

#### Returns

`boolean`

#### Inherited from

[`PriorityCache`](/vis/api/core/src/classes/prioritycache/).[`isFull`](/vis/api/core/src/classes/prioritycache/#isfull)

***

### pending()

> **pending**(`key`): `boolean`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:204](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L204)

#### Parameters

##### key

`string`

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

#### Inherited from

[`PriorityCache`](/vis/api/core/src/classes/prioritycache/).[`put`](/vis/api/core/src/classes/prioritycache/#put)

***

### reprioritize()

> **reprioritize**(`score?`): `void`

Defined in: [packages/core/src/shared-priority-cache/priority-cache.ts:192](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/shared-priority-cache/priority-cache.ts#L192)

#### Parameters

##### score?

`ScoreFn`

#### Returns

`void`

#### Overrides

[`PriorityCache`](/vis/api/core/src/classes/prioritycache/).[`reprioritize`](/vis/api/core/src/classes/prioritycache/#reprioritize)
