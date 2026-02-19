---
title: Packages
description: A list of the packages in the vis monorepo.
sidebar:
    order: 0
---

The `AllenInstitute/vis` repository holds multiple published packages. The current list of packages is below:

- `vis-core`: A collection of useful utilities used to build our big-data, scalable, data visualization tools, including the DZI viewer, OME-Zarr viewer, and our scatterplot tool "Scatterbrain" for the [ABC Atlas](https://knowledge.brain-map.org/abcatlas) in the Brain Knowledge Platform web application
- `vis-dzi`: A renderer for [Deep Zoom Images](https://en.wikipedia.org/wiki/Deep_Zoom)
- `vis-geometry`: A collection of vector functions for 2D and 3D geometry
- `vis-omezarr`: A renderer for [OME-Zarr](https://ngff.openmicroscopy.org/latest/) datasets
- `vis-scatterbrain`: A scatterplot viewer optimized for visualizing large datasets, such as those in the [ABC Atlas](https://knowledge.brain-map.org/abcatlas)

To install and use these packages, see the instructions on [using packages](../using-packages).

## Future Packages

The following is a list of packages that we would like to create in the future.

If you are interested in contributing to the development of any of these packages, please reach out on GitHub to get started!
- `vis-components` - A collection of web components for displaying visualizations built with our `vis` packages
- `vis-react` - React component implementations of each of the visualization packages
- `vis-[your favorite framework]` - Any other framework-specific implementations of our visualization packages, as driven by community needs
