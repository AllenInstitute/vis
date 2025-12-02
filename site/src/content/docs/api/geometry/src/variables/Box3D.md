---
editUrl: false
next: false
prev: false
title: "Box3D"
---

> `const` **Box3D**: `object`

Defined in: [packages/geometry/src/box3D.ts:14](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/geometry/src/box3D.ts#L14)

## Type Declaration

### containsPoint()

> **containsPoint**: (`box`, `point`) => `boolean`

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

##### point

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

`boolean`

### corners()

> **corners**: (`a`) => [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)[]

#### Parameters

##### a

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

#### Returns

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)[]

### create()

> **create**: (`low`, `hi`) => `object`

#### Parameters

##### low

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### hi

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/) = `hi`

##### minCorner

> **minCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/) = `low`

### intersection()

> **intersection**: (`a`, `b`) => [`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\> \| `undefined`

#### Parameters

##### a

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

##### b

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

#### Returns

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\> \| `undefined`

### isBox3D()

> **isBox3D**: (`maybe`) => `maybe is box3D`

#### Parameters

##### maybe

`unknown`

#### Returns

`maybe is box3D`

### isValid()

> **isValid**: (`a`) => `boolean`

#### Parameters

##### a

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

#### Returns

`boolean`

### map()

> **map**: (`box`, `fn`) => `object`

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

##### fn

(`v`) => [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### minCorner

> **minCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

### midpoint()

> **midpoint**: (`b`) => [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Parameters

##### b

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

#### Returns

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

### scale()

> **scale**: (`box`, `s`) => `object`

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

##### s

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### minCorner

> **minCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

### setCorner()

> **setCorner**: (`box`, `cornerIndex`, `position`) => [`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

##### cornerIndex

`number`

##### position

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### size()

> **size**: (`b`) => [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Parameters

##### b

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

#### Returns

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

### toFlatArray()

> **toFlatArray**: (`box`) => readonly \[`number`, `number`, `number`, `number`, `number`, `number`\]

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

#### Returns

readonly \[`number`, `number`, `number`, `number`, `number`, `number`\]

### translate()

> **translate**: (`box`, `offset`) => `object`

#### Parameters

##### box

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

##### offset

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### minCorner

> **minCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

### union()

> **union**: (`a`, `b`) => `object`

#### Parameters

##### a

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

##### b

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

#### Returns

`object`

##### maxCorner

> **maxCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### minCorner

> **minCorner**: [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

### xy()

> **xy**: (`b`) => [`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

#### Parameters

##### b

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

#### Returns

[`box`](/vis/api/geometry/src/type-aliases/box/)\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>
