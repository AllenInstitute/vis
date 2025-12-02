---
editUrl: false
next: false
prev: false
title: "AsyncDataCache"
---

Defined in: [packages/core/src/dataset-cache.ts:60](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/dataset-cache.ts#L60)

`AsyncDataCache` asynchronous data cache, useful for minimizing network requests by caching the results of
a network request and returning the cached result if the request has already been made previously
for a given key.

It is generalizable over any type of data.

## Example

```ts
const getMyData = ()=>fetch('https://example.com/data.json');
myCache.cache('myKey', getMyData).then((data)=>{console.log('its here now (and we cached it) ', data)});
}
```

## Type Parameters

### SemanticKey

`SemanticKey` *extends* `RecordKey`

### CacheKey

`CacheKey` *extends* `RecordKey`

### D

`D`

## Implements

- `AsyncCache`\<`SemanticKey`, `CacheKey`, `D`\>

## Constructors

### Constructor

> **new AsyncDataCache**\<`SemanticKey`, `CacheKey`, `D`\>(`destroy`, `size`, `cacheLimit`): `AsyncDataCache`\<`SemanticKey`, `CacheKey`, `D`\>

Defined in: [packages/core/src/dataset-cache.ts:79](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/dataset-cache.ts#L79)

the intended use of this cache is to store resources used for rendering. Because the specific contents are generic, a simple interface must be provided
to support LRU cache eviction
occasionally, it can be necessary to manage these resources more explicitly (see https://stackoverflow.com/a/31250301 for a great example)

#### Parameters

##### destroy

(`data`) => `void`

a function which safely releases the resources owned by an entry in this cache - for normal garbage-collected objects, a no-op function will suffice.

##### size

(`data`) => `number`

a function which returns the size of a resource - this is used only in relation to the cacheLimit

##### cacheLimit

`number`

a limit (in whatever units are returned by the size() parameter) to place on cache contents
note that this limit is not a hard limit - old entries are evicted when new data is fetched, but the limit may be exceeded occasionally
a reasonable implementation may simply return 1 for size, and a desired occupancy count for the limit

#### Returns

`AsyncDataCache`\<`SemanticKey`, `CacheKey`, `D`\>

## Methods

### areKeysAllCached()

> **areKeysAllCached**(`cacheKeys`): `boolean`

Defined in: [packages/core/src/dataset-cache.ts:159](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/dataset-cache.ts#L159)

`areKeysAllCached` checks if all the keys provided are in the cache with resolved promises.

Useful for checking if all the data needed for a particular operation is already in the cache.

#### Parameters

##### cacheKeys

readonly `CacheKey`[]

A list of keys to check for in the cache

#### Returns

`boolean`

True if all keys are cached, false if any are not in the cache

***

### cacheAndUse()

> **cacheAndUse**(`workingSet`, `use`, `toCacheKey`, `taskFinished?`): `cancelFn` \| `undefined`

Defined in: [packages/core/src/dataset-cache.ts:241](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/dataset-cache.ts#L241)

#### Parameters

##### workingSet

`Record`\<`SemanticKey`, (`signal`) => `Promise`\<`D`\>\>

##### use

(`items`) => `void`

##### toCacheKey

(`semanticKey`) => `CacheKey`

##### taskFinished?

() => `void`

#### Returns

`cancelFn` \| `undefined`

#### Implementation of

`AsyncCache.cacheAndUse`

***

### ~~getCachedUNSAFE()~~

> **getCachedUNSAFE**(`key`): `D` \| `undefined`

Defined in: [packages/core/src/dataset-cache.ts:184](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/dataset-cache.ts#L184)

:::caution[Deprecated]
to alert (external) users to avoid calling this!
`getCachedUNSAFE` gets an entry from the cache for the given key (if the promise is resolved).
because of how eviction works - this method should be considered unsafe! consider the following
:::

#### Parameters

##### key

`CacheKey`

Entry key to look up in the cache

#### Returns

`D` \| `undefined`

The entry (D) if it is present, or undefined if it is not

#### Example

```ts
const entry = cache.getCachedUnsafe('whatever')
const otherStuff = await fetch('....')
... more code
doSomethingCool(entry, otherStuff)

by the time the caller gets to the doSomethingCool call, the resources bound to the cache entry
may have been disposed!
do note that if you use a cache-entry synchronously (no awaits!) after requesting it, you're likely to not
encounter any issues, however its a much more robust practice to simply refactor like so:

const otherStuff = await fetch('...')
cache.cacheAndUse({...}, (...args)=>doSomethingCool(otherStuff, ..args), ...)
```

#### Implementation of

`AsyncCache.getCachedUNSAFE`

***

### getNumPendingTasks()

> **getNumPendingTasks**(): `number`

Defined in: [packages/core/src/dataset-cache.ts:191](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/dataset-cache.ts#L191)

#### Returns

`number`

***

### isCached()

> **isCached**(`key`): `boolean`

Defined in: [packages/core/src/dataset-cache.ts:146](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/dataset-cache.ts#L146)

`isCached` checks if the entry is in the cache with a resolved promise.

#### Parameters

##### key

`CacheKey`

The entry key to check for in the cache

#### Returns

`boolean`

True if the entry in the cache has been resolved, false if there is no entry with that key or the promise is still pending

#### Implementation of

`AsyncCache.isCached`
