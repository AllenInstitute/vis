---
editUrl: false
next: false
prev: false
title: "makeRGBAColorVector"
---

> **makeRGBAColorVector**(`colorHashStr`, `normalized`): `vec4`

Defined in: [packages/core/src/colors.ts:52](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/colors.ts#L52)

Converts a color hash string to a vec4 RGBA color vector.

## Parameters

### colorHashStr

`string`

A string representing a color in hex format, e.g., '#f00f' or 'ff0000ff'.

### normalized

`boolean` = `true`

A boolean indicating whether to normalize the color values to the range [0, 1]. Defaults to true.

## Returns

`vec4`

A vec3 array representing the RGB color vector. If the input is invalid, returns [0, 0, 0, 0].
