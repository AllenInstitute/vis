---
editUrl: false
next: false
prev: false
title: "Box2D"
---

> `const` **Box2D**: `object`

Defined in: [packages/geometry/src/box2D.ts:21](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/geometry/src/box2D.ts#L21)

## Type Declaration

### containsPoint()

> **containsPoint**: (`box`, `point`) => `boolean`

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

##### point

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Returns

`boolean`

### corners()

> **corners**: (`a`) => [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)[]

#### Parameters

##### a

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

#### Returns

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)[]

### create()

> **create**: (`low`, `hi`) => `object`

#### Parameters

##### low

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### hi

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/) = `hi`

##### minCorner

> **minCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/) = `low`

### intersection()

> **intersection**: (`a`, `b`) => [`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\> \| `undefined`

#### Parameters

##### a

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

##### b

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

#### Returns

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\> \| `undefined`

### isBox2D()

> **isBox2D**: (`maybe`) => `maybe is box2D`

#### Parameters

##### maybe

`unknown`

#### Returns

`maybe is box2D`

### isValid()

> **isValid**: (`a`) => `boolean`

#### Parameters

##### a

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

#### Returns

`boolean`

### map()

> **map**: (`box`, `fn`) => `object`

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

##### fn

(`v`) => [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### minCorner

> **minCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

### midpoint()

> **midpoint**: (`b`) => [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Parameters

##### b

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

#### Returns

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

### scale()

> **scale**: (`box`, `s`) => `object`

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

##### s

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### minCorner

> **minCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

### setCorner()

> **setCorner**: (`box`, `cornerIndex`, `position`) => [`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

##### cornerIndex

`number`

##### position

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Returns

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### size()

> **size**: (`b`) => [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Parameters

##### b

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

#### Returns

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

### toFlatArray()

> **toFlatArray**: (`box`) => readonly \[`number`, `number`, `number`, `number`\]

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

#### Returns

readonly \[`number`, `number`, `number`, `number`\]

### toRectangle2D()

> **toRectangle2D**: (`b`) => `rectangle2D`

#### Parameters

##### b

[`box2D`](/vis/api/geometry/src/type-aliases/box2d/)

#### Returns

`rectangle2D`

### translate()

> **translate**: (`box`, `offset`) => `object`

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

##### offset

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### minCorner

> **minCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

### union()

> **union**: (`a`, `b`) => `object`

#### Parameters

##### a

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

##### b

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### minCorner

> **minCorner**: [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)
