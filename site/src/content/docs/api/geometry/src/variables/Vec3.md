---
editUrl: false
next: false
prev: false
title: "Vec3"
---

> `const` **Vec3**: `object`

Defined in: [packages/geometry/src/vec3.ts:13](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/geometry/src/vec3.ts#L13)

## Type Declaration

### add

> **add**: `binOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### all()

> **all**: (`v`, `op`) => `boolean`

#### Parameters

##### v

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### op

(`c`) => `boolean`

#### Returns

`boolean`

### any()

> **any**: (`v`, `op`) => `boolean`

#### Parameters

##### v

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### op

(`c`) => `boolean`

#### Returns

`boolean`

### ceil

> **ceil**: `unaryOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### cross()

> **cross**: (`a`, `b`) => [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Parameters

##### a

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### b

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

### div

> **div**: `binOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### dot()

> **dot**: (`a`, `b`) => `number`

#### Parameters

##### a

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### b

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

`number`

### exactlyEqual()

> **exactlyEqual**: (`a`, `b`) => `boolean`

#### Parameters

##### a

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### b

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

`boolean`

### finite

> **finite**: `predOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### floor

> **floor**: `unaryOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### isVec3()

> **isVec3**: (`v`) => `v is vec3`

#### Parameters

##### v

readonly `number`[]

#### Returns

`v is vec3`

### length

> **length**: `reduceOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### map()

> **map**: (`v`, `op`) => [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Parameters

##### v

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### op

(`c`, `index`) => `number`

#### Returns

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

### max

> **max**: `binOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### maxComponent

> **maxComponent**: `reduceOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### min

> **min**: `binOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### minComponent

> **minComponent**: `reduceOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### mix()

> **mix**: (`a`, `b`, `p`) => [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Parameters

##### a

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### b

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

##### p

`number`

#### Returns

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

### mul

> **mul**: `binOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### normalize

> **normalize**: `unaryOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### scale

> **scale**: `scalarOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### sub

> **sub**: `binOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### sum

> **sum**: `reduceOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### swizzle

> **swizzle**: `binOp`\<[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)\>

### xy()

> **xy**: (`xyz`) => readonly \[`number`, `number`\]

#### Parameters

##### xyz

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Returns

readonly \[`number`, `number`\]
