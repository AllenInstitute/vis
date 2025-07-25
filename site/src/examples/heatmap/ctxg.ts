import type { Resource, SharedPriorityCache } from "@alleninstitute/vis-core";
import { Box2D, Mat4, Vec2, visitBFS, type AxisAngle, type box2D, type mat4, type vec2, type vec3, type vec4 } from "@alleninstitute/vis-geometry";
import REGL, { type Framebuffer2D } from "regl";
import { fetchColumn, loadDataset, type ColumnarNode, type ColumnarTree, type ColumnData, type MetadataColumn, type QuantitativeColumn } from "../common/loaders/scatterplot/scatterbrain-loader";

// ok - so we've been asked to view heatmaps //
//  data: connectivity and uh... other stuff? 
// not much for eng to go on - but I remember some heatmap tasking from long ago
//  Brian's idea was to render cell type (rows) X gene-expression (cols)
//  the fun part was when you zoomed in, you could see EVERY cell's expression for the given gene!
// zoomed out, you'd see some aggregate (can the gpu do something other than Mean?)
//  so color a pixel according to 4 million additions... up to 4K x 30K pixels...
//  for those following along, thats 500 trillion additions per frame - that would require 500 tflops to
// render within one second. that is one slow frame, and most lappy's are gonna be nowhere near that


// all the above being said, I'm gonna try it. I suspect that the avg(root_qt_node) is close-ish to avg(actual)
//  so why not try it? as we zoom in, we could just render the regular plot, which is gonna look cool as hell


// in order to attempt to well-saturate the gpu, which will help prevent bubbles which is important because of that whole
// 500 trillion flops thing, we're gonna do some instancing
// we are gonna instance the heat-map cell position (xy)
// we are gonna instance the row (cell-type, or any other categorical feature)
// we CANT instance the gene (aka the column) because the buffer that drives changes every column of the heatmap/table
// however, we can draw an entire column of scatterplots at a time, so instancing over rows still seems valuable...
//  we dont need a filter lookup table... although it would allow user-selectable cell-type filtering... TODO!

// this will allow us to do virtual scrolling over a window of row/col coordinates
// for numerical precision reasons, we're gonna need floating point buffers
// there is no nice way to do addition with the fixed-fn blending when trying to pack floats into rgba8...

