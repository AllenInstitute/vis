
# Scatterbrain

rendering utilities to render scatter plots, with specific support for 'scatterbrain' style (quad-tree spatial indexed) data sources as used for years now in ABC-atlas

## Why? ##

We wrote the ABC-atlas version of Scatterbrain rendering in a hot hot hurry a few years ago. At the time, we were preparing for a lot of variation along certain paths of development,
and as is often the case, those guesses were a bit off the mark. As a result, the flexibility points we built into that version are not helping us much. For example, we take great pains to
generate shaders with readable "column names" as users select different filter settings. However, for reasons, the names are just referenceIds from the backend, and we really never bother to debug the shaders in that way - they either fail up-front, or work fine, or are broken in more subtle ways that tend to have nothing to do with the names of the data.

## What is the goal here? ##

The goal is to modernize and simplify the WebGL powered features of ABC-atlas. We'd like to be able to understand the management of rendering resources, have more comprehensible interop
with the rest of the React UI system, and in general reduce the confusingly generic (and needlessly generic) nature of various parts, as well as having less verbose and weird areas around
the actual features we did build (but didn't really prepare for) like:

hovering to report cell-info to the rest of the system
multiple gene coloring / filtering
slide-view / regular view

to this end, we are gonna stick to the Renderer<> interface as given in packages/core/src/abstract/types.ts. We've seen that work with both the somewhat Ill-fated renderServer, as well as the new shared-cache
stuff, so it seems like it might be ok.
