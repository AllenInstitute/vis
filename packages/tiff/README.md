# @vis/tiff

A small browser package to decode TIFF images and render them with WebGPU (with a 2D canvas fallback).

Usage:

- Install in monorepo (pnpm):

```bash
pnpm add -w @vis/tiff
```

- Simple browser usage:

```ts
import { createTiffViewer } from '@vis/tiff';

const container = document.getElementById('viewer')!;
createTiffViewer(container, '/path/to/image.tiff');
```

Build:

```bash
pnpm -C packages/tiff install
pnpm -C packages/tiff build
```
