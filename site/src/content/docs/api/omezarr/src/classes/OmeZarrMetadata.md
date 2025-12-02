---
editUrl: false
next: false
prev: false
title: "OmeZarrMetadata"
---

Defined in: [packages/omezarr/src/zarr/types.ts:226](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L226)

## Constructors

### Constructor

> **new OmeZarrMetadata**(`url`, `attrs`, `arrays`, `zarrVersion`): `OmeZarrMetadata`

Defined in: [packages/omezarr/src/zarr/types.ts:232](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L232)

#### Parameters

##### url

`string`

##### attrs

[`OmeZarrAttrs`](/vis/api/omezarr/src/type-aliases/omezarrattrs/)

##### arrays

readonly [`OmeZarrArrayMetadata`](/vis/api/omezarr/src/type-aliases/omezarrarraymetadata/)[]

##### zarrVersion

`number`

#### Returns

`OmeZarrMetadata`

## Accessors

### arrays

#### Get Signature

> **get** **arrays**(): readonly [`OmeZarrArrayMetadata`](/vis/api/omezarr/src/type-aliases/omezarrarraymetadata/)[]

Defined in: [packages/omezarr/src/zarr/types.ts:247](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L247)

##### Returns

readonly [`OmeZarrArrayMetadata`](/vis/api/omezarr/src/type-aliases/omezarrarraymetadata/)[]

***

### attrs

#### Get Signature

> **get** **attrs**(): [`OmeZarrAttrs`](/vis/api/omezarr/src/type-aliases/omezarrattrs/)

Defined in: [packages/omezarr/src/zarr/types.ts:243](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L243)

##### Returns

[`OmeZarrAttrs`](/vis/api/omezarr/src/type-aliases/omezarrattrs/)

***

### blueChannel

#### Get Signature

> **get** **blueChannel**(): `OmeZarrColorChannel` \| `undefined`

Defined in: [packages/omezarr/src/zarr/types.ts:537](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L537)

##### Returns

`OmeZarrColorChannel` \| `undefined`

***

### colorChannels

#### Get Signature

> **get** **colorChannels**(): `OmeZarrColorChannel`[]

Defined in: [packages/omezarr/src/zarr/types.ts:525](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L525)

##### Returns

`OmeZarrColorChannel`[]

***

### greenChannel

#### Get Signature

> **get** **greenChannel**(): `OmeZarrColorChannel` \| `undefined`

Defined in: [packages/omezarr/src/zarr/types.ts:533](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L533)

##### Returns

`OmeZarrColorChannel` \| `undefined`

***

### redChannel

#### Get Signature

> **get** **redChannel**(): `OmeZarrColorChannel` \| `undefined`

Defined in: [packages/omezarr/src/zarr/types.ts:529](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L529)

##### Returns

`OmeZarrColorChannel` \| `undefined`

***

### url

#### Get Signature

> **get** **url**(): `string`

Defined in: [packages/omezarr/src/zarr/types.ts:239](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L239)

##### Returns

`string`

***

### zarrVersion

#### Get Signature

> **get** **zarrVersion**(): `number`

Defined in: [packages/omezarr/src/zarr/types.ts:251](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L251)

##### Returns

`number`

## Methods

### dehydrate()

> **dehydrate**(): [`DehydratedOmeZarrMetadata`](/vis/api/omezarr/src/type-aliases/dehydratedomezarrmetadata/)

Defined in: [packages/omezarr/src/zarr/types.ts:503](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L503)

#### Returns

[`DehydratedOmeZarrMetadata`](/vis/api/omezarr/src/type-aliases/dehydratedomezarrmetadata/)

***

### getAllShapedDatasets()

> **getAllShapedDatasets**(`multiscale`): [`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)[]

Defined in: [packages/omezarr/src/zarr/types.ts:497](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L497)

#### Parameters

##### multiscale

`string` | `number`

#### Returns

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)[]

***

### getFirstShapedDataset()

> **getFirstShapedDataset**(`multiscale`): [`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/) \| `undefined`

Defined in: [packages/omezarr/src/zarr/types.ts:463](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L463)

#### Parameters

##### multiscale

`string` | `number`

#### Returns

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/) \| `undefined`

***

### getLastShapedDataset()

> **getLastShapedDataset**(`multiscale`): [`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/) \| `undefined`

Defined in: [packages/omezarr/src/zarr/types.ts:478](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L478)

#### Parameters

##### multiscale

`string` | `number`

#### Returns

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/) \| `undefined`

***

### getNumLayers()

> **getNumLayers**(`multiscale`): `number`

Defined in: [packages/omezarr/src/zarr/types.ts:493](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L493)

#### Parameters

##### multiscale

`string` | `number`

#### Returns

`number`

***

### getShapedDataset()

> **getShapedDataset**(`indexOrPath`, `multiscale`): [`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/) \| `undefined`

Defined in: [packages/omezarr/src/zarr/types.ts:448](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L448)

#### Parameters

##### indexOrPath

`string` | `number`

##### multiscale

`string` | `number`

#### Returns

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/) \| `undefined`

***

### maxOrthogonal()

> **maxOrthogonal**(`plane`, `multiscale`): `number`

Defined in: [packages/omezarr/src/zarr/types.ts:420](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L420)

#### Parameters

##### plane

`CartesianPlane`

##### multiscale

`string` | `number`

#### Returns

`number`

***

### maxX()

> **maxX**(`multiscale`): `number`

Defined in: [packages/omezarr/src/zarr/types.ts:396](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L396)

Given a specific

#### Parameters

##### multiscale

representation of the Zarr data, finds the
largest X shape component among the shapes of the different dataset arrays.

`string` | `number`

#### Returns

`number`

the largest Z scale for the specified multiscale representation

***

### maxY()

> **maxY**(`multiscale`): `number`

Defined in: [packages/omezarr/src/zarr/types.ts:406](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L406)

Given a specific

#### Parameters

##### multiscale

representation of the Zarr data, finds the
largest Y shape component among the shapes of the different dataset arrays.

`string` | `number`

#### Returns

`number`

the largest Z scale for the specified multiscale representation

***

### maxZ()

> **maxZ**(`multiscale`): `number`

Defined in: [packages/omezarr/src/zarr/types.ts:416](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L416)

Given a specific

#### Parameters

##### multiscale

representation of the Zarr data, finds the
largest Z shape component among the shapes of the different dataset arrays.

`string` | `number`

#### Returns

`number`

the largest Z scale for the specified multiscale representation

***

### toJSON()

> **toJSON**(): `OmeZarrMetadataFlattened`

Defined in: [packages/omezarr/src/zarr/types.ts:255](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L255)

#### Returns

`OmeZarrMetadataFlattened`

***

### rehydrate()

> `static` **rehydrate**(`dehydrated`): `Promise`\<`OmeZarrMetadata`\>

Defined in: [packages/omezarr/src/zarr/types.ts:507](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/types.ts#L507)

#### Parameters

##### dehydrated

[`DehydratedOmeZarrMetadata`](/vis/api/omezarr/src/type-aliases/dehydratedomezarrmetadata/)

#### Returns

`Promise`\<`OmeZarrMetadata`\>
