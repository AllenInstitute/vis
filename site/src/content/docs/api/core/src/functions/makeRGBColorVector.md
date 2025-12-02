---
editUrl: false
next: false
prev: false
title: "makeRGBColorVector"
---

> **makeRGBColorVector**(`colorHashStr`, `normalized`): `vec3`

Defined in: [packages/core/src/colors.ts:16](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/colors.ts#L16)

Converts a color hash string to a vec3 RGB color vector.

## Parameters

### colorHashStr

`string`

A string representing a color in hex format, e.g., '#f00' or 'ff0000'.

### normalized

`boolean` = `true`

A boolean indicating whether to normalize the color values to the range [0, 1]. Defaults to true.

## Returns

`vec3`

A vec3 array representing the RGB color vector. If the input is invalid, returns [0, 0, 0].
