# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 🚀 Features

- Package tag changelog generation

### 🐛 Bug Fixes

- Parse axis name to match our internal casing [134] ([#140](https://github.com/AllenInstitute/vis/pull/140))
- Allow Workers to be instantiated directly via callback ([#206](https://github.com/AllenInstitute/vis/pull/206))
- Fix version display on changelogs and tweak scatterbrain package command

### 💼 Other

- A priority cache with a (better?) api ([#171](https://github.com/AllenInstitute/vis/pull/171))

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>
- Didn't need quotes
- Don't filter out unconvenctional commits so we can see everything!
- Merge branch 'main' into lane/package-tag-changelogs
- Added support for Zarr V3 ([#191](https://github.com/AllenInstitute/vis/pull/191))

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>
- Update vis-omezarr to v0.0.13 ([#192](https://github.com/AllenInstitute/vis/pull/192))
- Merge branch 'main' into lane/package-tag-changelogs
- Allow slices from planes by % rather than slice index - as the number of slices is not constant at all scales in most volumes ([#187](https://github.com/AllenInstitute/vis/pull/187))

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>
- Merge branch 'main' into lane/package-tag-changelogs

### ⚙️ Miscellaneous Tasks

- Add helpful linting rules ([#127](https://github.com/AllenInstitute/vis/pull/127))
- *(deps)* Bump zod from 3.24.2 to 3.24.3 ([#154](https://github.com/AllenInstitute/vis/pull/154))
- Dev command, reorganized docs, added stubs ([#163](https://github.com/AllenInstitute/vis/pull/163))
- *(deps)* Bump zod from 3.24.3 to 3.25.46 ([#165](https://github.com/AllenInstitute/vis/pull/165))
- *(deps)* Bump @biomejs/biome from 1.9.4 to 2.0.6 ([#174](https://github.com/AllenInstitute/vis/pull/174))
- *(deps)* Bump zarrita from 0.5.1 to 0.5.2 ([#175](https://github.com/AllenInstitute/vis/pull/175))
- Add Changelogs ([#117](https://github.com/AllenInstitute/vis/pull/117))
- Update release numbers for release ([#180](https://github.com/AllenInstitute/vis/pull/180))
- *(deps)* Bump zod from 3.25.50 to 4.0.14 ([#181](https://github.com/AllenInstitute/vis/pull/181))
- *(deps)* Bump zarrita from 0.5.2 to 0.5.3 ([#189](https://github.com/AllenInstitute/vis/pull/189))
- *(deps)* Bump zod from 4.0.14 to 4.1.5 ([#188](https://github.com/AllenInstitute/vis/pull/188))
- *(deps)* Bump @biomejs/biome from 2.1.3 to 2.2.2 ([#190](https://github.com/AllenInstitute/vis/pull/190))
- *(deps)* Bump zod from 4.1.5 to 4.1.11 ([#195](https://github.com/AllenInstitute/vis/pull/195))
- Create standalone Priority Cache without fetching ([#199](https://github.com/AllenInstitute/vis/pull/199))
- Adding "type: module" to all packages ([#201](https://github.com/AllenInstitute/vis/pull/201))
- Adding in a caching multithreaded Fetch Store ([#200](https://github.com/AllenInstitute/vis/pull/200))
- Chore -cached loading (V3 omezarr support) step one ([#205](https://github.com/AllenInstitute/vis/pull/205))
- Renaming render functions from "renderer" to "render command" ([#204](https://github.com/AllenInstitute/vis/pull/204))
- *(deps)* Bump zod from 4.1.11 to 4.1.12 ([#214](https://github.com/AllenInstitute/vis/pull/214))
- *(deps)* Bump zarrita from 0.5.3 to 0.5.4 ([#210](https://github.com/AllenInstitute/vis/pull/210))
- *(deps)* Bump zod from 4.1.12 to 4.1.13 ([#218](https://github.com/AllenInstitute/vis/pull/218))
- *(deps)* Bump zod from 4.1.13 to 4.3.4 ([#222](https://github.com/AllenInstitute/vis/pull/222))
- *(deps)* Bump zod from 4.3.5 to 4.3.6 ([#228](https://github.com/AllenInstitute/vis/pull/228))
- Update or remove dependencies ([#229](https://github.com/AllenInstitute/vis/pull/229))

## [0.0.11] - 2025-04-23

### 💼 Other

- Noah/webworker decoders ([#126](https://github.com/AllenInstitute/vis/pull/126))

## [0.0.10] - 2025-04-08

### 🚀 Features

- Support for arbitrary color channels in OME-Zarr images [DC-530] ([#123](https://github.com/AllenInstitute/vis/pull/123))

### ⚙️ Miscellaneous Tasks

- Rename vis-scatterbrain package to vis-core ([#118](https://github.com/AllenInstitute/vis/pull/118))
- Updates to package versions for Core, Geometry, OmeZarr + examples [DC-530] ([#124](https://github.com/AllenInstitute/vis/pull/124))

## [0.0.9] - 2025-03-31

### 🐛 Bug Fixes

- Fix issue with handling RGB channels in new OME-Zarr metadata code [DT-7615] ([#110](https://github.com/AllenInstitute/vis/pull/110))

### ⚙️ Miscellaneous Tasks

- Test coverage tooling ([#95](https://github.com/AllenInstitute/vis/pull/95))
- Updating vis-dzi and vis-omezarr to enable use of vis-scatterbrain 0.0.10 ([#112](https://github.com/AllenInstitute/vis/pull/112))

## [0.0.8] - 2025-03-28

### 🐛 Bug Fixes

- Remove non-null assertions ([#101](https://github.com/AllenInstitute/vis/pull/101))

### ⚙️ Miscellaneous Tasks

- Logger with log levels ([#97](https://github.com/AllenInstitute/vis/pull/97))
- Update Vis OME-Zarr package to load the full set of metadata available in Zarr files [DT-7615] ([#103](https://github.com/AllenInstitute/vis/pull/103))

## [0.0.7] - 2025-03-14

### ⚙️ Miscellaneous Tasks

- Update vis-omezarr 0.0.7 - upgrade zarrita to 0.5.0 ([#100](https://github.com/AllenInstitute/vis/pull/100))

## [0.0.6] - 2025-03-14

### 💼 Other

- Updating contributors
- March 2025 ([#99](https://github.com/AllenInstitute/vis/pull/99))

## [0.0.5] - 2025-03-14

### 🐛 Bug Fixes

- CI tests weren't running [DT-7060] ([#87](https://github.com/AllenInstitute/vis/pull/87))

### 💼 Other

- Updating to version 0.0.5

### ⚙️ Miscellaneous Tasks

- Install Biome, fix formatting [DT-7060] ([#52](https://github.com/AllenInstitute/vis/pull/52))
- Biome linting with auto-fixes [DT-7060] ([#53](https://github.com/AllenInstitute/vis/pull/53))
- Dependency health configurations ([#17](https://github.com/AllenInstitute/vis/pull/17))
- Clean up dependencies [DT-7060] ([#55](https://github.com/AllenInstitute/vis/pull/55))
- Fix all but non-null assertion lints ([#96](https://github.com/AllenInstitute/vis/pull/96))

## [0.0.4] - 2025-02-03

### ⚙️ Miscellaneous Tasks

- Remove only-allow so builds stop failing ([#47](https://github.com/AllenInstitute/vis/pull/47))
- Version bumps for only-allow removal release ([#51](https://github.com/AllenInstitute/vis/pull/51))

## [0.0.3] - 2024-12-04

### 💼 Other

- Noah/documentation ([#46](https://github.com/AllenInstitute/vis/pull/46))

## [0.0.2] - 2024-12-02

### 💼 Other

- Noah/fix omezarr tile math mistake ([#45](https://github.com/AllenInstitute/vis/pull/45))

## [0.0.1] - 2024-11-20

### 💼 Other

- Ome-zarr slice-view renderer package ([#34](https://github.com/AllenInstitute/vis/pull/34))

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>
Co-authored-by: Skyler Moosman <8845503+TheMooseman@users.noreply.github.com>

<!-- generated by git-cliff -->
