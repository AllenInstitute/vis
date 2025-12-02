---
editUrl: false
next: false
prev: false
title: "limit"
---

> **limit**(`interval`, `x`): `number`

Defined in: [packages/geometry/src/interval.ts:68](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/geometry/src/interval.ts#L68)

## Parameters

### interval

`Interval`

a given VALID interval

### x

`number`

a finite number

## Returns

`number`

x iff x is within interval (or if interval is invalid), interval.min if x<interval.min, interval.max else
