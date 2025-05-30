---
title: Development
description: A page for developers to learn about the tools and processes used in the `vis` repository.
sidebar:
    order: 0
---

This document covers the tools, processes, and standards that we follow went developing within the `vis` repository.

# Tooling

These tools will mostly be found in the `packages` directory. Each `example` will have its own needs and may not necessarily use all of these tools.

## Linter/Formatting
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

## Testing
We use [Vitest](https://vitest.dev/) for testing.

To run the tests, use the following command:
```sh
pnpm run test
```

### Test Coverage
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
