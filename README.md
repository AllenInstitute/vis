# Allen Institute Visualization TypeScript Libraries

This repository contains a collection of TypeScript libraries to help software engineers building scalable visualization tools at the Allen Institute. It houses the `vis-[package name]` packages, which are published publicly to [npm](https://www.npmjs.com/org/alleninstitute) under the `@alleninstitute` scope.

**The published packages are in alpha or beta states. They may fundamentally change as we continue building out functionality.** They are used in a production environment so they are relatively stable, but the APIs are not yet finalized.

## Available Packages

The following is the list of packages and their descriptions:

- `vis-dzi`: A renderer for [Deep Zoom Images](https://en.wikipedia.org/wiki/Deep_Zoom)
- `vis-geometry`: A collection of vector functions for 2D and 3D geometry
- `vis-omezarr`: A renderer for [OME-Zarr](https://ngff.openmicroscopy.org/latest/) datasets
- `vis-core`: A collection of useful utilities used to build our big-data, scalable, data visualization tools, including the DZI viewer, OME-Zarr viewer, and our scatterplot tool "Scatterbrain" for the [ABC Atlas](https://knowledge.brain-map.org/abcatlas) in the Brain Knowledge Platform web application
- `vis-scatterbrain`: A scatterplot viewer optimized for visualizing large datasets, such as those in the [ABC Atlas](https://knowledge.brain-map.org/abcatlas)

We use [Semantic Versioning](https://semver.org/) for our packages. All of them are still pre-`1.0`, indicating that they are in early development. While in `0.x`, a minor version bump (e.g. `0.1.x` to `0.2.0`) signals a breaking change.

## Level Of Support

We are planning on occasional updating this tool with no fixed schedule. Community involvement is encouraged through both issues and pull requests.

## Examples

A deployed version of our examples is located at [https://alleninstitute.github.io/vis](https://alleninstitute.github.io/vis).

The examples live in `site/src/examples`, alongside the documentation site in `site`. Over time, these examples will become more fully featured as the base tooling becomes more mature.

For details on running the documentation and example site, see the [development docs](https://alleninstitute.github.io/vis/developers/development/).

## Contributing

Contributions are welcome! We're currently breaking apart the Scatterbrain component into smaller, more manageable packages. If you have a package that you think would be useful to others, please open a PR.

See the CONTRIBUTING.md file for more information on how to contribute to the project!

## Installation for Development

This project uses [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io/). We use [Volta](https://volta.sh/) to manage the versions of each. If you're not using Volta, check the "volta" key in the root `package.json` for the Node and pnpm versions we're using when developing.

Volta has experimental support for pnpm, so [follow the steps on their docs](https://docs.volta.sh/advanced/pnpm) to get it enabled.

## Using the Libraries

See the [using packages docs](https://alleninstitute.github.io/vis/getting-started/using-packages/) for information on how to use the packages in your own projects, including which peer dependencies to install.
