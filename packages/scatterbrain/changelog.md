# Changelog

All notable changes to this project will be documented in this file.

## [unreleased]

### 🐛 Bug Fixes

- Fix version display on changelogs and tweak scatterbrain package command

### 💼 Other

- Merge branch 'main' into lane/package-tag-changelogs
- Fmt

## [0.0.1] - 2026-02-11

### 🚀 Features

- Publishing documentation and config changes ([#3](https://github.com/AllenInstitute/vis/pull/3))
- Feat(vis) layered rendering demo ([#22](https://github.com/AllenInstitute/vis/pull/22))

* first step to layered rendering: one layer!

* bufferPair gets its own file in common/

* technically functional rendering of layers of ome-zarr slices and scatterplot points.

* dig up the old ccf average-template data... todo ask scott for better chunk-sizes!

* I can load a slide-view slide and the average_template ccf (ask scott for a better one) and show them togeather, although their dimensions suggest that they are radically different sizes

* get the dang things to line up by fixing all my goofy voxel math

* aaaaaaah what a wild bug

* a little less sloppy

* fun idea but breaks visibility determination

* generalize layers, build up convenience around frames, more formal types to be rendered

* a working (but somewhat confusing) generic layer (impl for scatterplots first)

* both layer types working

* delete half-baked approach

* pull out common stuff (target) from generic types to make things less confusing

* add a super basic annotation (just lines) renderer, wrap it in a layer thingy

* fix a lil slop

* minor changes as I prepare to add some sort of UI

* working but very strange imgui implementation... lets see if its nice

* add some UI - not in love withit

* draw after loading

* start to merge the two different zarr rendering methods

* less hacky way of picking an appropriate resolution, although its still a bit iffy...

* thinking about skipping ui and just having json state...

* super basic optional transforms for layers. next up a grid of these things

* add a volume grid layer, mild cleanup elsewhere

* draw data as it arrives - and prepend frames with low-res data to cover the pan case

* refactor various types and loaders to make it easier to configure an instance with a list of simple config payloads. separate data types from the code that would render them. updates to demo to use new loaders

* lets serve the app with parcel

* Get layers app Parcelized

* Noah/layers pt2 ([#23](https://github.com/AllenInstitute/vis/pull/23))

* delete ye olde build script

* add some react for UI - think about if I like it or it will make my life nice

* fix a perf bug in which we consider rendering every slice in a grid regardless of zoom level.
some (better?) smoke and mirrors trickery to try to obscure redraw flickering when panning/zooming

* working but messy impl of a worker pool that handles decoding zarr chunks for us

# Conflicts:
#	apps/layers/package.json

* play around with WW pool size, and fix a bug in which the optional render-working budget parameters were being ignored (for the slice renderer specifically)

* move a shocking amount of code in to render slide-view style annotations

# Conflicts:
#	apps/layers/package.json

* good enough for now

# Conflicts:
#	apps/layers/src/demo.ts

* respect queue params

* enable screenshots, with a default output resolution of roughly 85MP

# Conflicts:
#	apps/layers/package.json
#	apps/layers/src/demo.ts
#	pnpm-lock.yaml

* start thinking about upside down data...

* its all upside down now  great

* minor tidy, plus a rough attempt at a less flickery stand-in algorithm

* tools to add layers during demotime

# Conflicts:
#	apps/layers/src/demo.ts

* add a versa layer

* add scatterplot-slideview real quick

# Conflicts:
#	apps/layers/src/demo.ts

* start some cleanup so I can merge this...

# Conflicts:
#	apps/layers/src/demo.ts

* Merge branch 'noah/layered-demo' into noah/layered-with-react-whynot

# Conflicts:
#	apps/layers/src/demo.ts

* quickly change the underlying cache type for scatterplots for much better perf (gpu buffer not client-buffer)

* try out sds components for quick hacky ui fun - delete old ui code

* add a bunch of per-layer ui elements

* prev/next layer buttons

* take a snapshot button

* quickly re-enable drawing layers

* a bit hacky, but non-flickering drawings are worth it for a demo

* change moduleResolution in the apps tsconfig to make the zarr library that we use extensively get resolved correctly. this is an issue on their end: https://github.com/gzuidhof/zarr.js/issues/152

* cleanup some increasingly scary cherrypicks, and finally tidy up those last little demo ts errors.

* clean up a bunch of low hanging fruit

* fix up the scatterplot (standalone) demo

* readme and demo script

* a little more

* copy in the latest and greatest annotation stuff in

* minor cleanups

* fix wrongly named example

---------

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>

### 🐛 Bug Fixes

- Fix a mistake in cache logic, add a test ([#20](https://github.com/AllenInstitute/vis/pull/20))

* fix an issue with the dataset cache in which it does not behave properly if multiple semantic keys end up requiring the same cache key. TODO add a test case

* stub a test for this edge case

* unit test our fun scenario

* realized another potential bug as I was doing a self-review. we now more correctly handle pre-existing promises in the cache

* ! operator because we know that it exists

* PR feedback cleanup
- CI tests weren't running [DT-7060] ([#87](https://github.com/AllenInstitute/vis/pull/87))
- Remove non-null assertions ([#101](https://github.com/AllenInstitute/vis/pull/101))

### 💼 Other

- Super basic scatterbrain package
- Confirming I can import stuff from our workspace packages with full ts support, beggining work on a barebones omezarr renderer
- Working basic volumetric slice rendering. cleanup a bunch of oopsies in the tsconfigs.
- Implement a resolution-aware dataset layer picker, and a relative camera which is surprisingly nice
- When initializing the repo, names were changed, this fact was not reflected in imports vs. workspace packages.
- Turn on tsconfig verbatimmodulesyntax. delete super busted old demo.
add a base tsconfig for the others to extend - still a work in progress.
- Merge pull request [#1](https://github.com/AllenInstitute/vis/pull/1) from AllenInstitute/noah/cleanup-mistakes-during-repo-init

Noah/cleanup mistakes during repo init
- Dont hog the main thread - use a soft limit
- Update the version to accompany this PR, and two lil cleanups in the scatterbrain demo that got lost in the shuffle of everything
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
- Layered rendering util ([#24](https://github.com/AllenInstitute/vis/pull/24))

* well its a start

* apostrophy

* mostly just move ReglLayer2D over to packages, and make a minor change (that should hopefully be less surprising) to long-running-frame lifecycle callbacks

* bump the version
- DZI viewer component ([#29](https://github.com/AllenInstitute/vis/pull/29))

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>
- Flickery frames due to leaky event handling ([#36](https://github.com/AllenInstitute/vis/pull/36))
- Still flickery ([#37](https://github.com/AllenInstitute/vis/pull/37))
- Noah/documentation ([#46](https://github.com/AllenInstitute/vis/pull/46))
- March 2025 ([#99](https://github.com/AllenInstitute/vis/pull/99))
- Scatterbrain rendering in vis, including shader generation ([#223](https://github.com/AllenInstitute/vis/pull/223))

Co-authored-by: Lane Sawyer <lane.sawyer@alleninstitute.org>

### 🚜 Refactor

- Add JS Doc comments (and some minor refactor) ([#4](https://github.com/AllenInstitute/vis/pull/4))

### ⚙️ Miscellaneous Tasks

- Use Parcel to produce libraries ([#9](https://github.com/AllenInstitute/vis/pull/9))
- Chore - move code around to make writing new "apps" less repetative ([#16](https://github.com/AllenInstitute/vis/pull/16))

* move the furniture around - make it easier to share code between various "apps" - the scenario being that the code doesn't yet belong in published-packages, but might have common use in various demos. created a new spatial indexing sub-folder for the geometry package, and put our generic "quad"t tree in there (it can be a tree of any power-of-2 dimension)

* thinking about layers

* PR feedback, disable using the .parcel-cache when building
- Formatting ([#26](https://github.com/AllenInstitute/vis/pull/26))
- Update Scatterbrain Version ([#32](https://github.com/AllenInstitute/vis/pull/32))
- Pull request template [DT-5996] ([#38](https://github.com/AllenInstitute/vis/pull/38))
- Scatterbrain README tweaks ([#44](https://github.com/AllenInstitute/vis/pull/44))
- Remove only-allow so builds stop failing ([#47](https://github.com/AllenInstitute/vis/pull/47))
- Version bumps for only-allow removal release ([#51](https://github.com/AllenInstitute/vis/pull/51))
- Install Biome, fix formatting [DT-7060] ([#52](https://github.com/AllenInstitute/vis/pull/52))
- Biome linting with auto-fixes [DT-7060] ([#53](https://github.com/AllenInstitute/vis/pull/53))
- Dependency health configurations ([#17](https://github.com/AllenInstitute/vis/pull/17))
- Clean up dependencies [DT-7060] ([#55](https://github.com/AllenInstitute/vis/pull/55))
- Fix all but non-null assertion lints ([#96](https://github.com/AllenInstitute/vis/pull/96))
- Logger with log levels ([#97](https://github.com/AllenInstitute/vis/pull/97))
- Test coverage tooling ([#95](https://github.com/AllenInstitute/vis/pull/95))
- Update to v0.0.10 ([#111](https://github.com/AllenInstitute/vis/pull/111))
- Rename vis-scatterbrain package to vis-core ([#118](https://github.com/AllenInstitute/vis/pull/118))

<!-- generated by git-cliff -->
