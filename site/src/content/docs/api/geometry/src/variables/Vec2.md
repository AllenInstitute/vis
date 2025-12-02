---
editUrl: false
next: false
prev: false
title: "Vec2"
---

> `const` **Vec2**: `object`

Defined in: [packages/geometry/src/vec2.ts:11](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/geometry/src/vec2.ts#L11)

## Type Declaration

### add

> **add**: `binOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### all()

> **all**: (`v`, `op`) => `boolean`

#### Parameters

##### v

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### op

(`c`) => `boolean`

#### Returns

`boolean`

### any()

> **any**: (`v`, `op`) => `boolean`

#### Parameters

##### v

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### op

(`c`) => `boolean`

#### Returns

`boolean`

### ceil

> **ceil**: `unaryOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### det()

> **det**: (`__namedParameters`, `__namedParameters`) => `number`

#### Parameters

##### \_\_namedParameters

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### \_\_namedParameters

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Returns

`number`

### div

> **div**: `binOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### dot()

> **dot**: (`a`, `b`) => `number`

#### Parameters

##### a

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### b

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Returns

`number`

### exactlyEqual()

> **exactlyEqual**: (`a`, `b`) => `boolean`

#### Parameters

##### a

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### b

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Returns

`boolean`

### finite

> **finite**: `predOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### floor

> **floor**: `unaryOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### isVec2()

> **isVec2**: (`v`) => `v is vec2`

#### Parameters

##### v

readonly `number`[]

#### Returns

`v is vec2`

### length

> **length**: `reduceOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### map()

> **map**: (`v`, `op`) => [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Parameters

##### v

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### op

(`c`, `index`) => `number`

#### Returns

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

### max

> **max**: `binOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### maxComponent

> **maxComponent**: `reduceOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### min

> **min**: `binOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### minComponent

> **minComponent**: `reduceOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### mix()

> **mix**: (`a`, `b`, `p`) => [`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

#### Parameters

##### a

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### b

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

##### p

`number`

#### Returns

[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)

### mul

> **mul**: `binOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### normalize

> **normalize**: `unaryOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### scale

> **scale**: `scalarOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### sub

> **sub**: `binOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### sum

> **sum**: `reduceOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>

### swizzle

> **swizzle**: `binOp`\<[`vec2`](/vis/api/geometry/src/type-aliases/vec2/)\>
