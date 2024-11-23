# How To use generic rendering tools for your cool data

## Use case

Lets say you have a big dataset, and you'd like to view it and also interact with that view. The dataset is big enough that having your users download the whole thing is prohibitive. Often, datasets like this are partitioned in some way -- for example, [OME-ZARR](https://ngff.openmicroscopy.org/latest/) uses a pyramid of chunks, where each successive "layer" of the pyramid is a higher resolution view of the data, divided into chunks or tiles.

Whichever way your data is subdivided, we should be able to start with a renderer for the smallest, simplest unit (a single tile or chunk) and build up from there. The tools in this folder provide patterns for dealing with two common issues: caching chunks, and coordinating render scheduling when the data lives elsewhere.

## Walkthrough

### Prerequisites

1. Your application will render the dataset with [REGL](https://github.com/regl-project/regl/tree/master) and you have some familiarity with its basic concepts and verbiage (framebuffer, command, etc.)
2. You have data that is partitioned in some way, preferably spatially.

### Part 1: The Async Renderer

Lets start with scheduling first. Our goal is to be able to call the function `buildAsyncRenderer` from `async-frame.ts`. Its signature is:

> `function buildAsyncRenderer<Dataset, Item, Settings, SemanticKey extends string, CacheKeyType extends string, GpuData extends Record<SemanticKey, ReglCacheEntry>>(renderer: Renderer<Dataset, Item, Settings, GpuData>)`

It takes only a single argument, `Renderer`, but that argument is highly generic. `Renderer` is an interface that you will use to describe your data. The generic parameters end up being fairly simple:

1. `Dataset` is the type of the whole thing you're rendering, e.g. a large tiled image or volume. Because we're assuming the dataset is remote, it need not be literally the dataset; often it's just basic metadata and a URL.

2. `Item` is the type of a renderable subdivision, e.g. a tile or small chunk. Again, it need not be the literal pixels, triangles, whatever! A placeholder (e.g. a path from the main url where the data lives) is great.

3. `Settings` is a general bucket for things that dont change for a complete view -- think camera angles, point sizes, color settings, etc.

4. `SemanticKey` and `CacheKey` -- ignore these for the moment, we'll address them later. For now, just think "string".

5. `GpuData` -- this is probably a bad name. As you will see later, we're going to write a function that looks like `renderItem(dataset, item, settings, gpuData)`. When we get there, gpuData will be a collection of entries from our cache.

Don't worry too much about planning these parameters out in advance -- they'll arise naturally as we write the functions that form the interface of the Renderer that we pass to `buildAsyncRenderer`.

### Part 2: Defining the Renderer Interface

Lets take a look at the Renderer interface items, one at a time. Each describes something the framework needs in order to be able to manage rendering properly:

1. `getVisibleItems`, when given a `Dataset` and `Settings`, returns an array of Items that are in view. After all, the first step of any good renderer is knowing the minimum amount of work to do! Given this, your application's "Camera" -- whatever form that may take -- should be represented in your `Settings` object.
2. `fetchItemContent`, when given a single `Item` (and `Dataset` and `Settings`, of course), returns functions that fetch the raw, renderable data that an `Item` represents. In many cases, this could be very simple: for example, `return {pixels: ()=>${dataset.url}/${item.path}.jpg}` would be quite reasonable! This interface is shaped to support "columnar" data: imagine rows in a database describing cells, where the columns of the table contain X and Y positions, and perhaps colors or other measurements. In this analogy, an `Item` is a group of rows of the table, and what is returned would be a `SELECT` of each column of interest to the renderer.
3. `isPrepared` is a simple convenience feature. Because the system supports independent, cacheable columns, it can be awkward in the final step to render; you end up with a bunch of boilerplate to prove to Typescript that you have all the data! `isPrepared` is a [type guard](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates) that helps make working with the data from the cache slightly more tidy.
4. `renderItem` is the main event! Given a buffer to render to, and everything about the `Item` you're rendering, `renderItem` actually does the drawing. This usually involves calling one (or more!) REGL commands with the given target buffer and cached GPU data.
5. `cacheKey` tells the cache system how to uniquely identify any data it fetches. What makes sense here will depend on the nature and structure of your data. Make sure this is a pure function of its input!
6. `destroy` is used to release any resources you allocated (excluding cache data!), e.g. GPU resources, lookup tables, textures, etc.

Think of the flow of rendering like this:

> `getVisibleItems(dataset).map(item => Promise.all(fetchItemContent(item).map(fetcher => fetcher())).then((gpuData) => renderItem(dataset, item, gpuData))`

### Part 3: Now make it easy

That was fun! Now we can finally call `buildAsyncRenderer` on an object containing the functions we just wrote. Typescript will likely infer the generic types for you. The result of `buildAsyncRenderer` is a function that, when called, returns a handle to a running frame, which represents the progress of rendering to the given framebuffer. Because the data my not be in the cache yet, this frame may take a very long time to complete. Options are provided for cancelling a frame, as well as for listening to different events from the frame, such as progress events, finished events, etc.

## Using it on a Page

Now that we have a function that can render, how do we deploy it? There are a few options. 

The first is the most direct: create a `Canvas`, initialize WebGL and REGL on that canvas, then repeatedly call your renderer in response to suitable events, such as when the camera moves. The catch here is that GPU resources are bound to this `Canvas`, and cannot be shared with other canvases. Often, this is a non-issue: you have a single page with a single view of big data, and you're done. If this is the case for you, feel free to stop reading; the remainder of this document will be focused on other use cases. 

If you need multiple views of potentially shared data, you can use the `render-server`, which lets you draw to many `Canvas` instances as though they shared a single WebGL context and cache. This will incur a small performance penalty when copying rendered results from the server to the client. However, in practice, for a handful of views, this cost will be dwarfed by other bottlenecks.

### Walkthrough

1. Create a `RenderServer` instance. It will create its own REGL context, cache, and offscreen canvas.
2. Create your `AsyncRenderer` as described earlier in this document. You must use `server.regl` to construct your renderer.
3. Build your `Canvas` component with access to a reference to this shared server. When its time to render a frame, call `server.beginRendering()`. This function requires a wrapper around your `AsyncRenderer`, a callback for handling Render frame lifecycle events, and a reference to the Client `Canvas` (where you want the rendering to appear when its done).
4. Now you will need to prepare your render function wrapper. Because the server is generic, and could be shared between renderers of different data types, it can't really know about a particular renderer's dataset types. We could make opaque placeholder types, but those are often confusing. Instead, you can simply wrap your renderer like so: 
> `const wrapper = (target, cache, callback) => myFancyAsyncRenderer(myDataset, mySettings, callback, target, cache)`
5. Next up is the callback. At minimum, you must at some point handle an event (for example, the `finished` event) by copying the results of the rendering to the client, like so: `if (event.status == 'finished') { event.server.copyToClient(compose); }`. As you can see, how the pixels get to the client can be controlled by authoring a `compose` function. This function is given the 2D rendering [context](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D) on which to draw, and an [ImageData](https://developer.mozilla.org/docs/Web/API/ImageData) object representing the pixels rendered by REGL. In our testing, the most performant (over all browsers tested) way to deal with this is `context.putImageData(imageData, 0, 0)`.
