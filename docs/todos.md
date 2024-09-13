# TODOs

This document contains a list of tasks that need to be performed in order to prepare the repository for being open-sourced.

## General
- [ ] Decide if we're using the BSD-3 license or the Allen Institute license and update LICENSE.md accordingly
- [ ] Decide on the name of the packages. Are we sticking with `@alleninstitute/vis-*` or are we going to use a different naming convention, like `@alleninstitute/visualization-toolkit-*`?
- [ ] Decide what packages to have. See `packages.md` for a potential initial list
- [ ] Review existing documentation and make sure it matches the current state of things
- [ ] Add a CONTRIBUTING.md file
- [ ] Add a CODE_OF_CONDUCT.md file

## Process
- [ ] Set up the CI/CD pipeline
- [ ] Set up changelog generation
- [ ] Set up release automation
- [ ] Configure GitHub settings to protect `main`, require approvals from maintainers before merging, only allow "squash and merge" commits, add templates for issues, PR templates, etc.

## Tooling
- [ ] Choose and set up a linter
- [ ] Decide if we want to stick with Prettier for formatting
- [ ] Fix `only-allow` making `npm ci` fail occasionally on consuming libraries or remove it entirely
- [ ] (Optional) Benchmarking tooling to measure and track performance

## Refactor
- [ ] Clean up public API functions to be nicer to use (config object vs long list of arguments, rename as needed, etc.)
- [ ] Move code to proper packages once that's decided (see `packages.md`)
- [ ] Install newly refactored code in `bkp-client` to ensure it's working and nice to use
