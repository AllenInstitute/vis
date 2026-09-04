# Changelog

All notable changes to this project will be documented in this file.

## [0.1.3] - 2026-08-31

### 🐛 Bug Fixes

- _(vis-core)_ Minor fix on inter-stage variables in the generated aggregation shader ([#296](https://github.com/AllenInstitute/vis/pull/296))

## [0.1.2] - 2026-08-27

### 💼 Other

- Noah/aggregation shader ([#294](https://github.com/AllenInstitute/vis/pull/294))

merging despite formatting issue in mdx file - the "formatted" markdown produces a webpage that has formatting issues for human readers.

### 🚜 Refactor

- _(deps)_ Replace lodash with lodash-es ([#288](https://github.com/AllenInstitute/vis/pull/288))

### ⚙️ Miscellaneous Tasks

- _(release)_ @alleninstitute/vis-core@0.1.2

## [0.1.1] - 2026-08-17

### 💼 Other

- Noah/refactor filtering ([#287](https://github.com/AllenInstitute/vis/pull/287))

### ⚙️ Miscellaneous Tasks

- _(release)_ @alleninstitute/vis-core@0.1.1

## [0.1.0] - 2026-08-07

### 🚀 Features

- Package tag changelog generation [DT-9260] ([#179](https://github.com/AllenInstitute/vis/pull/179))
- WebGPU shader builder for Vis Core [DC-9506] ([#259](https://github.com/AllenInstitute/vis/pull/259))
- Shader building now supports Vertex Inputs [DT-9715] ([#279](https://github.com/AllenInstitute/vis/pull/279))

### 🐛 Bug Fixes

- Allow Workers to be instantiated directly via callback ([#206](https://github.com/AllenInstitute/vis/pull/206))

### 💼 Other

- Slight changes to the CacheClient interface ([#253](https://github.com/AllenInstitute/vis/pull/253))
- Migrate linter from Biome to oxlint 1.73.0 ([#280](https://github.com/AllenInstitute/vis/pull/280))
- Webgpu-filtering ([#285](https://github.com/AllenInstitute/vis/pull/285))

### ⚙️ Miscellaneous Tasks

- _(deps)_ Bump @types/lodash from 4.17.19 to 4.17.20 ([#185](https://github.com/AllenInstitute/vis/pull/185))
- _(deps)_ Bump @biomejs/biome from 2.1.3 to 2.2.2 ([#190](https://github.com/AllenInstitute/vis/pull/190))
- Create standalone Priority Cache without fetching ([#199](https://github.com/AllenInstitute/vis/pull/199))
- Adding "type: module" to all packages ([#201](https://github.com/AllenInstitute/vis/pull/201))
- Adding in a caching multithreaded Fetch Store ([#200](https://github.com/AllenInstitute/vis/pull/200))
- Chore -cached loading (V3 omezarr support) step one ([#205](https://github.com/AllenInstitute/vis/pull/205))
- _(deps)_ Bump @types/lodash from 4.17.20 to 4.17.21 ([#215](https://github.com/AllenInstitute/vis/pull/215))
- _(deps)_ Bump lodash and @types/lodash ([#224](https://github.com/AllenInstitute/vis/pull/224))
- Update or remove dependencies ([#229](https://github.com/AllenInstitute/vis/pull/229))
- _(deps)_ Bump lodash and @types/lodash ([#236](https://github.com/AllenInstitute/vis/pull/236))
- NPM registry [DT-9193] ([#241](https://github.com/AllenInstitute/vis/pull/241))
- _(deps)_ Bump @biomejs/biome from 2.4.4 to 2.4.9 ([#245](https://github.com/AllenInstitute/vis/pull/245))
- Migrate to oxfmt ([#247](https://github.com/AllenInstitute/vis/pull/247))
- _(deps)_ Bump lodash from 4.17.23 to 4.18.1 ([#248](https://github.com/AllenInstitute/vis/pull/248))
- Update documentation for publishing and fix changelog formatting [DT-9260] ([#257](https://github.com/AllenInstitute/vis/pull/257))
- Remove packageManager since Volta manages the proper version ([#258](https://github.com/AllenInstitute/vis/pull/258))
- _(deps)_ Bump uuid from 13.0.0 to 14.0.0 ([#251](https://github.com/AllenInstitute/vis/pull/251))
- Reorganize WebGPU folders in Core [DT-9593] ([#264](https://github.com/AllenInstitute/vis/pull/264))
- _(deps)_ Bump uuid from 14.0.0 to 14.0.1 ([#272](https://github.com/AllenInstitute/vis/pull/272))
- _(release)_ @alleninstitute/vis-core@0.1.0

## [0.0.4] - 2025-07-14

### 🚀 Features

- Starlight Docs and Example Site ([#157](https://github.com/AllenInstitute/vis/pull/157))

### 🐛 Bug Fixes

- Color parsing supports hex strings without hash [135] ([#138](https://github.com/AllenInstitute/vis/pull/138))
- Export Logger class and raise default log level ([#160](https://github.com/AllenInstitute/vis/pull/160))

### 💼 Other

- A priority cache with a (better?) api ([#171](https://github.com/AllenInstitute/vis/pull/171))

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>

### ⚙️ Miscellaneous Tasks

- Add helpful linting rules ([#127](https://github.com/AllenInstitute/vis/pull/127))
- _(deps)_ Bump @types/lodash from 4.14.202 to 4.17.16 ([#153](https://github.com/AllenInstitute/vis/pull/153))
- _(deps)_ Bump @types/lodash from 4.17.16 to 4.17.17 ([#168](https://github.com/AllenInstitute/vis/pull/168))
- Dev command, reorganized docs, added stubs ([#163](https://github.com/AllenInstitute/vis/pull/163))
- _(deps)_ Bump @types/lodash from 4.17.17 to 4.17.19 ([#177](https://github.com/AllenInstitute/vis/pull/177))
- _(deps)_ Bump @biomejs/biome from 1.9.4 to 2.0.6 ([#174](https://github.com/AllenInstitute/vis/pull/174))

## [0.0.3] - 2025-04-23

### 💼 Other

- Noah/webworker decoders ([#126](https://github.com/AllenInstitute/vis/pull/126))

## [0.0.2] - 2025-04-08

### 🚀 Features

- Support for arbitrary color channels in OME-Zarr images [DC-530] ([#123](https://github.com/AllenInstitute/vis/pull/123))

### ⚙️ Miscellaneous Tasks

- Updates to package versions for Core, Geometry, OmeZarr + examples [DC-530] ([#124](https://github.com/AllenInstitute/vis/pull/124))

## [0.0.1] - 2025-04-04

### ⚙️ Miscellaneous Tasks

- Rename vis-scatterbrain package to vis-core ([#118](https://github.com/AllenInstitute/vis/pull/118))

<!-- generated by git-cliff -->
