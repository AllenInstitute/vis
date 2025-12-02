---
editUrl: false
next: false
prev: false
title: "makeRGBAColorVector"
---

> **makeRGBAColorVector**(`colorHashStr`, `normalized`): `vec4`

Defined in: [packages/core/src/colors.ts:52](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/colors.ts#L52)

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
