## Whats up

So far, we've used the components in this library to successfully tackle some visualization problems, and we have a small collection of examples of how to render different types of data (DZI, OMEZARR, scatterplots, etc). The problems so far all tend to have the following characteristics:

1. Big data - the data is generally expected to be too big to download and render all at once - the general tool these data types use to combat this issue is:
2. Spatial Indexing - the data is subdivided into chunks, often the chunks are grouped into layers. Each layer will be more and more refined. By being subdivided spatially, a system can pull down just enough data to satisfy a particular view.
3. Cloud native - the data is housed online, chunked as described above. This creates a natural problem for rendering - high performance throughput graphics requires fast access (often needing it to be in memory on the GPU) for rendering.
4. Homogenous - so far, we tend to focus on visualizations of data that is big, but not complex - large scatter-plots are just "more dots", volumetric images are just many slices of images, etc. So far, we have not really engaged in multi-modal rendering.

Thats where this vis library comes in. So far, we've tackled this problem with two well placed structures: A Cache and a Queue. A client of this library fills in a simple interface that allows us to access the data in question, and then we use the queue to gloss over the asynchronous nature of the "cloud native" data, and also prevents us from blocking the main thread for too long, while the cache lets us manage resources over time. In return, we give the client a conceptually simple model back the idea of a single frame of rendering work - when complete, the job is done.

## Is that good?

I think this is where we've taken a bit of a misstep. The Frame we return is conceptually simple, but I think rather unwieldy in practice, due to some surprising complexity.

### Where does it hurt?

1. The returned frame represents the in-progress work of rendering, that rendering takes time, and we want to show something to the user right away.
2. The only thing you can do with a frame is cancel it. usually, a client does this because, for example, the camera moved, and now the things we want to draw are slightly different. Cancelling the frame can result in some wasted work - as cancelling the frame might cancel fetches that we're about to re-request (if the thing they fetched would be in view in the frame we are about to start).
3. The lifecycle callbacks from the frame are dangerous. From the render system's perspective, the client could do anything in response to these events, and whatever the client chooses to do will likely interrupt the rendering work.
4. There is no clear pattern for how to deal with multiple frames at once - several things can work, but its not generally easy to figure out how to proceed. Should the client keep 2 frames, and then compose their results later in a 3rd frame? Should the client make a renderer that can handle multiple types of data at once? doesnt that seem complicated?
5. Strict ordered rendering is in general, not possible - data that arrives will be rendered in the order of its arrival, unless you cancel the frame that initiated the fetch - its hard to think about.

## What have we learned?

What I see as the first step is to separate the queue that manages fetching, and the sequence of tasks that comprise rendering. I think we could make this change without much change to our abstraction over "what is a renderer". As of now, A client fills out this interface:

- `GetVisibleItems(dataset)->items[]`
- `DrawItem(dataset,item)=>void // effect: rendering`
- `FetchItem(dataset,item)=>Promise<RawData>`

And we return a "Frame" that conceptually, is this process:

`GetVisibleItems(dataset).map(item=>Cache.putAsync(item, fetchItem(item)).then(drawItem(cache.getItem(item))))`

If we start with just the first part - the cache - it seems reasonable to have a structure that manages the long-running process of fetching all the things we think we need:

`Prioritize(getVisibleItems(dataset))=>CacheWarmerThingy`

lets say we have a thing now, that represents fetching what we want to draw. I think its ok to acknowledge that its a stateful thing, that might change over time, as the fetches resolve into data:

`CacheWarmerThingy.onDataRecieved(callback)`

I think we can also say that it would give us piece of mind to be able to update this thing in place, so that we dont cancel work that we might just re-start immediately!<BR>
` // example: on camera change`<BR>
`CacheWarmerThingy.rePrioritize(getVisibleItems(dataset))`

Although it pains me to admit, we just cant render what we dont have in the cache. I think we can have a separate process, which may or may not be valuable to model as a queue (or perhaps just a synchronous call?). Either way, by separating these stages, we could now let the client write code that could have full control over the order in which to render, or what to do if something isn't in the cache.
<BR>
`buildRenderSequence(CacheWarmerThingy.cache, dataset, settings, etc...)=>items[]`<BR>

from there, we can dispatch those tasks, much like how its done in WebGPU etc.<BR>

`itemsToRender.map(item=>drawItem(cache.get(item)))`

this does put the client in more control, they could choose to pause or cancel as needed - lots of options open up when rendering is just data.
