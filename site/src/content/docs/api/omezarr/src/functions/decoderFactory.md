---
editUrl: false
next: false
prev: false
title: "decoderFactory"
---

> **decoderFactory**(`url`, `workerModule`, `options?`): `object`

Defined in: [packages/omezarr/src/zarr/cache-lower.ts:8](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/cache-lower.ts#L8)

## Parameters

### url

`string`

### workerModule

`WorkerInit`

### options?

`CachingMultithreadedFetchStoreOptions`

## Returns

`object`

### decoder()

> **decoder**: (`metadata`, `req`, `level`, `signal?`) => `Promise`\<\{ `data`: `Float32Array`\<`any`\>; `shape`: `number`[]; \}\> = `getSlice`

#### Parameters

##### metadata

[`OmeZarrMetadata`](/vis/api/omezarr/src/classes/omezarrmetadata/)

##### req

[`ZarrRequest`](/vis/api/omezarr/src/type-aliases/zarrrequest/)

##### level

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)

##### signal?

`AbortSignal`

#### Returns

`Promise`\<\{ `data`: `Float32Array`\<`any`\>; `shape`: `number`[]; \}\>

### destroy()

> **destroy**: () => `void`

#### Returns

`void`