type Props = {
    view: vec4;
    congeal: number;
    count: number;
    pointSize: number;
    position: REGL.Buffer;
    color: REGL.Buffer;
    rowType: REGL.AttributeConfig;
    rowStep: number;
    offset?: vec2 | undefined;
    zOffset: number;
    rotation: mat4;
    target: Framebuffer2D | null;
};
export type RenderSettings = {
    view: box2D;
    dataSize: vec2;
    pointSize: number;
    rowStep: number;
    congeal: number;
    rotation: number[];
    target: REGL.Framebuffer2D | null;
};
export function buildRenderer(regl: REGL.Regl) {
    // build the regl command first
    const cmd = regl<
        { view: vec4; offset: vec2; pointSize: number, rowStep: number, congeal: number, zOffset: number, rotation: REGL.Mat4 },
        { position: REGL.Buffer; color: REGL.Buffer, rowType: REGL.Buffer },
        Props
    >({
        vert: /*glsl*/`
    precision highp float;
    attribute vec2 position;
    attribute float color;
    attribute float rowType;

    uniform float rowStep;
    uniform float pointSize;
    uniform vec4 view;
    uniform float congeal;
    uniform vec2 offset;

    uniform float zOffset;
    uniform mat4 rotation;

    varying vec4 clr;
    void main(){
        gl_PointSize=pointSize;
        vec2 size = view.zw-view.xy;
        vec2 off = offset + vec2(0.0,rowStep*rowType);
        float z = (zOffset-30.0)/10.0;
        vec4 p = rotation*vec4(position,z,0.0)*vec4(1,-1,1,1);
        vec2 pos = ((mix(p.xy,vec2(0,0),congeal)+off)-view.xy)/size;
        vec2 clip = (pos*2.0)-1.0;
        // todo: gradients are cool
        clr = vec4(color,1,0,0);
        
        // omit = abs(rowType-rowTypeFilter)<0.01 ? 0.0 : 1.0;//1.0-step(rowType-rowTypeFilter,0.25);
        gl_Position = vec4(clip,0.0,1.0);
    }`,
        frag: /*glsl*/`
        precision highp float;
    varying vec4 clr;
    void main(){
        // if(clr.r==0.0){
        //     discard;
        // }
        gl_FragColor = clr;
    }`,
        attributes: {
            color: regl.prop<Props, 'color'>('color'),
            position: regl.prop<Props, 'position'>('position'),
            rowType: regl.prop<Props, 'rowType'>('rowType'),
        },
        uniforms: {
            congeal: regl.prop<Props, 'congeal'>('congeal'),
            view: regl.prop<Props, 'view'>('view'),
            offset: regl.prop<Props, 'offset'>('offset'),
            rowStep: regl.prop<Props, 'rowStep'>('rowStep'),
            pointSize: regl.prop<Props, 'pointSize'>('pointSize'),
            zOffset: regl.prop<Props, 'zOffset'>('zOffset'),
            rotation: regl.prop<Props, 'rotation'>('rotation'),
        },
        depth: {
            enable: false,
        },
        blend: {
            enable: true,
            func: {
                dst: 'one',
                src: 'one',
            }
        },
        framebuffer: regl.prop<Props, 'target'>('target'),
        count: regl.prop<Props, 'count'>('count'),
        primitive: 'points',
    });

    const renderDots = (
        item: ColumnarNode<vec2> & { offset?: vec2 | undefined, zOffset: number },
        settings: RenderSettings,
        columns: { color: VBO, position: VBO, rowType: VBO },
    ) => {
        const { rowType, color, position } = columns;
        const count = item.count;
        const { view, congeal, pointSize, rotation } = settings;
        const effective = pointSize + congeal * 5;
        cmd({
            view: Box2D.toFlatArray(view),
            count,
            congeal,
            rowStep: settings.rowStep,
            rowType: {
                buffer: rowType.vbo,
                normalized: false,
                type: 'uint16',
            },
            zOffset: item.zOffset,
            rotation,
            position: position.vbo,
            pointSize: effective,
            color: color.vbo,
            offset: item.offset ?? [0, 0],
            target: settings.target,
        });

    };
    return renderDots;
}
function buildHeatmapColorGradientRenderer(regl: REGL.Regl) {
    const cmd = regl({
        vert: /*glsl*/`
        precision highp float;
        attribute vec2 position;
        varying vec2 uv;
        void main(){
            uv = (position/2.0)+0.5; 
            gl_Position = vec4(position.xy,0,1.0);
        }
        `,
        frag: /*glsl*/`
        precision highp float;
    uniform float divisor;
    uniform sampler2D expr;
    
    // simple 3-color gradient
    uniform vec3 start;
    uniform vec3 middle;
    uniform vec3 end;

    varying vec2 uv;

    void main(){
        vec2 e_count = texture2D(expr,uv).rg;
        // for now, lets color by avg...
        float avg = e_count.x/e_count.y;
        //normalized to min-max for this channel:
        float v = avg/divisor;
        vec3 col = mix(mix(start, middle, v*2.0), mix(middle, end, (v-0.5)*2.0), step(0.5,v));
        if(e_count.y<0.5){
            discard;
        }
        gl_FragColor =  vec4(col,1);//mix(vec4(1,1,0.55,1.0), vec4(col,1),step(0.99,e_count.y));
    }`,
        count: 4,
        primitive: 'triangle fan',
        attributes: { position: [-1, -1, 1, -1, 1, 1, -1, 1] },
        uniforms: {
            divisor: regl.prop('divisor'),
            expr: regl.prop('expr'),
            start: regl.prop('start'),
            middle: regl.prop('middle'),
            end: regl.prop('end'),
        },
        blend: {
            enable: false
        }, depth: {
            enable: false
        },
        framebuffer: regl.prop('target')
    });
    return (props: {
        start: vec3, middle: vec3, end: vec3
        texture: REGL.Framebuffer2D | REGL.Texture2D,
        divisor: number,
        target: REGL.Framebuffer2D | null;
    }) => {
        const { target, divisor, texture, start, middle, end } = props
        cmd({
            divisor,
            target,
            start, middle, end,
            expr: texture
        })
    }
}

