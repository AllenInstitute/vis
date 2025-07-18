import type { Resource, SharedPriorityCache } from "@alleninstitute/vis-core";
import { Box2D, Vec2, type box2D, type vec2, type vec3, type vec4 } from "@alleninstitute/vis-geometry";
import REGL, { type Framebuffer2D } from "regl";
import { fetchColumn, isSlideViewData, loadDataset, type ColumnarMetadata, type ColumnarNode, type ColumnarTree, type ColumnData, type MetadataColumn, type QuantitativeColumn } from "../common/loaders/scatterplot/scatterbrain-loader";
import { getVisibleItems } from "../common/loaders/scatterplot/data";
import { buildRenderer as buildScatterplotRenderer } from "../data-renderers/scatterplot";

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
    target: Framebuffer2D | null;
};
export type RenderSettings = {
    view: box2D;
    dataSize: vec2;
    pointSize: number;
    rowStep: number;
    target: REGL.Framebuffer2D | null;
};
export function buildRenderer(regl: REGL.Regl) {
    // build the regl command first
    const cmd = regl<
        { view: vec4; offset: vec2; pointSize: number, rowStep: number, congeal: number },
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

    varying vec4 clr;
    void main(){
        gl_PointSize=pointSize;
        vec2 size = view.zw-view.xy;
        vec2 off = offset + vec2(0.0,rowStep*rowType);
        vec2 pos = ((mix(position*vec2(1,-1.0),vec2(0,0),congeal)+off)-view.xy)/size;
        vec2 clip = (pos*2.0)-1.0;

        // todo: gradients are cool
        clr = vec4(color,1,0,0);
        
        // omit = abs(rowType-rowTypeFilter)<0.01 ? 0.0 : 1.0;//1.0-step(rowType-rowTypeFilter,0.25);
        gl_Position = vec4(clip,0.0,1);
    }`,
        frag: /*glsl*/`
        precision highp float;
    varying vec4 clr;
    void main(){
       
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
        item: ColumnarTree<vec2> & { offset?: vec2 | undefined },
        settings: RenderSettings,
        columns: { color: VBO, position: VBO, rowType: VBO },
    ) => {
        const { rowType, color, position } = columns;
        const count = item.content.count;
        const { view, dataSize, pointSize } = settings;
        // interpolate: size(view) = 4*dataSize => 0
        //              size(view) = 10*datasize=>1
        const vSize = Box2D.size(view);
        const dpv = vSize[1] / dataSize[1];
        const congeal = Math.min(1, Math.max(0, (dpv - 14) / 28));
        const effective = 1 + congeal * 10;
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
    tree: ColumnarTree<ReadonlyArray<number>>,
    qtNode: ColumnarNode<ReadonlyArray<number>>,
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
    cellRow.subdata(counting);
    const renderCell = (hmCol: Item & { colIndex: number }, settings: Settings, target: Framebuffer2D) => {
        const cached = C.get(hmCol);
        // Todo: if(inView(item,settings))
        if (cached) {
            const { colIndex, qtNode, tree } = hmCol
            const { count, bounds } = qtNode
            const dataBound = bounds as box2D
            const dataSize = Box2D.size(dataBound);
            const { view, cellSize } = settings
            // const rowId = settings.rowFilterValues[rowIndex];
            // console.log('render column', hmCol.colIndex, hmCol.colIndex * cellSize[0])
            // console.dir(view)
            const { row, col, position } = cached;
            renderer({ ...tree as ColumnarTree<vec2>, offset: Vec2.mul(dataSize, [colIndex, 0]) }, { pointSize: 1, dataSize, target, view, rowStep: dataSize[1] }, { position, color: col, rowType: row });
            // renderer({
            //     position: position.vbo,
            //     rowVal: row.vbo,
            //     colVal: col.vbo,
            //     cellCol: colIndex * cellSize[0],
            //     cellSize,
            //     colRange: [0, 12], // min/max gene expr for this gene
            //     count,
            //     dataBound,
            //     // instance us todo:
            //     // cellRow,
            //     // filter, // the categorical column filter
            //     rowId,
            //     cellRow: rowIndex,
            //     instanceCount: settings.rowFilterValues.length, // # rows in the column
            //     pointSize: 30,
            //     view,
            //     target
            // })
        }
    }
    const renderColumn = (hmCol: Item & { colIndex: number }, settings: Settings, target: Framebuffer2D) => {
        renderCell(hmCol, settings, target);
        // for (let rI = 0; rI < settings.rowFilterValues.length; rI++) {
        //     renderCell({ ...hmCol, rowIndex: rI }, settings, target);
        // }
    }
    regl.clear({ framebuffer: totalExpression, color: [0, 0, 0, 1], depth: 1 })
    regl.clear({ framebuffer: displayFbo, color: [0, 0, 0.1, 1], depth: 1 })
    let fboSize: vec2 = [width, height];



    const render = (dataset: Item['dataset'], settings: Settings) => {
        // use instancing to render an entire row at a time
        // fboSize=[settings.geneIndexes.length, settings.rowFilterValues.length ]
        // if (!Vec2.exactlyEqual(fboSize, [settings.geneIndexes.length, settings.rowFilterValues.length])) {
        //     totalExpression.resize(settings.geneIndexes.length, settings.rowFilterValues.length) // re-size the fbo
        //     fboSize = [settings.geneIndexes.length, settings.rowFilterValues.length]
        // }

        filter.subdata(settings.rowFilterValues);
        const { metadata } = dataset;
        // for now, render only the root-level node of the tree
        // const uh = getVisibleItems(dataset.metadata, view, 1)
        if ('tree' in metadata) {
            const root = metadata.tree.content;

            const heatmapCols = settings.geneIndexes.map((gene, colIndex) => ({
                dataset,
                rowData: { type: 'METADATA', name: settings.rowCategory } as const,
                colData: { type: 'QUANTITATIVE', name: gene } as const,
                qtNode: root,
                tree: metadata.tree,
                colIndex,
            }))
            C.setPriorities(heatmapCols, [])
            // now, try and render all those columns
            regl.clear({ framebuffer: totalExpression, color: [0, 0, 0, 0], depth: 1 })
            regl.clear({ framebuffer: displayFbo, color: [0.5, 0.5, 0.55, 1], depth: 1 })
            heatmapCols.forEach(col => renderColumn(col, settings, totalExpression));

            const divisor = 6.0;
            display({ texture: totalExpression, divisor, target: displayFbo, start: [0.1, 0.0, 0.2], middle: [0.95, 0.6, 0.01], end: [0.99, 0.99, 0.87] })
        } else {
            console.error('SLIDE BASED VIEW NOT SUPPORTED YET!!!')
            return;
        }
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
    };
}

