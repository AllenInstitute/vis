---
title: Dependencies
description: A reference page in my new Starlight docs site.
---

## Locked Dependencies
All dependencies in this project are locked to specific versions using the `.npmrc` file at the root of the project.

This is to ensure that the project is built and tested with the same versions of dependencies across different environments, and reduces the threat of security vulnerabilities from a more permissive versioning strategy.

## Dependabot
We run a monthly Dependabot to automatically open PRs to update our dependencies. These are controlled in the `.github/dependabot.yml` file. Because we have multiple packages within this monorepo, that file is somewhat verbose.

When adding a new package or example app, be sure to add a new section to `dependabot.yml`.
