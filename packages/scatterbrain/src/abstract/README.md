# How To use generic rendering tools for your cool data

## Use case

Lets say you have a big dataset, and you'd like to view it and interact with that view. The dataset is big enough that having your users download the whole thing is prohibitive. Often, datasets like this are partitioned in some way - [OME-ZARR](https://ngff.openmicroscopy.org/latest/) as an example, uses a pyramid of chunks - each successive "layer" of the pyramid is a higher resolution view of the data, and is divided into chunks or tiles.

However your data is subdivided, we should be able to start with a renderer for the smallest, simplest unit (a single tile or chunk) and build up from there - the tools in this folder provide patterns for dealing with two common issues - caching chunks, and coordinating render scheduling when the data lives elsewhere.

### Walkthrough

#### prerequisites

1. you plan to do your rendering with [reGL](https://github.com/regl-project/regl/tree/master) and you have some familiarity with its basic concepts and verbage (framebuffer, command, etc.)
2. you have data that is partitioned in some way, preferably spatially.

Lets start with scheduling first. Our goal is to be able to call the function `buildAsyncRenderer` from `async-frame.ts`. Its signiture is thus:
`function buildAsyncRenderer<Dataset, Item, Settings, SemanticKey extends string, CacheKeyType extends string, GpuData extends Record<SemanticKey, ReglCacheEntry>>(renderer: Renderer<Dataset, Item, Settings, GpuData>)`

It takes only a single argument, `Renderer`, but that argument is highly generic. Renderer is an interface that you will use to describe your data. The generic parameters end up being fairly simple:

1. `Dataset` is the type of the whole thing you're rendering - for example a large tiled image or volume. Because we're assuming the dataset is remote, it need not be literally the dataset - often its just basic metadata and a URL.

2. `Item` is the type of a renderable subdivision - a tile or small chunk. Again, it need not be the literal pixels, triangles, whatevers! A placeholder (e.g. a path from the main url where the data lives) is great.

3. `Settings` - a general bucket for things that dont change for a complete view - think camera angles, point sizes, color settings, etc.

4. `SemanticKey` and `CacheKey` - ignore these for now - just think "string".

5. `GpuData` - this is probably a bad name. As you will see later, we're going to write a function that looks like `renderItem(dataset, item, settings, gpuData)`. when we get there, gpuData will be a collection of entries from our cache.

Even though I just described these, they dont need to be planned out in advance or anything - they'll arise naturally as we write the functions that form the interface of the Renderer we're trying to build to pass to `buildAsyncRenderer`.

### Renderer Interface

Lets take a look at the Renderer interface items, one at a time. Each describes something the framework needs to be able to manage rendering properly, and they tend to be simple:

1. `getVisibleItems` - the first step of any good renderer is knowing the minimum amount of work to do! Given a Dataset and some Settings, return an array of Items that are in view. This is a strong hint that whatever concept of a "Camera" that makes sense should be in your settings object.
2. `fetchItemContent` - given a single item (and dataset and settings of course), return functions that fetch the raw, renderable data that an Item represents. In many cases, this could be very simple:
   `return {pixels: ()=>${dataset.url}/${item.path}.jpg}` would be reasonable! the shape of this interface is this way to support "Columnar" data - imagine rows in a database describing cells - the columns of the table contain X and Y positions, and perhaps colors or other measurements. In this analogy, an Item is a group of rows of the table, and what is returned would be a `SELECT` of each column of interest to the renderer.
3. `isPrepared` is a simple convenience feature - because the system supports independant, cacheable columns, it can be awkward in the final step to render - you end up with a bunch of boilerplate to prove to Typescript that you have all the data! `isPrepared` is a [type guard](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates) that helps make working with the data from the cache slightly more tidy.
4. `renderItem` Is the main event! given a buffer to render to, and everything about the Item you're rendering, actually do the drawing. This usually involves calling one (or more!) reGL commands with the given target buffer and cached gpu data.
5. `cacheKey` - the cache system needs to know how to uniquely identify any data it fetches. What makes sense here will depend on your data entirely. Make sure this is a pure function of its input!
6. `destroy` - if you allocated (excluding cache data!) any resources, particularly GPU resources, you can release them here, think lookup tables or textures, etc.

Think of the flow of rendering like this:

`getVisibleItems(dataset).map(item=>Promise.awaitAll(fetchItemContent(item).map(fetcher=>fetcher())).then(gpuData)=>renderItem(dataset,item,gpuData))`

### Now make it easy

That was fun! now we can finally call `buildAsyncRenderer` on an object containing the functions we just wrote. TS will likely infer the generic types for you. The result of buildAsyncRenderer is a function that when called, will return a handle to a running frame which represents progress rendering to the given framebuffer. Because the data my not be in the cache yet, this frame may take a very long time to complete, and thus, there are options for cancelling it, as well as responding to various events (begin, progress, finished, etc).

## Using it on a page

Now that we have a function that can render, how do we deploy it? there are a few options. The first is the most direct - create a canvas, initialize WebGL and REGL on that canvas, then repeatedly call your renderer in response to events (move the camera, etc). The catch here is that GPU resources are bound to this canvas, and cannot be shared with other canvases. Often, this is a non-issue: you have a single page with a single view of big data, and your done. If so, feel free to stop reading. If however, you need multiple views of potentially shared data, you can use the render-server, which lets you draw to many canvases as though they shared a single WebGL context and cache. This will incur a small performance penalty when copying rendered results from the server to the client - in practice for a handful of views, this cost will be dwarfed by other bottlenecks.

### Walkthrough

1. Create a RenderServer instance. It will create its own reGL context, cache, and offscreen canvas.
2. Create your AsyncRenderer as described earlier in this document, you must use `server.regl` to construct your renderer.
3. Build your canvas component with access to a reference to this shared server. When its time to render a frame, call `server.beginRendering`. This function requires a wrapper around your Async Renderer, a callback for handling Render frame lifecycle events, and a reference to the Client canvas (where you want the rendering to appear when its done).
4. The first issue will be the render function wrapper - because the server is generic, and could be shared between renderers of different datatypes, it cant really know about a particular renderer's dataset types. We could make opaque placeholder types, but those are often confusing. Instead, you can simply wrap your renderer like so:
   `const wrapper = (target,cache,callback)=>myFancyAsyncRenderer(myDataset, mySettings, callback,target,cache)`
5. Next up is the callback. At minimum, you must at some point handle an event (for example, the `finished` event) by copying the results of the rendering to the client, like so: `if(evnt.status == 'finished') evnt.server.copyToClient(compose)`. As you can see, how the pixels get to the client can be controlled by authoring a `compose` function. This function is given the 2D rendering [context](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D) on which to draw, and an [ImageData](https://developer.mozilla.org/docs/Web/API/ImageData) object representing the pixels rendered by reGL. In our testing, the most performant (over all browsers tested) way to deal with this is `context.putImageData(imageData, 0,0)`
