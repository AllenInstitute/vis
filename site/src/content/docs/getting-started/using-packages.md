---
title: Using Packages
description: A reference page to install and use the vis packages.
sidebar:
    order: 2
---

The `vis` project contains multiple packages, each of which is published publicly to [npm](https://www.npmjs.com/org/alleninstitute) under the `@alleninstitute` scope. No authentication is required to install them.

1. Run `npm install @alleninstitute/<package-name>` to install the package, along with any of its peer dependencies (see below).

## Peer Dependencies

The higher-level packages (`vis-core`, `vis-dzi`, `vis-omezarr`, and `vis-scatterbrain`) list `@alleninstitute/vis-core`, `@alleninstitute/vis-geometry`, and `regl` as **peer dependencies** rather than bundling their own copies. Your project installs them directly, and every `vis` package shares that single copy.

This matters because objects created by one copy of a package aren't always compatible with another copy, even when the versions are nearly identical. For example, a cache created with your project's `vis-core` must be the same `vis-core` that `vis-omezarr` uses, and a `regl` context you create must match the `regl` types the renderers expect.

Each package's page lists the exact install command. If your package manager reports a peer dependency conflict, upgrade the conflicting `vis` packages together so they agree on a compatible version range.
