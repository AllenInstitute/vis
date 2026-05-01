tiff example

Steps to run:

1. From repo root build the package:

```bash
pnpm -w install
pnpm -C packages/tiff build
```

2. Serve the example folder with any static server (e.g. `npx serve` or `python -m http.server`):

```bash
cd packages/tiff/example
npx serve .
# or
python -m http.server 8000
```

3. Open the served `index.html` and update `sample.tiff` in `main.js` to point to a real TIFF file.