type Item = {
    dataset: {
        url: string;
        metadata: ReturnType<typeof loadDataset>;
    },
    qtNode: ColumnarNode<vec2>,
    rowData: MetadataColumn,
    colData: QuantitativeColumn
}
class VBO implements Resource {
    vbo: REGL.Buffer;
    constructor(buff: REGL.Buffer) {
        this.vbo = buff;
    }
    destroy() {
        this.vbo.destroy();
    }
    sizeInBytes() {
        return 400_000;
    }
}
class ColInfo implements Resource {
    data: ColumnData;
    constructor(buff: ColumnData) {
        this.data = buff;
    }
    destroy() {
        // just gc it...
        this.data = undefined;
    }
    sizeInBytes() {
        return this.data?.data.byteLength
    }
}
type RawContent = {
    position: ColInfo;
    row: ColInfo;
    col: ColInfo;
}
type Content = {
    position: VBO;
    row: VBO;
    col: VBO;
}
export type Settings = {
    view: box2D;         // in table space
    geneIndexes: string[];
    rowFilterValues: number[]; // encoded binary values, each representing a possible value in the rowCategory featureType
    rowCategory: string;
    cellSize: vec2; // the size of a cell in our heatmap - not biological 'cell' but "table cell".
    rotation: number[];
}

export function buildAnalyzer(cache: SharedPriorityCache, onData: (k: string) => void) {
    const C = cache.registerClient<Item, RawContent>({
        cacheKeys: (item) => {
            return {
                col: `raw-${item.dataset.url}|${item.qtNode.name}|gene=${item.colData.name}`,
                position: `raw-${item.dataset.url}|${item.qtNode.name}|pos=${item.dataset.metadata.spatialColumn}`,
                row: `raw-${item.dataset.url}|${item.qtNode.name}|ct=${item.rowData.name}`
            }

        },
        fetch: (item) => ({
            position: (sig: AbortSignal) => fetchColumn(item.qtNode, item.dataset.metadata, { type: 'METADATA', name: item.dataset.metadata.spatialColumn }, sig).then(b => new ColInfo(b)),
            row: (sig: AbortSignal) => fetchColumn(item.qtNode, item.dataset.metadata, item.rowData, sig).then(b => new ColInfo(b)),
            col: (sig: AbortSignal) => fetchColumn(item.qtNode, item.dataset.metadata, item.colData, sig).then(b => new ColInfo(b)),
        }),
        isValue: (v): v is RawContent => {
            return 'position' in v && 'row' in v && 'col' in v &&
                v.position instanceof ColInfo &&
                v.row instanceof ColInfo &&
                v.col instanceof ColInfo;
        },
        onDataArrived: (cacheKey, result) => {
            onData(cacheKey);
        },
    })
    const setup = (dataset: Item['dataset'], settings: { geneIndexes: string[], rowCategory: string }) => {
        // get all things in the dataset - all of them. prioritize them all!
        const { metadata } = dataset
        if ('tree' in metadata) {
            const visible: ColumnarNode<vec2>[] = []
            visitBFS(metadata.tree, (t) => t.children, (t) => visible.push(t.content))

            const cols = settings.geneIndexes.map((gene, colIndex) => {
                const items: Item[] = visible.map((node) => ({
                    dataset,
                    rowData: { type: 'METADATA', name: settings.rowCategory } as const,
                    colData: { type: 'QUANTITATIVE', name: gene } as const,
                    qtNode: node,
                    colIndex,
                }));
                return items;
            })
            C.setPriorities(cols.flat(), []);

            // const lilBox: box2D = { minCorner: [-21.378167538939834, 0.8003247660520433], maxCorner: [-20.705730099571873, 1.4207358757814563] }
            const doCounts = () => {
                C.setPriorities(cols.flat(), []);
                let missing = 0;
                const results = cols.map((col) => {
                    const histo: Record<number, number> = {}
                    for (const node of col) {
                        const data = C.get(node);
                        if (data !== undefined) {
                            for (let i = 0; i < data.col.data.data.length; i++) {
                                // const x = data.position.data.data[i * 2]
                                // const y = data.position.data.data[i * 2 + 1]
                                // if (Box2D.containsPoint(lilBox, [x, y])) {
                                const r = data.row.data.data[i];
                                const expr = data.col.data.data[i];
                                histo[r] = (histo[r] ?? 0) + (expr > 0.0 ? 1.0 : 0.0);
                                // }

                            }
                        } else {
                            missing += 1;
                        }
                    }
                    return { gene: col[0].colData.name, histo, missing }
                })
                return results;
            }
            return doCounts;
        }
    }
    return setup;
}

