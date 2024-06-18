## Ome-Zarr Viewer Demo

a very minimal demo to show how one might use the scatterbrain package to render volumetric images contained in an OME-zarr "File". Note that the datasets in the demos (there are 2) are hard-coded to some data in public S3 buckets.

### Versa

to run the versa demo, assuming you've just cloned this repository:

1. run `pnpm build` from the root directory
2. run `pnpm install` in this (apps/omezarr-viewer/) directory
3. run `pnpm run versa` in this directory
4. navigate to apps/omezarr-viewer/dst/ using your File browser / finder, and open `versa.html` in your browser.
5. why do it this way? Because this is a demo! no servers, hot-module reloading, nothing fancy - just a single html file that loads a rather large (~3MB) static JS bundle.

The app will load, and immediately begin requesting chunks from the versa dataset - you should be able to pan and zoom with the scroll-Wheel / mouse, and you should see a very basic set of UI controls. The versa dataset is a multi-channel "sequence of images" modality - so a list of available slices will be displayed, allowing the user to click on one to view it. RGB channels can be manipulated individually.

#### For developers

if you are interested in the code - you can start at the top: versa.ts contains the top-level glue code (its rather... demo-y! apologies for that - you should understand that this area of code is not "the point" - its just a short, easy-to-write harness for the good stuff) that makes the whole thing run. The interesting parts are probably in the neighborhood of `renderFrameHelper(...)`. The pattern we're looking for is: </br>

1. get the chunks of data (or rather, handles to that data) which are in view with `getVisibleTiles`
2. create a frame to render those tiles, using the current view & other settings, using `beginLongRunningFrame`
3. now you have an object (we call it a frame) that represents rendering progress - you can cancel the frame, put it in a list, create a promise to do something when its over, whatever you like! the point is that it is a first class entity which lets you abstract away a great deal of uncertainty and complexity. As long as you targeted a private render target, nothing else that happens in the app can have any impact on the image being rendered by this frame.
4. Still reading? you might be interested in the "plugin-style" renderer which actually renders chunks of ome-zarr data - take a look at `versa-renderer.ts` which contain the "strategy" components of rendering:
   </br>
   a. given a "camera" and a dataset, get me all the tasks (in our case, chunks of images) for what is in view: `getVisibleTiles`
   b. given a handle to a "chunk" fetch the chunk and associate it with how it will be used during rendering: `requestsForTile()`
   c. given fully-fetched data for a tile, render it! `buildVersaRenderer` - in this case we use [REgl](https://github.com/regl-project/regl/blob/master/API.md), an excellent WebGL abstraction layer, but the point of this plug-ability is that any user of the scatterbrain components may use whatever low-level rendering system (or data format) they prefer!

### Tissuecyte

to run the Tissuecyte demo, assuming you've just cloned this repository:

1. run `pnpm build` from the root directory
2. run `pnpm install` in this (apps/omezarr-viewer/) directory
3. run `pnpm run tissuecyte` in this directory
4. navigate to apps/omezarr-viewer/dst/ using your File browser / finder, and open `tissuecyte.html` in your browser.

The app will load, and immediately begin requesting chunks from the tissuecyte dataset - you should be able to pan and zoom with the scrollwheel / mouse, and you should see a very basic set of UI controls. The tissuecyte dataset is a "Volume" mode dataset - you get a single channel (gray-scale), and you can scroll through slices of the volume with Alt+Scroll, or use the slider in the UI. Note that in both demos, very little work was done to provide a "production ready" experience - the screen will go black in places where data it needs to render is not yet available, it may be flickery. In particular, the limit on cache memory is quite low, so delays while waiting for data to be (re) downloaded are to be expected.
