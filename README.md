# Allen Institute Vis

This repository contains a collection of packages for building scalable visualization tools at the Allen Institute. It houses the `vis-[package name]` packages on the Allen Institute GitHub organization's NPM package registry.

# Available Packages

TODO: Update this based on the package setup we decide to use

-   `vis-dzi`: A renderer for [Deep Zoom Images](https://en.wikipedia.org/wiki/Deep_Zoom)
-   `vis-geometry`: A collection of vector functions for 2D and 3D geometry
-   `vis-omezarr`: A renderer for [OME-Zarr](https://ngff.openmicroscopy.org/latest/) datasets
-   `vis-scatterbrain`: A collection of useful utilities used to build our big-data, scalable, scatterplot tool "Scatterbrain" in the Brain Knowledge Platform (will be renamed to `vis-core` in the future)

# Examples

See the `example` directory for example projects using the packages. Over time, these examples will become simpler as the base tooling becomes more mature.

For details on running or adding new examples, see the `docs/examples.md` file.

# Contributing

Contributions are welcome! We're currently breaking apart the Scatterbrain component into smaller, more manageable packages. If you have a package that you think would be useful to others, please open a PR.

# Installation for Development

This project uses [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io/). We use [Volta](https://volta.sh/) to manage the versions of each. If you're not using Volta, check the "volta" key in the root `package.json` for the Node and pnpm versions we're using when developing.

Volta has experimental support for pnpm, so [follow the steps on their docs](https://docs.volta.sh/advanced/pnpm) to get it enabled.

# Using the Libraries

See the `docs/using-packages.md` file for information on how to use the packages in your own projects.
