---
editUrl: false
next: false
prev: false
title: "makeRGBColorVector"
---

> **makeRGBColorVector**(`colorHashStr`, `normalized`): `vec3`

Defined in: [packages/core/src/colors.ts:16](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/colors.ts#L16)

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
