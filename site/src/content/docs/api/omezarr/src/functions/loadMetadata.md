---
editUrl: false
next: false
prev: false
title: "loadMetadata"
---

> **loadMetadata**(`res`, `loadV2ArrayAttrs`): `Promise`\<[`OmeZarrMetadata`](/vis/api/omezarr/src/classes/omezarrmetadata/)\>

Defined in: [packages/omezarr/src/zarr/loading.ts:101](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/loading.ts#L101)

## Parameters

### res

`WebResource`

### loadV2ArrayAttrs

`boolean` = `true`

## Returns

`Promise`\<[`OmeZarrMetadata`](/vis/api/omezarr/src/classes/omezarrmetadata/)\>

a structure describing the omezarr dataset. See
https://ngff.openmicroscopy.org/latest/#multiscale-md for the specification.
The object returned from this function can be passed to most of the other utilities for ome-zarr data
manipulation.
