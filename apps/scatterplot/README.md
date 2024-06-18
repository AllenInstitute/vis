## Scatterplot demo

A demo of rendering a scatterplot using beginLongRunningFrame. The points in the scatterplot are spatially indexed using a quad-tree. The way the quad-tree is organized is based on [link](https://github.com/potree/potree).
specifically, rather than the usual situation in which a parent node in the tree contains a low-resolution replacement for its children's data, all data in all layers of the tree should be considered to be additive; rendering all points in every node of the whole tree at every level would display the original ground truth data. Much like the ome-zarr demo, we can use a few simple tools to allow us to request only the nodes which are currently in view (and take up enough pixels to be worth rendering), and render them as they arrive using the concept of a long-running frame.

### How to build / run

1. `pnpm build` from the root directory of this project
2. `pnpm install` in this directory
3. `pnpm run demo` in this directory - this will produce `dst/demo.html`
4. navigate to `dev/demo.html` and open it in your browser - its simply a static html page with a single js script import

### The Code

-- under construction come back later --
