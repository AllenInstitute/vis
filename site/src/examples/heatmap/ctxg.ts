import type { Resource, SharedPriorityCache } from "@alleninstitute/vis-core";
import { Box2D, Mat4, Vec2, visitBFS, type AxisAngle, type box2D, type mat4, type vec2, type vec3, type vec4 } from "@alleninstitute/vis-geometry";
import REGL, { type Framebuffer2D, type Texture2D } from "regl";
import { fetchColumn, loadDataset, type ColumnarNode, type ColumnarTree, type ColumnData, type MetadataColumn, type QuantitativeColumn } from "../common/loaders/scatterplot/scatterbrain-loader";
import { VBO } from "./vbo";
import { buildAvgAccumulator } from "./accumulator";
import { buildOutliner } from "./dataset-outline";
import { idsInOrder } from "./slide-order";

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
    step: vec2;
    offset?: vec2 | undefined;
    mouse: vec2;
    column: number;
    zOffset: number;
    rotation: mat4;
    heatmap: Texture2D;
    mapSize: vec2;
    target: Framebuffer2D | null;
};
export type RenderSettings = {
    view: box2D;
    dataSize: vec2;
    pointSize: number;
    mouse: vec2;
    congeal: number;
    rotation: number[];
    heatmap: Texture2D | Framebuffer2D;
    mapSize: vec2;
    target: REGL.Framebuffer2D | null;
};
export function buildRenderer(regl: REGL.Regl) {
    const normal = buildRendererHelper(regl, true);
    const closeup = buildRendererHelper(regl, false);
    const renderDots = (
        item: ColumnarNode<vec2> & { offset?: vec2 | undefined, zOffset: number },
        settings: RenderSettings,
        columns: { color: VBO, position: VBO, rowType: VBO },
    ) => {
        const { rowType, color, position } = columns;
        const count = item.count;
        const { view, congeal, pointSize, rotation, heatmap, mapSize, dataSize, mouse } = settings;
        // put the view in "table" space...
        const tbl = Box2D.create(Vec2.div(view.minCorner, dataSize), Vec2.div(view.maxCorner, dataSize))
        const effective = congeal < 0.9 && congeal > 0 ? 1 + (congeal * congeal * congeal * 6) : pointSize;
        let cmd = congeal == 0.0 && effective >= 2 ? closeup : normal;

        cmd({
            view: [...tbl.minCorner, ...Box2D.size(tbl)],
            heatmap,
            mapSize,
            count,
            congeal,
            mouse,
            step: settings.dataSize,
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
            column: item.offset?.[0] ?? [0],
            offset: Vec2.sub(item.offset ?? [0, 0], tbl.minCorner),
            target: settings.target,
        });

    };
    return renderDots;

}
function buildRendererHelper(regl: REGL.Regl, accum: boolean) {
    // build the regl command first
    const cmd = regl<
        { view: vec4; offset: vec2; pointSize: number, stepSize: vec2, mouse: vec2, column: number, congeal: number, zOffset: number, rotation: REGL.Mat4, heatmap: Texture2D | Framebuffer2D, mapSize: vec2 },
        { position: REGL.Buffer; color: REGL.Buffer, rowType: REGL.Buffer },
        Props
    >({
        vert: /*glsl*/`
    precision highp float;
    attribute vec2 position;
    attribute float color;
    attribute float rowType;

    uniform sampler2D heatmap;
    uniform vec2 mapSize;
    uniform vec2 stepSize;
    uniform float pointSize;
    uniform vec4 view;
    uniform float congeal;
    uniform vec2 offset;
    uniform vec2 mouse;
    uniform float column;
    uniform float zOffset;
    uniform mat4 rotation;

    varying vec4 clr;
    void main(){
        vec2 size = view.zw;//view.zw-view.xy;
        // vec2 off = (offset*stepSize) + vec2(0.0,stepSize.y*rowType);
        vec2 off = offset+vec2(0.0,rowType);
        float z = (zOffset-30.0)/10.0;
        vec4 p = rotation*vec4(position,z,0.0)*vec4(1,1,1,1);
        vec2 pos = ((mix(p.xy/stepSize,vec2(0,0),congeal)+off))/size;
        // float cursorDst = clamp(1.0-length(pos-mouse)*50.0,0.0,1.0);//clamp(1.0-length(pos-mouse)*1000.0,0.0,1.0);
        // make nearby things small, make the center thing big
        float dst = length(pos-mouse)*2.0;
        float cursorDst = max(0.0,-120.0*dst*dst+1.0)*cos(dst*60.0);
        // float cursorDst = cos(1.0-length(pos-mouse)*20.0*3.14159)*clamp(1.0-length(pos-mouse)*20.0,0.0,1.0);
        // cursorDst = sqrt(cursorDst);
        gl_PointSize=max(1.0,pointSize + (cursorDst < 0.0 ? cursorDst*30.0 : cursorDst*8.0));

        vec2 clip = (pos*2.0)-1.0;
        vec4 avg = texture2D(heatmap,(vec2(column,rowType)+vec2(0.5,0.5))/mapSize);
        clr = mix(vec4(color,1,0,0),avg,step(0.9,congeal));
        // distance to cursor stuff:
        gl_Position = vec4(clip,(z/10.0)-cursorDst/100.0,1.0);
    }`,
        frag: /*glsl*/`
        #extension GL_EXT_frag_depth : enable
        precision highp float;
        uniform float congeal;
    varying vec4 clr;
    void main(){
        float pL = length(gl_PointCoord.xy-vec2(0.5,0.5));
        if(congeal<0.1 && pL > 0.5){
            discard;
        }
        ${accum ? '' : 'gl_FragDepthEXT = gl_FragCoord.z + pL/1000.0;'}
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
            column: regl.prop<Props, 'column'>('column'),
            mouse: regl.prop<Props, 'mouse'>('mouse'),
            offset: regl.prop<Props, 'offset'>('offset'),
            stepSize: regl.prop<Props, 'step'>('step'),
            pointSize: regl.prop<Props, 'pointSize'>('pointSize'),
            zOffset: regl.prop<Props, 'zOffset'>('zOffset'),
            rotation: regl.prop<Props, 'rotation'>('rotation'),
            mapSize: regl.prop<Props, 'mapSize'>('mapSize'),
            heatmap: regl.prop<Props, 'heatmap'>('heatmap'),
        },
        depth: {
            enable: !accum,
            func: 'lequal'
        },
        blend: {
            enable: accum,
            func: {
                dst: 'one',
                src: 'one',
            }
        },
        framebuffer: regl.prop<Props, 'target'>('target'),
        count: regl.prop<Props, 'count'>('count'),
        primitive: 'points',
    });

    return cmd;
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
    mouse: vec2;
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

export function buildConnectedRenderer(regl: REGL.Regl, mapSize: vec2, cache: SharedPriorityCache, onData: (k: string) => void) {
    const colToVbo = async (col: Promise<ColumnData>) => {
        const data = await col;
        const buf = regl.buffer(data)
        return new VBO(buf);
    }
    const renderer = buildRenderer(regl);
    const accum = buildAvgAccumulator(regl);
    const display = buildHeatmapColorGradientRenderer(regl);
    const outline = buildOutliner(regl);
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
    const width = 1600;
    const height = 900;
    // we need a float buffer for counting up all the expr values!
    const exprTex = regl.texture({
        min: 'nearest',
        mag: 'nearest',
        format: 'rgba',
        type: 'float',
        width: mapSize[0],
        height: mapSize[1],
    })
    const totalExpression = regl.framebuffer({
        width: mapSize[0],
        height: mapSize[1],
        depth: false,
        stencil: false,
        color: exprTex
        // colorFormat: 'rgba',
        // colorType: 'float',
    })
    const dotExpr = regl.framebuffer({
        width, height,
        depth: true,
        stencil: false,
        colorFormat: 'rgba', // bummer, we really only need one of these channels...
        colorType: 'float'
    });
    const regionSize: vec2 = [512, 512]
    // lastly, we need a tmp fbo to draw the little regional outlines!
    const rTex = regl.texture({
        format: 'rgba',
        type: 'float',
        width: regionSize[0],
        height: regionSize[1],
    })

    const dTex = regl.texture({
        min: 'linear',
        mag: 'linear',
        format: 'rgba',
        width: regionSize[0],
        height: regionSize[1],
    })
    const regions = regl.framebuffer({
        width: regionSize[0], height: regionSize[1],
        color: rTex,
        depth: false,
        stencil: false,
    });
    const displayFbo = regl.framebuffer({
        color: dTex
    });

    // make some very silly buffers...
    const fakeCat = new Uint16Array(mapSize[1])
    const fakeGene = new Float32Array(mapSize[1])
    const fakePos = new Float32Array(mapSize[1] * 2)
    for (let r = 0; r < mapSize[1]; r++) {

        fakeCat[r] = r;
        fakeGene[r] = 0.0;
        fakePos[r * 2 + 0] = 0.0;
        fakePos[r * 2 + 1] = 0.0;
    }
    const fR = regl.buffer(fakeCat);
    const fC = regl.buffer(fakeGene);
    const fP = regl.buffer(fakePos);
    const fake: Content = {
        position: new VBO(fP),
        col: new VBO(fC),
        row: new VBO(fR)
    };
    const accumColumn = (hmCol: Item & { colIndex: number, zOffset: number, }, settings: Settings, target: Framebuffer2D) => {
        const cached = C.get(hmCol);
        if (cached) {
            const { colIndex, qtNode } = hmCol

            const { row, col, position } = cached;
            accum({ ...qtNode, columnIndex: colIndex }, { mapSize, target }, { position, color: col, rowType: row })
        }
    }

    const renderCell = (hmCol: Item & { colIndex: number, zOffset: number, }, settings: Settings, target: Framebuffer2D) => {
        const cached = C.get(hmCol);
        // Todo: if(inView(item,settings))
        if (cached) {
            const { colIndex, qtNode, dataset, zOffset } = hmCol
            const { bounds } = dataset.metadata
            const dataBound = bounds as box2D
            const dataSize = Box2D.size(dataBound);
            const { view, mouse } = settings;
            const rotation = settings.rotation;
            const vSize = Box2D.size(settings.view);
            // put the mouse in terms of the view
            const unitMousePos = Vec2.div(mouse, [width, height]);
            const dpv = vSize[1] / dataSize[1];
            let congeal = Math.min(1, Math.max(0, (dpv - 14) / 28));
            let pointSize = 1;
            if (dpv < 1.0) {
                pointSize = 1 / dpv;
            }
            const { row, col, position } = cached;
            renderer({ ...qtNode, offset: [colIndex, 0], zOffset }, { mouse: unitMousePos, mapSize, heatmap: totalExpression, rotation, pointSize, dataSize, target, view, congeal }, { position, color: col, rowType: row });

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
    regl.clear({ framebuffer: dotExpr, color: [0, 0, 0, 0], depth: 1 })
    regl.clear({ framebuffer: displayFbo, color: [0, 0, 0.1, 1], depth: 1 })



    const accounted: Set<string> = new Set<string>();

    const render = (dataset: Item['dataset'], settings: Omit<Settings, 'rotation'> & { rotation: AxisAngle }) => {
        const ppu = Vec2.div([width, height], Box2D.size(settings.view));
        const rotation = Mat4.toColumnMajorArray(Mat4.rotateAboutAxis(settings.rotation.axis, settings.rotation.radians));

        const pixelscovered = (bounds: box2D) => Vec2.mul(Box2D.size(bounds), ppu);
        const visibleInTree = (tree: ColumnarTree<vec2>, lim: number) => {
            const visible: ColumnarNode<vec2>[] = []
            visitBFS(tree, (t) => t.children, (t) => visible.push(t.content), (t) => {
                if (t.content.depth == 0) return true;
                // return false;
                const px = pixelscovered(t.content.bounds)
                const area = px[0] * px[1];

                if (area < lim * lim) {
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
        let lowPriority: (Item & { colIndex: number, zOffset: number })[] = [];
        const nodeToItem = (node: ColumnarNode<vec2>, column: number, zOffset: number) => ({
            dataset,
            rowData: { type: 'METADATA', name: settings.rowCategory } as const,
            colData: { type: 'QUANTITATIVE', name: settings.geneIndexes[column] } as const,
            qtNode: node,
            colIndex: column,
            zOffset,
        })
        const columnInView = (col: number) => col >= firstCol && col <= lastCol
        // const nodeToItems = (node: ColumnarNode<vec2>, zOffset: number) =>
        //     settings.geneIndexes.map((gene, colIndex) => ({
        //         dataset,
        //         rowData: { type: 'METADATA', name: settings.rowCategory } as const,
        //         colData: { type: 'QUANTITATIVE', name: gene } as const,
        //         qtNode: node,
        //         colIndex,
        //         zOffset,
        //     })).filter((thing) => {

        //         return (thing.colIndex >= firstCol && thing.colIndex <= lastCol)
        //     })

        if ('tree' in metadata) {
            const { tree } = metadata;
            const visible = visibleInTree(tree, 30);
            const toAccumulate = visibleInTree(tree, 1);
            heatmapCols = settings.geneIndexes.map((g, i) =>
                columnInView(i) ? visible.map(n => nodeToItem(n, i, 0)) : []
            ).flat()

            lowPriority = settings.geneIndexes.map((g, i) =>
                columnInView(i) ? toAccumulate.map(n => nodeToItem(n, i, 0)) : []
            ).flat()

        } else {
            // ok but what if we did want to support it... lets put all the slides in a stack, and then render the stack, but with a spinning animation, why not?
            const { slides } = metadata
            const order = idsInOrder();//Object.keys(slides).sort();
            const visible = order.map((slideId) => visibleInTree(slides[slideId].tree, 30));
            const toAccumulate = order.map((slideId) => visibleInTree(slides[slideId].tree, 1));

            heatmapCols = settings.geneIndexes.map((g, i) =>
                columnInView(i) ? visible.map((s, sId) => s.map(n => nodeToItem(n, i, sId))).flat() : []
            ).flat()

            lowPriority = settings.geneIndexes.map((g, i) =>
                columnInView(i) ? toAccumulate.map((s, sId) => s.map(n => nodeToItem(n, i, sId))).flat() : []
            ).flat()

        }
        // console.log('draw columns: ', heatmapCols.length)
        C.setPriorities(lowPriority, heatmapCols)
        // now, try and render all those columns
        regl.clear({ framebuffer: null, color: [0.5, 0.5, 0.55, 1], depth: 1 })
        regl.clear({ framebuffer: dotExpr, color: [0, 0, 0, 0], depth: 1 })
        // regl.clear({ framebuffer: displayFbo, color: [0.5, 0.5, 0.55, 1], depth: 1 })


        let first = true;
        heatmapCols.forEach(col => {
            if (C.has(col)) {
                if (col.qtNode.name.endsWith('r')) {
                    // render the outline stuff...
                    const buffs = C.get(col)!;
                    if (first) {
                        regl.clear({ framebuffer: regions, color: [0, 0, 0, 0], depth: 1 })
                        regl.clear({ framebuffer: displayFbo, color: [0, 0, 0, 0], depth: 1 })
                        first = false;
                    }
                    outline.dots({ ...col.qtNode, zOffset: col.zOffset }, { bounds: metadata.bounds, lineColor: [0, 0, 0, 1], rotation, size: regionSize, target: regions }, buffs);
                    outline.edges({ target: displayFbo, color: [0, 0, 0, 0.33], size: regionSize, texture: regions })
                }

            }
        })
        lowPriority.forEach(col => {
            const key = `${col.qtNode.name}|${col.colIndex}`
            if (C.has(col)) {
                if (!accounted.has(key)) {
                    // accumulate it!
                    accounted.add(key);
                    accumColumn(col, { ...settings, rotation }, totalExpression)
                }
            }
        })
        const dataSize = Box2D.size(metadata.bounds);
        const vSize = Box2D.size(settings.view);
        const dpv = vSize[1] / dataSize[1];
        let congeal = Math.min(1, Math.max(0, (dpv - 14) / 28));
        if (congeal > 0.9) {
            const pointSize = (congeal) * Math.min((height / Math.ceil(dpv)) - 1, 8);
            heatmapCols.forEach(col =>
                renderer({ count: mapSize[1], bounds: metadata.bounds, depth: 0, geneUrl: 'fake.com', name: 'nah', url: 'nope.net', zOffset: 0, offset: [col.colIndex, 0.0] },
                    {
                        congeal,
                        dataSize,
                        heatmap: totalExpression,
                        mapSize,
                        pointSize,
                        rotation,
                        mouse: [999, 999],
                        target: dotExpr,
                        view: settings.view,
                    }, { color: fake.col, position: fake.position, rowType: fake.row })
            )
        } else {
            heatmapCols.forEach(col => renderColumn(col, { ...settings, rotation }, dotExpr));
        }

        // display({ texture: totalExpression, divisor, target: displayFbo, start: [0.1, 0.0, 0.2], middle: [0.95, 0.6, 0.01], end: [0.99, 0.99, 0.87] })

    }

    return {
        render,
        display: (dataset: Item['dataset'], view: box2D) => {
            const divisor = 9.0;
            outline.display({ texture: displayFbo, mapSize, dataBound: dataset.metadata.bounds, view, target: null })
            display({ texture: dotExpr, divisor, target: null, start: [0.1, 0.0, 0.2], middle: [0.95, 0.6, 0.01], end: [0.99, 0.99, 0.87] })
        },
        // copyPixels: (canvas: CanvasRenderingContext2D) => {
        //     const copyBuffer = regl.read({
        //         framebuffer: displayFbo,
        //         x: 0,
        //         y: 0,
        //         width: width,
        //         height: height,
        //         data: new Uint8Array(width * height * 4),
        //     });
        //     // read and copy?
        //     const img = new ImageData(new Uint8ClampedArray(copyBuffer), width, height);
        //     canvas.putImageData(img, 0, 0);
        // },
        countAll: (dataset: Item['dataset'], settings: Settings) => {

        }
    };
}