export function buildConnectedRenderer(regl: REGL.Regl, cache: SharedPriorityCache, onData: (k: string) => void) {
    const colToVbo = async (col: Promise<ColumnData>) => {
        const data = await col;
        const buf = regl.buffer(data)
        return new VBO(buf);
    }
    const renderer = buildRenderer(regl);
    // const wtf = buildScatterplotRenderer(regl);
    const display = buildHeatmapColorGradientRenderer(regl);
    const C = cache.registerClient<Item, Content>({
        cacheKeys: (item) => {
            return {
                col: `${item.dataset.url}|${item.qtNode.name}|gene=${item.colData.name}`,
                position: `${item.dataset.url}|${item.qtNode.name}|pos=${item.dataset.metadata.spatialColumn}`,
                row: `${item.dataset.url}|${item.qtNode.name}|ct=${item.rowData.name}`
            }

        },
        fetch: (item) => ({
            position: (sig: AbortSignal) => colToVbo(fetchColumn(item.qtNode, item.dataset.metadata, { type: 'METADATA', name: item.dataset.metadata.spatialColumn }, sig)),
            row: (sig: AbortSignal) => colToVbo(fetchColumn(item.qtNode, item.dataset.metadata, item.rowData, sig)),
            col: (sig: AbortSignal) => colToVbo(fetchColumn(item.qtNode, item.dataset.metadata, item.colData, sig)),
        }),
        isValue: (v): v is Content => {
            return 'position' in v && 'row' in v && 'col' in v &&
                v.position instanceof VBO &&
                v.row instanceof VBO &&
                v.col instanceof VBO;
        },
        onDataArrived: (cacheKey, result) => {
            onData(cacheKey);
        },
    })
    const width = 800;
    const height = 800;
    // we need a float buffer for counting up all the expr values!
    const totalExpression = regl.framebuffer({
        width,
        height,
        depth: false,
        stencil: false,
        colorFormat: 'rgba', // bummer, we really only need one of these channels...
        colorType: 'float'
    })
    const displayFbo = regl.framebuffer({
        width, height
    });
    // we need to make a cell offset buffer
    const maxRows = 5000;
    const fperv = 2;
    const s = fperv * maxRows
    const cellRow = regl.buffer({
        type: 'uint16',
        length: maxRows * fperv
    }); // max expected elements in a column
    const filter = regl.buffer({
        type: 'uint16',
        length: maxRows * fperv
    });
    const counting = new Uint16Array(5000);
    for (let i = 0; i < 5000; i++) {
        counting[i] = i;
    }
    const renderCell = (hmCol: Item & { colIndex: number, zOffset: number, }, settings: Settings, target: Framebuffer2D) => {
        const cached = C.get(hmCol);
        // Todo: if(inView(item,settings))
        if (cached) {
            const { colIndex, qtNode, dataset, zOffset } = hmCol
            const { bounds } = dataset.metadata
            const dataBound = bounds as box2D
            const dataSize = Box2D.size(dataBound);
            const { view } = settings
            const rotation = settings.rotation;
            const vSize = Box2D.size(settings.view);
            const dpv = vSize[1] / dataSize[1];
            let congeal = Math.min(1, Math.max(0, (dpv - 14) / 28));
            let pointSize = 1;
            if (dpv < 1.0) {
                pointSize = 1 / dpv;
            }
            const { row, col, position } = cached;
            renderer({ ...qtNode, offset: Vec2.mul(dataSize, [colIndex, 0]), zOffset }, { rotation, pointSize, dataSize, target, view, rowStep: dataSize[1], congeal }, { position, color: col, rowType: row });

        }
    }
    const renderColumn = (hmCol: Item & { colIndex: number, zOffset: number }, settings: Settings, target: Framebuffer2D) => {
        const wh = Box2D.size(hmCol.dataset.metadata.bounds);
        const firstCol = Math.floor(settings.view.minCorner[0] / wh[0])
        const lastCol = Math.ceil(settings.view.maxCorner[0] / wh[0]);
        if (hmCol.colIndex >= firstCol || hmCol.colIndex <= lastCol) {
            renderCell(hmCol, settings, target);
        }

    }
    regl.clear({ framebuffer: totalExpression, color: [0, 0, 0, 1], depth: 1 })
    regl.clear({ framebuffer: displayFbo, color: [0, 0, 0.1, 1], depth: 1 })
    let fboSize: vec2 = [width, height];



    const render = (dataset: Item['dataset'], settings: Omit<Settings, 'rotation'> & { rotation: AxisAngle }) => {
        const ppu = Vec2.div([width, height], Box2D.size(settings.view));
        const rotation = Mat4.toColumnMajorArray(Mat4.rotateAboutAxis(settings.rotation.axis, settings.rotation.radians));
        const pixelscovered = (bounds: box2D) => Vec2.mul(Box2D.size(bounds), ppu);
        const visibleInTree = (tree: ColumnarTree<vec2>) => {
            const visible: ColumnarNode<vec2>[] = []
            visitBFS(tree, (t) => t.children, (t) => visible.push(t.content), (t) => {
                if (t.content.depth == 0) return true;
                // return false;
                const px = pixelscovered(t.content.bounds)
                const area = px[0] * px[1];

                if (area < 100 * 100) {
                    return false;
                }
                return true;
            })
            return visible;
        }

        const { metadata } = dataset;
        const wh = Box2D.size(metadata.bounds);
        const firstCol = Math.floor(settings.view.minCorner[0] / wh[0])
        const lastCol = Math.ceil(settings.view.maxCorner[0] / wh[0]);
        let heatmapCols: (Item & { colIndex: number, zOffset: number })[] = [];
        if ('tree' in metadata) {
            const { tree } = metadata;
            // how much of the view does a single heat-map-cell occupy?
            const visible = visibleInTree(tree);

            heatmapCols =
                visible.map(node => (
                    settings.geneIndexes.map((gene, colIndex) => ({
                        dataset,
                        rowData: { type: 'METADATA', name: settings.rowCategory } as const,
                        colData: { type: 'QUANTITATIVE', name: gene } as const,
                        qtNode: node,
                        colIndex,
                        zOffset: 0,
                    })).filter((thing) => {

                        return (thing.colIndex >= firstCol && thing.colIndex <= lastCol)
                    })
                )).flat()
        } else {
            // ok but what if we did want to support it... lets put all the slides in a stack, and then render the stack, but with a spinning animation, why not?
            const { slides } = metadata
            const order = Object.keys(slides).sort();
            const visible = order.map((slideId) => visibleInTree(slides[slideId].tree));
            heatmapCols =
                visible.map((slide, index) => (
                    slide.map((node) =>
                        settings.geneIndexes.map((gene, colIndex) => ({
                            dataset,
                            rowData: { type: 'METADATA', name: settings.rowCategory } as const,
                            colData: { type: 'QUANTITATIVE', name: gene } as const,
                            qtNode: node,
                            colIndex,
                            zOffset: index,
                        }))).flat())
                    .filter((thing) => {
                        return (thing.colIndex >= firstCol && thing.colIndex <= lastCol)
                    })
                ).flat()
        }
        // console.log('draw columns: ', heatmapCols.length)
        C.setPriorities(heatmapCols, [])
        // now, try and render all those columns
        regl.clear({ framebuffer: totalExpression, color: [0, 0, 0, 0], depth: 1 })
        regl.clear({ framebuffer: displayFbo, color: [0.5, 0.5, 0.55, 1], depth: 1 })
        heatmapCols.forEach(col => renderColumn(col, { ...settings, rotation }, totalExpression));

        const divisor = 6.0;
        display({ texture: totalExpression, divisor, target: displayFbo, start: [0.1, 0.0, 0.2], middle: [0.95, 0.6, 0.01], end: [0.99, 0.99, 0.87] })
    }

    return {
        render, copyPixels: (canvas: CanvasRenderingContext2D) => {
            const copyBuffer = regl.read({
                framebuffer: displayFbo,
                x: 0,
                y: 0,
                width: width,
                height: height,
                data: new Uint8Array(width * height * 4),
            });
            // read and copy?
            const img = new ImageData(new Uint8ClampedArray(copyBuffer), width, height);
            canvas.putImageData(img, 0, 0);
        },
        countAll: (dataset: Item['dataset'], settings: Settings) => {

        }
    };
}

