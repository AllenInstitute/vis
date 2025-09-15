# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 💼 Other

- Basic 3D Math utils ([#170](https://github.com/AllenInstitute/vis/pull/170))

### ⚙️ Miscellaneous Tasks

- Add helpful linting rules ([#127](https://github.com/AllenInstitute/vis/pull/127))
- Dev command, reorganized docs, added stubs ([#163](https://github.com/AllenInstitute/vis/pull/163))
- *(deps)* Bump @biomejs/biome from 1.9.4 to 2.0.6 ([#174](https://github.com/AllenInstitute/vis/pull/174))
- Add Changelogs ([#117](https://github.com/AllenInstitute/vis/pull/117))

## [alleninstitute/geometry@0.0.6] - 2025-04-08

### 🚀 Features

- Support for arbitrary color channels in OME-Zarr images [DC-530] ([#123](https://github.com/AllenInstitute/vis/pull/123))

### ⚙️ Miscellaneous Tasks

- Test coverage tooling ([#95](https://github.com/AllenInstitute/vis/pull/95))
- Updates to package versions for Core, Geometry, OmeZarr + examples [DC-530] ([#124](https://github.com/AllenInstitute/vis/pull/124))

## [alleninstitute/geometry@0.0.5] - 2025-03-28

### 🐛 Bug Fixes

- Remove non-null assertions ([#101](https://github.com/AllenInstitute/vis/pull/101))

### ⚙️ Miscellaneous Tasks

- Update Vis OME-Zarr package to load the full set of metadata available in Zarr files [DT-7615] ([#103](https://github.com/AllenInstitute/vis/pull/103))

## [alleninstitute/geometry@0.0.4] - 2025-03-14

### 🐛 Bug Fixes

- CI tests weren't running [DT-7060] ([#87](https://github.com/AllenInstitute/vis/pull/87))

### 💼 Other

- March 2025 ([#99](https://github.com/AllenInstitute/vis/pull/99))

### ⚙️ Miscellaneous Tasks

- Install Biome, fix formatting [DT-7060] ([#52](https://github.com/AllenInstitute/vis/pull/52))
- Biome linting with auto-fixes [DT-7060] ([#53](https://github.com/AllenInstitute/vis/pull/53))
- Dependency health configurations ([#17](https://github.com/AllenInstitute/vis/pull/17))
- Clean up dependencies [DT-7060] ([#55](https://github.com/AllenInstitute/vis/pull/55))
- Fix all but non-null assertion lints ([#96](https://github.com/AllenInstitute/vis/pull/96))

## [alleninstitute/geometry@0.0.3] - 2025-02-03

### 🚀 Features

- *(geometry)* LineSegmentsIntersect and det ([#21](https://github.com/AllenInstitute/vis/pull/21))

### 🐛 Bug Fixes

- Expose Rectangle2D functions, remove glob export from Interval ([#13](https://github.com/AllenInstitute/vis/pull/13))

### 💼 Other

- Merge pull request [#12](https://github.com/AllenInstitute/vis/pull/12) from AllenInstitute/noah/limit-queue-time

dont hog the main thread - use a soft limit
- Cache limits ([#14](https://github.com/AllenInstitute/vis/pull/14))

* first pass at a system which cant leak cache content references (unlike my first attempt)

* finish up some thoughts on how this cache should work. start in on some tests to make sure I'm not crazy. ditch jest because its terrible, try vitest for now - its way nicer but kinda hard to read the output for debugging

* test some more edgy cases of this separate-but-related cache system

* update apps to deal with recent changes in scatterbrain caching system

* stream of consciousness documentation plus basic build&run instructions

* kick out jest - re-write tests using async and vitest

* think about warning of unsafe use via jsdoc...

* forgot to update this demo

* spellcheck

* quick readme for scatterplots

* more words

* Update apps/omezarr-viewer/README.md

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>

* Update apps/omezarr-viewer/README.md

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>

* fix initial versa view. fix a missing closing-brace that would have made cache-eviction waste a lot of time for no reason

* kick jest out of geometry tests too, switch to vitest, confirm all tests pass

* remove my debug logging

* remove isAbortError

---------

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>
- DZI viewer component ([#29](https://github.com/AllenInstitute/vis/pull/29))

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>

### ⚙️ Miscellaneous Tasks

- Chore - move code around to make writing new "apps" less repetative ([#16](https://github.com/AllenInstitute/vis/pull/16))

* move the furniture around - make it easier to share code between various "apps" - the scenario being that the code doesn't yet belong in published-packages, but might have common use in various demos. created a new spatial indexing sub-folder for the geometry package, and put our generic "quad"t tree in there (it can be a tree of any power-of-2 dimension)

* thinking about layers

* PR feedback, disable using the .parcel-cache when building
- Formatting ([#26](https://github.com/AllenInstitute/vis/pull/26))
- CI workflow [DT-5996] ([#25](https://github.com/AllenInstitute/vis/pull/25))
- Remove only-allow so builds stop failing ([#47](https://github.com/AllenInstitute/vis/pull/47))
- Version bumps for only-allow removal release ([#51](https://github.com/AllenInstitute/vis/pull/51))

## [alleninstitute/geometry@0.0.2] - 2024-04-02

### 🐛 Bug Fixes

- *(vis-geometry)* Adds missing functionality from `bkp-client` ([#10](https://github.com/AllenInstitute/vis/pull/10))

### 💼 Other

- A quick demo of how one might render a scatterplot (using ABC-atlas data) ([#7](https://github.com/AllenInstitute/vis/pull/7))

* draw a blue screen in our scatterplot demo

* add fetcher and visibility interface

* make a renderer real quick

* use the renderer, make a more interesting shader, the data is suspiciously ugly

* minor cleanup

---------

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>
- Bump version

### ⚙️ Miscellaneous Tasks

- Use Parcel to produce libraries ([#9](https://github.com/AllenInstitute/vis/pull/9))

## [alleninstitute/geometry@0.0.1] - 2024-02-13

### 🚀 Features

- Publishing documentation and config changes ([#3](https://github.com/AllenInstitute/vis/pull/3))

### 💼 Other

- Initial working commit of copy-pasted geometry lib
- Super basic scatterbrain package
- Confirming I can import stuff from our workspace packages with full ts support, beggining work on a barebones omezarr renderer
- Working basic volumetric slice rendering. cleanup a bunch of oopsies in the tsconfigs.
- Add a bunch of controls to the demo, remove experimental zarr loader libs, fix math in shader
- Implement a resolution-aware dataset layer picker, and a relative camera which is surprisingly nice
- Right side up data, in the correct aspect ratio
- When initializing the repo, names were changed, this fact was not reflected in imports vs. workspace packages.
- Turn on tsconfig verbatimmodulesyntax. delete super busted old demo.
add a base tsconfig for the others to extend - still a work in progress.
- Merge pull request [#1](https://github.com/AllenInstitute/vis/pull/1) from AllenInstitute/noah/cleanup-mistakes-during-repo-init

Noah/cleanup mistakes during repo init

<!-- generated by git-cliff -->
