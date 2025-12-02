---
editUrl: false
next: false
prev: false
title: "Vec4"
---

> `const` **Vec4**: `object`

Defined in: [packages/geometry/src/vec4.ts:6](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/geometry/src/vec4.ts#L6)

## Type Declaration

### add

> **add**: `binOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### all()

> **all**: (`v`, `op`) => `boolean`

#### Parameters

##### v

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

##### op

(`c`) => `boolean`

#### Returns

`boolean`

### any()

> **any**: (`v`, `op`) => `boolean`

#### Parameters

##### v

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

##### op

(`c`) => `boolean`

#### Returns

`boolean`

### ceil

> **ceil**: `unaryOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### div

> **div**: `binOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### dot()

> **dot**: (`a`, `b`) => `number`

#### Parameters

##### a

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

##### b

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

#### Returns

`number`

### exactlyEqual()

> **exactlyEqual**: (`a`, `b`) => `boolean`

#### Parameters

##### a

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

##### b

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

#### Returns

`boolean`

### finite

> **finite**: `predOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### floor

> **floor**: `unaryOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### length

> **length**: `reduceOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### map()

> **map**: (`v`, `op`) => [`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

#### Parameters

##### v

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

##### op

(`c`, `index`) => `number`

#### Returns

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

### max

> **max**: `binOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### maxComponent

> **maxComponent**: `reduceOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### min

> **min**: `binOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### minComponent

> **minComponent**: `reduceOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### mix()

> **mix**: (`a`, `b`, `p`) => [`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

#### Parameters

##### a

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

##### b

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

##### p

`number`

#### Returns

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

### mul

> **mul**: `binOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### normalize

> **normalize**: `unaryOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### scale

> **scale**: `scalarOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### sub

> **sub**: `binOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### sum

> **sum**: `reduceOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### swizzle

> **swizzle**: `binOp`\<[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)\>

### xyz()

> **xyz**: (`v`) => [`vec3`](/vis/api/geometry/src/type-aliases/vec3/)

#### Parameters

##### v

[`vec4`](/vis/api/geometry/src/type-aliases/vec4/)

#### Returns

[`vec3`](/vis/api/geometry/src/type-aliases/vec3/)
