## Whats up

So far, we've used the components in this library to successfully tackle some visualization problems, and we have a small collection of examples of how to render different types of data (DZI, OMEZARR, scatterplots, etc). The problems so far all tend to have the following characteristics:

1. Big data - the data is generally expected to be too big to download and render all at once - the general tool these data types use to combat this issue is:
2. Spatial Indexing - the data is subdivided into chunks, often the chunks are grouped into layers. Each layer will be more and more refined. By being subdivided spatially, a system can pull down just enough data to satisfy a particular view.
3. Cloud native - the data is housed online, chunked as described above. This creates a natural problem for rendering - high throughput graphics requires fast access (often needing it to be in memory on the GPU) for rendering.
4. Homogenous - so far, we tend to focus on visualizations of data that is big, but not complex - large scatter-plots are just "more dots", volumetric images are just many slices of images, etc. So far, we have not really engaged in multi-modal rendering.

Thats where this vis library comes in. So far, we've tackled this problem with two well placed structures: A Cache and a Queue. A client of this library fills in a simple interface that allows us to access the data in question, and then we use the queue to gloss over the asynchronous nature of the "cloud native" data. Using a queue also prevents us from blocking the main thread for too long, while the cache lets us manage resources over time. In return, we give the client a "Frame". A Frame is a cancellable object that represents the progress of rendering the requested data.

## Is that good?

I think this is where we've taken a bit of a misstep. The "Frame" we return is conceptually simple, but I think rather unwieldy in practice, due to some surprising complexity.

### Where does it hurt?

1. The returned frame represents the in-progress work of rendering, that rendering takes time, and we want to show something to the user right away.
2. The only thing you can do with a frame is cancel it. usually, a client does this because, for example, the camera moved, and now the things we want to draw are slightly different. Cancelling the frame can result in some wasted work - as cancelling the frame might cancel fetches that we're about to re-request (if the thing they fetched would be in view in the frame we are about to start).
3. The lifecycle callbacks from the frame are dangerous. From the render system's perspective, the client could do anything in response to these events, and whatever the client chooses to do will likely interrupt the rendering work. We could make the lifecycle callbacks asynchronous, but then they are much less useful - often a frame could be over before the "begin" message is sent.
4. There is no clear pattern for how to deal with multiple frames at once - several things can work, but its not generally easy to figure out how to proceed. Should the client keep 2 frames, and then compose their results later in a 3rd frame? Should the client make a renderer that can handle multiple types of data at once? doesnt that seem complicated?
5. Strict ordered rendering is in general, not possible - data that arrives will be rendered in the order of its arrival.

## What have we learned?

What I see as the first step is to separate the queue that manages fetching, and the sequence of tasks that comprise rendering. I think we could make this change without much change to our abstraction over "what is a renderer". As of now, A client fills out this interface:

- `GetVisibleItems(dataset)->items[]`
- `DrawItem(dataset,item)=>void // effect: rendering`
- `FetchItem(dataset,item)=>Promise<RawData>`

And we return a "Frame" that conceptually, is this process:

```
GetVisibleItems(dataset).map(
    item=>Cache.putAsync(item, fetchItem(item))
    .then(
        drawItem(cache.getItem(item))))
```

I think in retrospect, the behavior of these frames solves the wrong problem. The way its set up, the client is guaranteed to see each requested item once, eventually, even if the cache cant hold all the requested items for a single frame. Even though it is expected for the dataset as a whole to greatly exceed the size of the cache, its very unlikely that the data to render a single frame will! If you assume the cache can hold an entire frame (or more likely, the frames for several views of data), then that guarantee is essentially useless.

Consider these two use cases:

1. an interactive view of data, at a normal monitor resolution.
2. A super-high resolution screenshot of the same data.

The optimal path for these two use-cases are very different. In case #1, we can assume we have more than enough cache-space to hold the entire view, and we'd like to prioritize interactive framerates. We have no idea where the user will look next, so conservative pre-caching can be useful. Case #2 is actually best served by the `BeginFrame(...)=>FrameLifecycle` system - We'd like to render each chunk of data as soon as it arrives, and once we use it, we never need it again. Its also much more likely that the data to serve the job could exceed our limits.

As another example, consider rendering dots over top of a volumetric slice. There are a number of considerations:<BR>

1. its likely the dots and the image are different data sets. that means each needs its own renderer, fetcher, and visibility query function.
2. lets say you make 2 frames, one for each type of data (dots and voxels). as soon as you create a frame, it begins, synchronously rendering any data thats already in the cache. it now becomes difficult to coordinate between the two types - your only real option is to only start the dots frame when you finish the voxels frame, or build a compound renderer that handles both data types at once.
3. this means your choices are to build a compound renderer, which is unfortunately rather awkward, or have very course, poor control over the sequence in which items are rendered.

<BR>
I think the main fix here is to separate the cache from the rendering sequence process. If you assume the cache has data, you can write something very simple:

```
for(item in getVisibleItems(dataset)) {
    renderIfCached(cache.get(item))
}
```

this is simple, and quite flexible - even for multiple data types: <BR>

```
const voxels = getCachedItems(cache, visibleTiles)
const dots = getCachedItems(cache, visibleDots)
// ...any conceivable array trickery to re-order / mix the above arrays...
sequencedItems.forEach(item=>renderer[item.type](item))
```

This actually helps us solve another pain point - cache / fetch thrashing between frames (see "Where does it hurt" #2). If cache management is separate from render sequencing, we could do something like this:

```
cache.Prioritize(visibleItems)
```

which could be stateful - that is to say, it could track the overlap between the new priorities and the old, thus preventing cancelling fetches prematurely. It also opens the door for pre-fetching:

```
cache.Prioritize(...visibleItems_inSlice_N_, ...Slice_N_minus_one, ...Slice_N_plus_one)
```
