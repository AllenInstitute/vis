# Development

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

You can also run the linter and formatter at the same time:
```sh
pnpm run checks
```

And you can auto-apply simple fixes to both lints and formatting with the following:
```sh
pnpm run checks:fix
```

Formatting and linting also have their individual `:fix` commands:
```sH
pnpm run fmt:fix
```

```sh
pnpm run lint:fix
```

## Testing
We use [Vitest](https://vitest.dev/) for testing.

To run the tests, use the following command:
```sh
pnpm run test
```
