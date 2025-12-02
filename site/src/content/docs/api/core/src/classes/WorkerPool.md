---
editUrl: false
next: false
prev: false
title: "WorkerPool"
---

Defined in: [packages/core/src/workers/worker-pool.ts:31](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/workers/worker-pool.ts#L31)

## Constructors

### Constructor

> **new WorkerPool**(`size`, `workerInit`): `WorkerPool`

Defined in: [packages/core/src/workers/worker-pool.ts:37](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/workers/worker-pool.ts#L37)

#### Parameters

##### size

`number`

##### workerInit

[`WorkerInit`](/vis/api/core/src/type-aliases/workerinit/)

#### Returns

`WorkerPool`

## Methods

### destroy()

> **destroy**(): `void`

Defined in: [packages/core/src/workers/worker-pool.ts:57](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/workers/worker-pool.ts#L57)

Warning - nothing in this class should be considered useable after
calling this method - any/all methods called should be expected to be
completely unreliable. dont call me unless you're about to dispose of all references to this object

#### Returns

`void`

***

### getStatus()

> **getStatus**(`workerIndex`): `WorkerStatus`

Defined in: [packages/core/src/workers/worker-pool.ts:149](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/workers/worker-pool.ts#L149)

#### Parameters

##### workerIndex

`number`

#### Returns

`WorkerStatus`

***

### getStatuses()

> **getStatuses**(): `ReadonlyMap`\<`number`, `WorkerStatus`\>

Defined in: [packages/core/src/workers/worker-pool.ts:164](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/workers/worker-pool.ts#L164)

#### Returns

`ReadonlyMap`\<`number`, `WorkerStatus`\>

***

### submitRequest()

> **submitRequest**(`message`, `responseValidator`, `transfers`, `signal?`): `Promise`\<[`WorkerMessageWithId`](/vis/api/core/src/type-aliases/workermessagewithid/)\>

Defined in: [packages/core/src/workers/worker-pool.ts:96](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/workers/worker-pool.ts#L96)

#### Parameters

##### message

[`WorkerMessage`](/vis/api/core/src/type-aliases/workermessage/)

##### responseValidator

`MessageValidator`\<[`WorkerMessageWithId`](/vis/api/core/src/type-aliases/workermessagewithid/)\>

##### transfers

`Transferable`[]

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`WorkerMessageWithId`](/vis/api/core/src/type-aliases/workermessagewithid/)\>
