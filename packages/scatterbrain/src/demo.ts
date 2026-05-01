/** biome-ignore-all lint/suspicious/noNonNullAssertedOptionalChain: <its a demo> */
/** biome-ignore-all lint/style/noNonNullAssertion: <its a demo> */


import { SharedPriorityCache } from '@alleninstitute/vis-core';
import { Box2D, type vec4 } from '@alleninstitute/vis-geometry';
import { loadDataset } from './dataset';
import { buildRenderFrameFn, type ShaderSettings } from './render/webgpu/renderer';
import type { ScatterbrainDataset } from './types';

const tenx =
    'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json';

async function loadRawJson() {
    return await (await fetch(tenx)).json();
}
const makeFakeColors = (n: number) => {
    const stuff: Record<number, { color: vec4; filteredIn: boolean }> = {};
    for (let i = 0; i < n; i++) {
        stuff[i] = {
            color: [Math.random(), Math.random(), Math.random(), 1],
            // 80% of either category are filtered in, at random:
            filteredIn: Math.random() > 0.2,
        };
    }
    return stuff;
};

export async function whatever() {
    const gradientData = new Uint8Array(256 * 4);
    for (let i = 0; i < 256; i += 4) {
        gradientData[i * 4 + 0] = i;
        gradientData[i * 4 + 1] = i;
        gradientData[i * 4 + 2] = i;
        gradientData[i * 4 + 3] = 255;
    }
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter?.requestDevice()!;
    // buildTest(root.device)

    const categories = {
        '4MV7HA5DG2XJZ3UD8G9': makeFakeColors(40), // nt type
        FS00DXV0T9R1X9FJ4QE: makeFakeColors(40), // class
    };

    const settings: Omit<ShaderSettings, 'dataset'> = {
        categoricalFilters: { '4MV7HA5DG2XJZ3UD8G9': 40, FS00DXV0T9R1X9FJ4QE: 40 },
        colorBy: { kind: 'metadata', column: 'FS00DXV0T9R1X9FJ4QE' },
        // an alternative color-by setting, swap it to see quantitative coloring
        // colorBy: { kind: 'quantitative', column: '27683', gradient: 'viridis', range: { min: 0, max: 10 } },
        mode: 'color',
        quantitativeFilters: [],
        highlightByColumn: { kind: 'metadata', column: 'FS00DXV0T9R1X9FJ4QE' },
    };

    const dataset = await loadDataset(await loadRawJson());
    if (!dataset) {
        throw new Error('blerg this data is toast');
    }
    const cache = new SharedPriorityCache(new Map(), 1024 * 1024 * 2000);
    const { render, connectToCache } = buildRenderFrameFn(device, { ...settings, dataset });

    const cnvs: HTMLCanvasElement = document.getElementById('canvas') as HTMLCanvasElement;
    cnvs.width = 1500;
    cnvs.height = 1500;
    const ctx = cnvs.getContext('webgpu');
    ctx?.configure({
        device: device,
        format: navigator.gpu.getPreferredCanvasFormat(),
        alphaMode: 'premultiplied',
    });

    const bound = (dataset as ScatterbrainDataset).metadata.tightBoundingBox;
    const view = Box2D.create([bound.lx, bound.ly], [bound.ux, bound.uy]);
    const client = connectToCache(cache, () => {
        // redraw?
        // console.log('new data arrived...')
        requestAnimationFrame(() => {
            // biome-ignore lint/suspicious/noConsole: <this is a demo>
            console.log('re render!');

            render({
                categories,
                client,
                gradient: gradientData,
                target: ctx!.getCurrentTexture().createView(),
                uniforms: {
                    camera: { view, screenResolution: [1500, 1500] },
                    filteredOutColor: [0.5, 0.5, 0.5, 1.0],
                    highlightedValue: 22,
                    offset: [0, 0],
                    quantitativeRangeFilters: {},
                    spatialFilterBox: view,
                },
            });
        });
    });
    render({
        categories,
        client,
        gradient: gradientData,
        target: ctx!.getCurrentTexture().createView(),
        uniforms: {
            camera: { view, screenResolution: [1500, 1500] },
            filteredOutColor: [0.5, 0.5, 0.5, 1.0],
            highlightedValue: 22,
            offset: [0, 0],
            quantitativeRangeFilters: {},
            spatialFilterBox: view,
        },
    });
}
whatever();
