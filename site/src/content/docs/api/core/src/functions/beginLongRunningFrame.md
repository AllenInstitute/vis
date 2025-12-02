---
editUrl: false
next: false
prev: false
title: "beginLongRunningFrame"
---

> **beginLongRunningFrame**\<`Column`, `Item`, `Settings`\>(`maximumInflightAsyncTasks`, `queueProcessingIntervalMS`, `items`, `mutableCache`, `settings`, `requestsForItem`, `render`, `lifecycleCallback`, `cacheKeyForRequest`, `queueTimeBudgetMS`): `FrameLifecycle`

Defined in: [packages/core/src/render-queue.ts:54](https://github.com/AllenInstitute/vis/blob/7fbd4e84795d9f6d20552d268d9b60cdd55c5e79/packages/core/src/render-queue.ts#L54)

`beingLongRunningFrame` starts a long-running frame that will render a list of items asynchronously based on
the provided data, settings, and rendering functions.

The frame will run until all items have been rendered, or until the user cancels the frame. It will update the
provided cache so that the data is available for other frames that may be running. This function is safe to call
multiple times in different areas of your code, as it will complete quickly if/when all the data is already cached and available.

You can listen for the status of the frame, allowing you to make decisions based on the progress of the frame.

In addition, you can cancel the frame at any time, which will stop the frame from running and prevent any further
rendering or data fetching from occurring.

:::caution[Deprecated]
consider using beginFrame instead
:::

## Type Parameters

### Column

`Column`

### Item

`Item`

### Settings

`Settings`

## Parameters

### maximumInflightAsyncTasks

`number`

The maximum number of async tasks to run at once.

### queueProcessingIntervalMS

`number`

The length of time to wait between processing the queue in milliseconds.

### items

`Item`[]

An array of generic items to render

### mutableCache

[`AsyncDataCache`](/vis/api/core/src/classes/asyncdatacache/)\<`string`, `string`, `Column`\>

The asynchronous cache used to store the data

### settings

`Settings`

Flexible object of settings related to the items that are being rendered

### requestsForItem

(`item`, `settings`, `signal?`) => `Record`\<`string`, () => `Promise`\<`Column`\>\>

a function which returns a mapping of "columns" to async functions that would fetch the column

### render

(`item`, `settings`, `columns`) => `void`

The main render function that will be called once all data is available

### lifecycleCallback

`RenderCallback`

Callback function so they user can be notified of the status of the frame

### cacheKeyForRequest

(`requestKey`, `item`, `settings`) => `string`

A function for generating a cache key for a given request key, item, and settings. Defaults to the request key if not provided.

### queueTimeBudgetMS

`number` = `...`

the maximum ammount of time (milliseconds) to spend rendering before yeilding to allow other work to run - rendering will resume next frame (@param queueProcessingIntervalMS)

## Returns

`FrameLifecycle`

A FrameLifecycle object with a cancelFrame function to allow users to cancel the frame when necessary
