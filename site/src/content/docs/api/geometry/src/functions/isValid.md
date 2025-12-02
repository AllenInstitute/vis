---
editUrl: false
next: false
prev: false
title: "isValid"
---

> **isValid**(`i`, `minSize`): `boolean`

Defined in: [packages/geometry/src/interval.ts:39](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/geometry/src/interval.ts#L39)

## Parameters

### i

`Interval`

### minSize

`number`

## Returns

`boolean`

true iff the given interval i is at least as big as minSize, and min <= max, and isFinite(i)
