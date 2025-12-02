---
editUrl: false
next: false
prev: false
title: "Logger"
---

Defined in: [packages/core/src/logger.ts:3](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/logger.ts#L3)

## Constructors

### Constructor

> **new Logger**(`name`, `level`): `Logger`

Defined in: [packages/core/src/logger.ts:7](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/logger.ts#L7)

#### Parameters

##### name

`string`

##### level

`LogLevel` = `'warn'`

#### Returns

`Logger`

## Methods

### debug()

> **debug**(`message`, ...`optionalParams`): `void`

Defined in: [packages/core/src/logger.ts:26](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/logger.ts#L26)

#### Parameters

##### message

`string`

##### optionalParams

...`unknown`[]

#### Returns

`void`

***

### dir()

> **dir**(`obj`, ...`optionalParams`): `void`

Defined in: [packages/core/src/logger.ts:33](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/logger.ts#L33)

#### Parameters

##### obj

`unknown`

##### optionalParams

...`unknown`[]

#### Returns

`void`

***

### error()

> **error**(`message`, ...`optionalParams`): `void`

Defined in: [packages/core/src/logger.ts:56](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/logger.ts#L56)

#### Parameters

##### message

`string`

##### optionalParams

...`unknown`[]

#### Returns

`void`

***

### info()

> **info**(`message`, ...`optionalParams`): `void`

Defined in: [packages/core/src/logger.ts:42](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/logger.ts#L42)

#### Parameters

##### message

`string`

##### optionalParams

...`unknown`[]

#### Returns

`void`

***

### setLevel()

> **setLevel**(`level`): `void`

Defined in: [packages/core/src/logger.ts:12](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/logger.ts#L12)

#### Parameters

##### level

`LogLevel`

#### Returns

`void`

***

### warn()

> **warn**(`message`, ...`optionalParams`): `void`

Defined in: [packages/core/src/logger.ts:49](https://github.com/AllenInstitute/vis/blob/cc93f342c456067cf88635c1dd3e1db92c5fef01/packages/core/src/logger.ts#L49)

#### Parameters

##### message

`string`

##### optionalParams

...`unknown`[]

#### Returns

`void`
