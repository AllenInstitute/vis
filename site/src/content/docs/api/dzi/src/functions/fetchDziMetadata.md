---
editUrl: false
next: false
prev: false
title: "fetchDziMetadata"
---

> **fetchDziMetadata**(`url`): `Promise`\<[`DziImage`](/vis/api/dzi/src/type-aliases/dziimage/) \| `undefined`\>

Defined in: [packages/dzi/src/loader.ts:41](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/dzi/src/loader.ts#L41)

Fetches the metadata for a Deep Zoom Image (DZI) from a given URL.

## Parameters

### url

`string`

The URL to a DZI metadata file, which should be an XML file containing the metadata for a Deep Zoom Image

## Returns

`Promise`\<[`DziImage`](/vis/api/dzi/src/type-aliases/dziimage/) \| `undefined`\>

A DZI image object containing the metadata for the Deep Zoom Image
