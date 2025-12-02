---
editUrl: false
next: false
prev: false
title: "SpatialTreeInterface"
---

> **SpatialTreeInterface**\<`Tree`, `Content`, `V`\> = `object`

Defined in: [packages/geometry/src/spatialIndexing/tree.ts:3](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/geometry/src/spatialIndexing/tree.ts#L3)

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

Defined in: [packages/geometry/src/spatialIndexing/tree.ts:4](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/geometry/src/spatialIndexing/tree.ts#L4)

#### Parameters

##### t

`Tree`

#### Returns

[`box`](/vis/api/geometry/src/type-aliases/box/)\<`V`\>

***

### children()

> **children**: (`t`) => `ReadonlyArray`\<`Tree`\>

Defined in: [packages/geometry/src/spatialIndexing/tree.ts:6](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/geometry/src/spatialIndexing/tree.ts#L6)

#### Parameters

##### t

`Tree`

#### Returns

`ReadonlyArray`\<`Tree`\>

***

### content()

> **content**: (`t`) => `Content`

Defined in: [packages/geometry/src/spatialIndexing/tree.ts:5](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/geometry/src/spatialIndexing/tree.ts#L5)

#### Parameters

##### t

`Tree`

#### Returns

`Content`
