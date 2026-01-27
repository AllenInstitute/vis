import REGL from "regl";
import { buildRenderFrameFn, buildScatterbrainCacheClient, buildScatterbrainRenderer, setCategoricalLookupTableValues } from "./src/renderer";
import { SharedPriorityCache } from '@alleninstitute/vis-core';
import { type ScatterbrainDataset } from "./src/types";
import { getVisibleItems, loadDataset } from "./src/dataset";
import { ShaderSettings } from "./src/shader";
import { vec4 } from "@alleninstitute/vis-geometry";

const twoGB = 1024 * 1024 * 2000;
const tenx = 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json'
async function begin() {
    console.log("hi from vite dev!")
    const canvas = document.getElementById('canvas') as HTMLCanvasElement
    canvas.width = 800;
    canvas.height = 800;
    const cache = new SharedPriorityCache(new Map(), twoGB, 10)
    // it would be more normal in a shared-cache setup to use an offscreen gl
    // canvas, and then copy the pixels out and over to the client of the cache
    // but this is a demo, so lets skip that step
    // const glcanvas = new OffscreenCanvas(10, 10);
    const gl = canvas.getContext('webgl', {
        alpha: true,
        preserveDrawingBuffer: false,
        antialias: true,
        premultipliedAlpha: true,
    });
    if (!gl) {
        throw new Error('WebGL not supported!');
    }
    const regl = REGL({
        gl,
        extensions: ['oes_texture_float']
    });
    const dataset = await (await fetch(tenx)).json()
    const yay: ScatterbrainDataset = loadDataset(dataset);
    const camera = { view: { minCorner: [-17, -17], maxCorner: [26, 26] }, screenResolution: [800, 800] } as const
    console.log('yay data!', yay)
    // in a real app - the shader settings changing could require a re-build of the renderer
    // compare prior settings to current, call build IF they change

    const makeFakeColors = (n: number) => {
        const stuff: Record<number, { color: vec4, filteredIn: boolean }> = {}
        for (let i = 0; i < n; i++) {
            stuff[i] = {
                color: [Math.random(), Math.random(), Math.random(), 1],
                // 80% of either category are filtered in, at random:
                filteredIn: Math.random() > 0.2
            }
        }
        return stuff;
    }
    // fake color and filter tables, as a demo:
    const categories = {
        '4MV7HA5DG2XJZ3UD8G9': makeFakeColors(40), // nt type
        'FS00DXV0T9R1X9FJ4QE': makeFakeColors(40) // class
    }
    const settings: ShaderSettings = {
        categoricalFilters: { '4MV7HA5DG2XJZ3UD8G9': 40, 'FS00DXV0T9R1X9FJ4QE': 40, },
        colorBy: { kind: 'metadata', column: "FS00DXV0T9R1X9FJ4QE" },
        // an alternative color-by setting, swap it to see quantitative coloring
        // colorBy: { kind: 'quantitative', column: '27683', gradient: 'viridis', range: { min: 0, max: 10 } },
        dataset: yay,
        mode: 'color',
        quantitativeFilters: [],
    }

    const lookup = regl.texture({ width: 10, height: 10, format: 'rgba' })
    const gradientData = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i += 4) {
        gradientData[i * 4 + 0] = i;
        gradientData[i * 4 + 1] = i;
        gradientData[i * 4 + 2] = i;
        gradientData[i * 4 + 3] = 255;
    }
    const gradient = regl.texture({ width: 256, height: 1, format: 'rgba', data: gradientData })

    // make up random colors for the coloring, and add random filtering

    setCategoricalLookupTableValues(categories, lookup)

    const render = buildRenderFrameFn(regl, settings);
    const doRender = () => {
        render({
            client,
            camera: { view: { minCorner: [-17, -17], maxCorner: [26, 26] }, screenResolution: [800, 800] },
            categoricalLookupTable: lookup,
            dataset: yay,
            filteredOutColor: [0, 0, 0, 1],
            gradient,
            hoveredValue: 22,
            offset: [0, 0],
            quantitativeRangeFilters: {},
            spatialFilterBox: { minCorner: [-17, -17], maxCorner: [30, 30] },
            target: null,
        })
    }
    const client = buildScatterbrainCacheClient(regl, cache, () => {
        requestAnimationFrame(doRender)
    });
    // start it off with a single render call
    doRender();
}

begin();