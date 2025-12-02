---
editUrl: false
next: false
prev: false
title: "isValid"
---

> **isValid**(`i`, `minSize`): `boolean`

Defined in: [packages/geometry/src/interval.ts:39](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/geometry/src/interval.ts#L39)

## Parameters

### i

`Interval`

### minSize

`number`

## Returns

`boolean`

true iff the given interval i is at least as big as minSize, and min <= max, and isFinite(i)
