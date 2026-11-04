---
title: Dependencies
description: A reference page describing how dependencies are managed in the vis project.
---

## Locked Dependencies

All dependencies in this project are locked to specific versions using the `saveExact` setting in `pnpm-workspace.yaml` at the root of the project.

This is to ensure that the project is built and tested with the same versions of dependencies across different environments, and reduces the threat of security vulnerabilities from a more permissive versioning strategy.

## Peer Dependencies

Dependencies whose types or instances cross package boundaries are declared as `peerDependencies` so that consumers end up with a single shared copy. Today that's `@alleninstitute/vis-core`, `@alleninstitute/vis-geometry`, and `regl`. Dependencies that are only used internally (e.g. `zarrita`, `lodash-es`) stay in `dependencies`.

Each peer dependency is also listed in `devDependencies` so the workspace can build and test against it:

```json
"peerDependencies": {
    "@alleninstitute/vis-core": "workspace:^",
    "regl": "^2.1.0"
},
"devDependencies": {
    "@alleninstitute/vis-core": "workspace:*",
    "regl": "2.1.1"
}
```

On publish, `workspace:^` is replaced with a caret range of the current version (e.g. `^0.1.5`). Since we treat `0.x` minor releases as breaking, that range accepts patch releases only. If a package is verified to work with a newer minor release of a peer, replace `workspace:^` with an explicit range (e.g. `^0.1.5 || ^0.2.0`) when releasing it.

When adding a new dependency, make it a peer dependency if consumers will pass its objects into, or receive them from, a `vis` package.

## Dependabot

We run a monthly Dependabot to automatically open PRs to update our dependencies. These are controlled in the `.github/dependabot.yml` file. Because we have multiple packages within this monorepo, that file is somewhat verbose.

When adding a new package or example app, be sure to add a new section to `dependabot.yml`.
