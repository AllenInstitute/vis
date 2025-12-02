---
editUrl: false
next: false
prev: false
title: "sizeInUnits"
---

> **sizeInUnits**(`plane`, `axes`, `dataset`): `vec2` \| `undefined`

Defined in: [packages/omezarr/src/zarr/loading.ts:235](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/omezarr/src/zarr/loading.ts#L235)

determine the size of a slice of the volume, in the units specified by the axes metadata
as described in the ome-zarr spec (https://ngff.openmicroscopy.org/latest/#axes-md)
NOTE that only scale transformations (https://ngff.openmicroscopy.org/latest/#trafo-md) are supported at present - other types will be ignored.

## Parameters

### plane

`CartesianPlane`

the plane to measure (eg. CartesianPlane('xy'))

### axes

readonly [`OmeZarrAxis`](/vis/api/omezarr/src/type-aliases/omezarraxis/)[]

the axes metadata from the omezarr file in question

### dataset

[`OmeZarrShapedDataset`](/vis/api/omezarr/src/type-aliases/omezarrshapeddataset/)

one of the "datasets" in the omezarr layer pyramid (https://ngff.openmicroscopy.org/latest/#multiscale-md)

## Returns

`vec2` \| `undefined`

the size, with respect to the coordinateTransformations present on the given dataset, of the requested plane.

## Example

```ts
imagine a layer that is 29998 voxels wide in the X dimension, and a scale transformation of 0.00035 for that dimension.
this function would return (29998*0.00035 = 10.4993) for the size of that dimension, which you would interpret to be in whatever unit
is given by the axes metadata for that dimension (eg. millimeters)
```
