import REGL from "regl";
import { buildScatterbrainRenderer } from "./src/better/renderer";
import { SharedPriorityCache } from '@alleninstitute/vis-core';
import { type ScatterbrainDataset } from "./src/better/types";
import { loadDataset } from "./src/better/dataset";

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
    console.log('yay data!', yay)
    const render = buildScatterbrainRenderer(regl, cache, canvas)
    render({
        camera: { view: { minCorner: [0, 0], maxCorner: [10, 10] }, screenResolution: [800, 800] },
        categoricalFilters: {},
        colorBy: { kind: 'quantitative', column: '27683', gradient: 'viridis', range: { min: 0, max: 10 } },
        dataset: yay,
        quantitativeFilters: {},
    })
}

begin();