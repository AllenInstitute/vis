---
title: Development
description: A page for developers to learn about the tools and processes used in the `vis` repository.
sidebar:
    order: 0
---

This document covers the tools, processes, and standards that we follow went developing within the `vis` repository.

## Development Servers
To get started developing in the `vis` repsitory, you can use the following command to watch for changes in all packages and the documentation site:

```sh
pnpm run dev
```

This will use the Parcel [`watch`](https://parceljs.org/features/cli/#parcel-watch-%3Centries%3E) command to detect changes in each `package` and the Starlight [development server](https://starlight.astro.build/getting-started/#start-the-development-server) in parallel in one console.

If you'd rather run individual commands in multiple terminals, you can always use `pnpm run dev` in each individual `package` folder or the `site` folder for the docs website.

## Tooling

These tools will mostly be found in the `packages` directory. Each `example` will have its own needs and may not necessarily use all of these tools.

### Bundling
We use [Parcel](https://parceljs.org/) to bundle our libraries. You can produce a builds of all our packages suitable for upload to a JavaScript package repository by running the following command from the root directory or inside each `packages` folder:

```sh
pnpm run build
```

### Linter/Formatting
We use [Biome](https://biomejs.dev) for linting and formatting.

To run the linter, use the following command:
```sh
pnpm run lint
```

To run the formatter, use the following command:
```sh
pnpm run fmt
```

You can also run the linter and formatter at the same time to see if there are issues (without fixing them):
```sh
pnpm run checks
```

And you can auto-apply simple fixes to both lints and formatting with the following:
```sh
pnpm run checks:fix
```

### Testing
We use [Vitest](https://vitest.dev/) for testing.

To run the tests, use the following command:
```sh
pnpm run test
```

#### Test Coverage
We use [Istanbul](https://istanbul.js.org/) for test coverage.

To check coverage, use the following command:
```sh
pnpm run coverage
```

This will output coverage information to the CLI and also generate an HTML report in the `coverage` directory.

### Documentation and Example Site
We use [Starlight](https://starlight.astro.build/) for documentation and example site generation.

To run the documentation site, use the following command from the `site` directory:
```sh
pnpm run dev
```
