import type { vec2, vec4 } from '@alleninstitute/vis-geometry';
import { SharedCacheContext, SharedCacheProvider } from '../common/react/priority-cache-provider';
import { useContext, useEffect, useRef, useState } from 'react';
import {
    buildScatterbrainRenderFn,
    loadScatterbrainDataset,
    setCategoricalLookupTableValues,
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
    const server = useContext(SharedCacheContext);
    const [dataset, setDataset] = useState<Dataset | undefined>(undefined);
    useEffect(() => {
        loadRawJson().then((raw) => setDataset(loadScatterbrainDataset(raw)));
    }, []);
    // todo handlers, etc
    useEffect(() => {
        // build the renderer
        if (server && dataset && cnvs.current) {
            const ctx = cnvs.current.getContext('2d');
            const { cache, regl } = server;
            const lookup = regl.texture({ width: 10, height: 10, format: 'rgba' });
            const gradientData = new Uint8Array(256 * 4);
            for (let i = 0; i < 256; i += 4) {
                gradientData[i * 4 + 0] = i;
                gradientData[i * 4 + 1] = i;
                gradientData[i * 4 + 2] = i;
                gradientData[i * 4 + 3] = 255;
            }
            const gradient = regl.texture({ width: 256, height: 1, format: 'rgba', data: gradientData });
            const tgt = regl.framebuffer(screenSize[0], screenSize[1]);
            // make up random colors for the coloring, and add random filtering

            setCategoricalLookupTableValues(categories, lookup);

            const { render, connectToCache } = buildScatterbrainRenderFn(
                // @ts-expect-error we'll deal with this later
                regl,
                { ...settings, dataset },
            );
            // this ts error is bogus, dont know why
            const renderOneFrame = () => {
                render({
                    client,
                    visibilityThresholdPx: 10,
                    camera: { view: { minCorner: [-17, -17], maxCorner: [26, 26] }, screenResolution: [800, 800] },
                    categoricalLookupTable: lookup,
                    dataset,
                    filteredOutColor: [0, 0, 0, 1],
                    gradient,
                    hoveredValue: 22,
                    offset: [0, 0],
                    quantitativeRangeFilters: {},
                    spatialFilterBox: { minCorner: [-17, -17], maxCorner: [30, 30] },
                    target: tgt,
                });
                const bytes = regl.read({ framebuffer: tgt });
                const img = new ImageData(new Uint8ClampedArray(bytes), screenSize[0], screenSize[1]);
                ctx!.putImageData(img, 0, 0);
            };
            const client = connectToCache(cache, renderOneFrame);
            renderOneFrame();
        }
    }, [dataset, server, screenSize]);
    return <canvas ref={cnvs} width={screenSize[0]} height={screenSize[1]} />;
}
