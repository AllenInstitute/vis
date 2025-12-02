---
editUrl: false
next: false
prev: false
title: "limit"
---

> **limit**(`interval`, `x`): `number`

Defined in: [packages/geometry/src/interval.ts:68](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/geometry/src/interval.ts#L68)

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
