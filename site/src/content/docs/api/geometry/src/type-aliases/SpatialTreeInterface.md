---
editUrl: false
next: false
prev: false
title: "SpatialTreeInterface"
---

> **SpatialTreeInterface**\<`Tree`, `Content`, `V`\> = `object`

Defined in: [packages/geometry/src/spatialIndexing/tree.ts:3](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/geometry/src/spatialIndexing/tree.ts#L3)

## Type Parameters

### Tree

`Tree`

### Content

`Content`

### V

`V` *extends* `ReadonlyArray`\<`number`\>

## Properties

### bounds()

> **bounds**: (`t`) => [`box`](/vis/api/geometry/src/type-aliases/box/)\<`V`\>

Defined in: [packages/geometry/src/spatialIndexing/tree.ts:4](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/geometry/src/spatialIndexing/tree.ts#L4)

#### Parameters

##### t

`Tree`

#### Returns

[`box`](/vis/api/geometry/src/type-aliases/box/)\<`V`\>

***

### children()

> **children**: (`t`) => `ReadonlyArray`\<`Tree`\>

Defined in: [packages/geometry/src/spatialIndexing/tree.ts:6](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/geometry/src/spatialIndexing/tree.ts#L6)

#### Parameters

##### t

`Tree`

#### Returns

`ReadonlyArray`\<`Tree`\>

***

### content()

> **content**: (`t`) => `Content`

Defined in: [packages/geometry/src/spatialIndexing/tree.ts:5](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/geometry/src/spatialIndexing/tree.ts#L5)

#### Parameters

##### t

`Tree`

#### Returns

`Content`
