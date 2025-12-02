---
editUrl: false
next: false
prev: false
title: "makeOmeZarrSliceLoaderWorker"
---

> **makeOmeZarrSliceLoaderWorker**(`ctx`): `void`

Defined in: [packages/omezarr/src/sliceview/worker-loader.ts:33](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/omezarr/src/sliceview/worker-loader.ts#L33)

a helper function to initialize a message handler on a webworker,
which responds to requests for omezarr slices:
messages must be of type MessageEvent<ZarrSliceRequest|CancelRequest>

## Parameters

### ctx

`Window` & *typeof* `globalThis`

the "global this" aka self object on a webworker context.

## Returns

`void`

## See

 - ZarrSliceRequest
 - CancelRequest
