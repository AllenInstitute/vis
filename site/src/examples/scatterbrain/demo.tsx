import type { vec2, vec4 } from '@alleninstitute/vis-geometry';
import { SharedCacheContext, SharedCacheProvider } from '../common/react/cache-provider';
import { useContext, useEffect, useRef, useState } from 'react';
import {
    buildWebGPUScatterbrainRenderFn,
    loadScatterbrainDataset,
    type Dataset,
    type ShaderSettings,
} from '@alleninstitute/vis-scatterbrain';

const screenSize: vec2 = [800, 800];
const tenx =
    'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json';
export function ScatterBrainDemo() {
    return (
        <SharedCacheProvider>
            <Demo screenSize={screenSize} />
        </SharedCacheProvider>
    );
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
// fake color and filter tables, as a demo:
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
};
async function loadRawJson() {
    return await (await fetch(tenx)).json();
}
type Props = { screenSize: vec2 };
function Demo(props: Props) {
    const { screenSize } = props;
    const cnvs = useRef<HTMLCanvasElement>(null);
    const cache = useContext(SharedCacheContext);
    const [dataset, setDataset] = useState<Dataset | undefined>(undefined);
    useEffect(() => {
        loadRawJson().then((raw) => setDataset(loadScatterbrainDataset(raw)));
    }, []);
    // todo handlers, etc
    useEffect(() => {
        // build the renderer
        if (cache && dataset && cnvs.current) {
            const gradientData = new Uint8Array(256 * 4);
            for (let i = 0; i < 256; i += 4) {
                gradientData[i * 4 + 0] = i;
                gradientData[i * 4 + 1] = i;
                gradientData[i * 4 + 2] = i;
                gradientData[i * 4 + 3] = 255;
            }
            const ctx = cnvs.current.getContext('webgpu');
            // make up random colors for the coloring, and add random filtering
            navigator.gpu.requestAdapter().then((adapter) => {
                const device = adapter?.requestDevice();
                ctx!.configure({
                    device: device,
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    alphaMode: 'premultiplied',
                });
                const { render, connectToCache } = buildWebGPUScatterbrainRenderFn(device, {
                    ...settings,
                    dataset,
                    highlightByColumn: { kind: 'metadata', column: '4MV7HA5DG2XJZ3UD8G9' },
                });
                const renderOneFrame = () => {
                    render({
                        client,
                        categories,
                        gradient: gradientData,
                        target: ctx?.getCurrentTexture().createView(),
                        uniforms: {
                            camera: {
                                view: { minCorner: [-17, -17], maxCorner: [26, 26] },
                                screenResolution: [800, 800],
                            },
                            filteredOutColor: [0, 0, 0, 1],
                            highlightedValue: 22,
                            offset: [0, 0],
                            quantitativeRangeFilters: {},
                            spatialFilterBox: { minCorner: [-17, -17], maxCorner: [30, 30] },
                        },
                    });
                };
                const client = connectToCache(cache, renderOneFrame);
                renderOneFrame();
            });
        }
    }, [dataset, cache, screenSize]);
    return <canvas ref={cnvs} width={screenSize[0]} height={screenSize[1]} />;
}
