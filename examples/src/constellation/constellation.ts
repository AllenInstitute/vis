import { Box2D, Vec2, type box2D, type vec2, type vec3 } from "@alleninstitute/vis-geometry";
import REGL from "regl";
import type { Camera } from "../common/camera";
import { createRoot } from "react-dom/client";
import { AsyncDataCache, ReglLayer2D } from "@alleninstitute/vis-scatterbrain";
import type { CacheEntry } from "../types";
import { buildImageRenderer } from "../common/image-renderer";
import { createUmapDataset, type UmapConfig, type UmapScatterplot } from "../data-sources/scatterplot/umap";
import type { OptionalTransform } from "../data-sources/types";
import { buildTaxonomyRenderer, renderTaxonomyUmap, type RenderSettings, type RenderSettings as TaxRenderSettings } from "./taxonomy-renderer";
import type { ColumnBuffer, ColumnRequest } from "~/common/loaders/scatterplot/scatterbrain-loader";
import { query, resolve, type CellPropertiesConnection, type Maybe } from "~/gqty";
import { nodeData } from "./nodes";
import { keys } from "lodash";
import { numNodes, type Graph, visitChildParentPairs, visitOldestAncestors } from "./taxonomy-graph";
const flipBox = (box: box2D): box2D => {
    const { minCorner, maxCorner } = box;
    return { minCorner: [minCorner[0], maxCorner[1]], maxCorner: [maxCorner[0], minCorner[1]] };
};
const uiroot = createRoot(document.getElementById('sidebar')!);

// a demo for playing with constellation plot ideas.


// teh first ting to mess with is animating points through a heirarchy of positions...
// a cell has a class, subclass, cluster, and super cluster
// each value in those feature-types will now have a position associated with it - the centroid
// of that thing in umap space.
const Class: ColumnRequest = {
    type: 'METADATA',
    name: 'FS00DXV0T9R1X9FJ4QE'
}
const SubClass: ColumnRequest = {
    type: 'METADATA',
    name: 'QY5S8KMO5HLJUF0P00K'
}
const SuperType: ColumnRequest = {
    type: 'METADATA',
    name: '15BK47DCIOF1SLLUW9P'
}
const Cluster: ColumnRequest = {
    type: 'METADATA',
    name: 'CBGC0U30VV9JPR60TJU'
}

function destroyer(item: CacheEntry) {
    switch (item.type) {
        case 'texture2D':
        case 'vbo':
            item.data.destroy();
            break;
        case 'mesh':
            item.data.points.destroy();
            break;
        default:
            // @ts-expect-error
            console.error(item.data, 'implement a destroyer for this case!');
            break;
    }
}
function sizeOf(item: CacheEntry) {
    return 1;
}
export class Demo {
    camera: Camera;
    regl: REGL.Regl;
    canvas: HTMLCanvasElement;
    mouse: 'up' | 'down';
    mode: 'draw' | 'pan';
    mousePos: vec2;
    taxonomyData: REGL.Texture2D;
    txSize: vec2;
    layer: undefined | ReglLayer2D<UmapScatterplot, RenderSettings<CacheEntry>>;
    plot: UmapScatterplot | undefined;
    anmParam: number;
    goal: number;
    interval: number;
    private refreshRequested: number = 0;
    graphs: Record<string, Graph<string, TaxonomyNode, TaxonomyEdge>>;
    cache: AsyncDataCache<string, string, CacheEntry>;
    imgRenderer: ReturnType<typeof buildImageRenderer>;
    taxRenderer: ReturnType<typeof buildTaxonomyRenderer>;
    // private redrawRequested: number = 0;
    pointSize: number;
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
        this.regl = regl;
        this.mode = 'pan'
        this.mouse = 'up'
        this.mousePos = [0, 0];
        this.pointSize = 4;
        this.interval = 0;
        this.anmParam = 0;;
        this.goal = 0;
        this.canvas = canvas;
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h],
            projection: 'webImage',
        };
        this.imgRenderer = buildImageRenderer(regl);
        this.taxRenderer = buildTaxonomyRenderer(regl);
        this.cache = new AsyncDataCache<string, string, CacheEntry>(destroyer, sizeOf, 4000);
        this.initHandlers(canvas);
        this.taxonomyData = regl.texture({ width: 5, height: 6000, format: 'rgba', type: 'float' });
        this.txSize = [5, 6000];
        this.loadTaxonomyInfo();
        this.graphs = {}
    }
    mouseButton(click: 'up' | 'down', pos: vec2) {
        this.mouse = click;

    }
    private toDataspace(px: vec2) {
        const { view } = this.camera;
        const o: vec2 = [px[0], this.canvas.clientHeight - px[1]];
        const p = Vec2.div(o, [this.canvas.clientWidth, this.canvas.clientHeight]);
        const c = Vec2.mul(p, Box2D.size(view));
        return Vec2.add(view.minCorner, c);
    }
    mouseMove(delta: vec2, pos: vec2) {
        if (this.mode === 'pan') {
            if (this.mouse === 'down') {
                // drag the view
                const { screen, view } = this.camera;
                const p = Vec2.div(delta, [this.canvas.clientWidth, this.canvas.clientHeight]);
                const c = Vec2.mul(p, Box2D.size(view));
                this.camera = { ...this.camera, view: Box2D.translate(view, c), screen };
                this.onCameraChanged();
            }
        }
        this.mousePos = Vec2.add(this.mousePos, delta);
    }
    zoom(scale: number) {
        const { view, screen } = this.camera;
        const m = Box2D.midpoint(view);
        this.camera = {
            ...this.camera,
            view: Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m),
            screen,
        };
        this.onCameraChanged();
    }
    private onCameraChanged() {
        if (this.layer && this.plot) {
            this.layer?.onChange({
                data: this.plot,
                settings: {
                    animationParam: this.anmParam,
                    cache: this.cache,
                    callback: () => { this.requestReRender() },
                    camera: this.camera,
                    Class,
                    Cluster,
                    SubClass, // TODO!
                    SuperType,
                    taxonomyPositions: this.taxonomyData,
                    taxonomySize: this.txSize,
                    dataset: this.plot.dataset,
                    pointSize: this.pointSize,
                    regl: this.regl,
                    renderer: this.taxRenderer
                }
            })
            this.requestReRender();
        }

    }
    private async loadTaxonomyInfo() {
        // read a bunch of junk, join it with some stuff from IDF
        // put the whole pile in this.taxonomyData...
        // gimmeTaxonomy(datsetId,'v0',[Class.name,SubClass.name,SuperType.name,Cluster.name])
        // buildTexture().then(({ texture, size }) => {
        //     this.taxonomyData = this.regl.texture({ data: texture, width: size[0], height: size[1], format: 'rgba', type: 'float' })
        //     this.txSize = size;
        //     console.log('texture loaded!');
        //     this.requestReRender();
        // })
        this.graphs = await buildTaxonomyGraph();

    }
    private initHandlers(canvas: HTMLCanvasElement) {
        canvas.onmousedown = (e: MouseEvent) => {
            this.mouseButton('down', [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onmouseup = (e: MouseEvent) => {
            this.mouseButton('up', [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onmousemove = (e: MouseEvent) => {
            // account for gl-origin vs. screen origin:
            this.mouseMove([-e.movementX, e.movementY], [e.offsetX, canvas.clientHeight - e.offsetY]);
        };
        canvas.onwheel = (e: WheelEvent) => {
            this.zoom(e.deltaY > 0 ? 1.1 : 0.9);
        };
        window.onkeyup = (e: KeyboardEvent) => {
            if (e.key === 'w') {
                this.anmParam += 0.0331;
                this.onCameraChanged();
            } else if (['0', '1', '2', '3', '4'].includes(e.key)) {
                this.goal = Number.parseInt(e.key);
            } else if (e.key === 's') {
                this.anmParam -= 0.0331;
                this.onCameraChanged();
            } else if (e.key === 'a') {
                if (this.interval === 0) {
                    let lastFrameTime = performance.now();
                    const intervalMS = 16; //60fps
                    const progressPerMS = 2 / 1000;
                    this.interval = window.setInterval(() => {
                        const now = performance.now()
                        const delta = now - lastFrameTime;
                        lastFrameTime = now
                        if (this.goal == this.anmParam) {
                            return;
                        }
                        if (Math.abs(this.goal - this.anmParam) < progressPerMS * delta) {
                            this.anmParam = this.goal;
                            this.onCameraChanged();
                        }
                        if (this.goal != this.anmParam) {
                            const progress = progressPerMS * delta
                            this.anmParam += (this.goal > this.anmParam) ? progress : -progress
                            this.onCameraChanged();
                        }
                    }, intervalMS)
                } else {
                    window.clearInterval(this.interval);
                    this.interval = 0;
                }

            }
        }
    }
    loadData(config: UmapConfig) {
        const [w, h] = this.camera.screen;
        return createUmapDataset(config).then((plot) => {
            this.plot = plot;
            this.camera = { ...this.camera, view: plot.dataset.bounds };
            this.layer = new ReglLayer2D<UmapScatterplot & OptionalTransform, RenderSettings<CacheEntry>>(
                this.regl,
                this.imgRenderer,
                renderTaxonomyUmap,
                [w, h]
            );
        });
    }
    requestReRender() {
        if (this.refreshRequested === 0) {
            this.refreshRequested = window.requestAnimationFrame(() => {
                this.refreshScreen();
                this.refreshRequested = 0;
                // uiroot?.render(TopoUi({ demo: this }));
            });
        }
    }
    refreshScreen() {
        this.regl.clear({ framebuffer: null, color: [0, 0, 0, 1], depth: 1 })
        if (this.layer) {
            let img = this.layer.getRenderResults('prev');
            img = img.bounds === undefined ? this.layer.getRenderResults('cur') : img;
            if (img.bounds) {
                // const flipped = Box2D.toFlatArray(flipBox(this.camera.view));
                this.imgRenderer({
                    img: img.texture,
                    box: Box2D.toFlatArray(img.bounds),
                    target: null,
                    view: Box2D.toFlatArray(this.camera.view)
                })

            }

        }
    }
}
let theDemo: Demo;

function demoTime(thing: HTMLCanvasElement) {
    if (theDemo !== undefined) {
        return theDemo;
    }
    thing.width = thing.clientWidth;
    thing.height = thing.clientHeight;

    const offscreen = thing;
    const gl = offscreen.getContext('webgl', {
        alpha: true,
        preserveDrawingBuffer: true,
        antialias: true,
        premultipliedAlpha: true,
    });
    if (!gl) {
        throw new Error('WebGL not supported!');
    }
    const regl = REGL({
        gl,
        extensions: ['ANGLE_instanced_arrays', 'OES_texture_float', 'WEBGL_color_buffer_float'],
    });
    theDemo = new Demo(thing, regl);
    theDemo.loadData(fancy);
    theDemo.requestReRender();
}
// const cls = 'FS00DXV0T9R1X9FJ4QE'
// const superclass = 'QY5S8KMO5HLJUF0P00K'
const datsetId = 'Q1NCWWPG6FZ0DNIXJBQ'
const tenx = `https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/G4I4GFJXJB9ATZ3PTX1/ScatterBrain.json`
// 'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json';
const fancy: UmapConfig = {
    url: tenx,
    type: 'UmapConfig',
}
demoTime(document.getElementById('glCanvas') as HTMLCanvasElement);


// lets try GQty to pull in the metadata for cell types
// we need that so that indexing will line up in the shader...

async function gimmeTaxonomy(datasetId: string, version: string, cellTypeColumns: string[]) {
    const getNodes = (conn: Maybe<CellPropertiesConnection>) => ({
        nodes: conn?.nodes?.map(n => ({
            color: n.color,
            index: n.featureTypeValueIndex.index,
            title: n.featureType.title,
            value: n.featureTypeValueIndex.value
        }))
    })
    // figuring out where junk goes is weird... and I proxies dont help,
    // but now its looking pretty nice!
    const everything = await resolve(({ query: { cellProperties } }) => ({
        ...getNodes(cellProperties({
            first: 6000,
            where:
            {
                and: [
                    { dataset: { referenceId: { eq: datasetId }, version: { eq: version } } },
                    { featureType: { referenceId: { in: cellTypeColumns } } }
                ]
            }
        }))
    }));
    return everything.nodes;
}

export function mapBy<K extends string, T extends Record<K, string>>(items: readonly T[], k: K): Record<string, T & { idx: number }> {
    const dictionary: Record<string, T & { idx: number }> = {};
    items.forEach((item, index) => {
        dictionary[item[k]] = { ...item, idx: index };
    });
    return dictionary;
}

export function hexToRgb(hex: string): vec3 {
    const shorthandRegex = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
    const fullHex = hex.replace(shorthandRegex, (_m, r, g, b) => r + r + g + g + b + b);

    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fullHex);
    if (result && result.length === 4) {
        return [parseInt(result[1], 16), parseInt(result[2], 16), parseInt(result[3], 16)];
    }
    return [0.0, 0.0, 0.0];
}

// ok - parse our csv file of taxonomy node positions...
// then join that onto the cell props from the IDF
async function buildTexture() {
    const A = gimmeTaxonomy(datsetId, 'v0', [Class.name]).then((data) => mapBy(data ?? [], 'value'))
    const B = gimmeTaxonomy(datsetId, 'v0', [SubClass.name]).then((data) => mapBy(data ?? [], 'value'))
    const C = gimmeTaxonomy(datsetId, 'v0', [SuperType.name]).then((data) => mapBy(data ?? [], 'value'))
    const D = gimmeTaxonomy(datsetId, 'v0', [Cluster.name]).then((data) => mapBy(data ?? [], 'value'))
    const [classes, subclasses, supertypes, clusters] = await Promise.all([A, B, C, D])
    // we have to stash all this in a nice, high-precision buffer:
    // RGBA (4) x 5 (each level + color) * longest column
    const longestCol = Math.max(...[classes, subclasses, supertypes, clusters].map((m) => keys(m).length))
    const texture = new Float32Array(5 * 4 * longestCol);
    const txFloatOffset = (col: number, row: number) => (row * 5 * 4) + col * 4;
    const lvls = {
        class: { map: classes, column: 0 },
        subclass: { map: subclasses, column: 1 },
        supertype: { map: supertypes, column: 2 },
        cluster: { map: clusters, column: 3 }
    }
    const data = nodeData;
    const lines = data.split('\n');
    // for each line, read in the bits...
    // level,level_name,label,name,parent,n_cells,centroid_x,centroid_y
    // here, name = 'value' from the idf cellPropertyConnection node thingy
    // levelName is class, subclass, etc...
    for (const line of lines) {
        const [level, levelName, label, name, parent, numCells, cx, cy] = line.split(',');
        const L = lvls[levelName.toLowerCase() as keyof typeof lvls];
        if (L) {
            const info = L.map[name];
            if (info) {
                if (L.column === 0) {
                    const clrOffset = txFloatOffset(4, info.index);
                    const rgb = hexToRgb(info.color ?? '0xFF0000');
                    texture[clrOffset] = rgb[0] / 255;
                    texture[clrOffset + 1] = rgb[1] / 255;
                    texture[clrOffset + 2] = rgb[2] / 255;
                }
                const offset = txFloatOffset(L.column, info.index);
                texture[offset] = Number.parseFloat(cx);
                texture[offset + 1] = Number.parseFloat(cy);
                texture[offset + 2] = 5 - L.column;
            } else {
                console.error('no such taxon (csv mistake?)', name)
            }
        } else {
            // complain!
            console.error('no such level (csv mistake?)', levelName)
        }
    }
    return { texture, size: [5, longestCol] as vec2 }
}
type TaxonomyEntry = { index: number, color: Maybe<string> | undefined }
type TaxonomyNode = { id: string, parent: string | null, index: number, count: number, pos: vec2, color: string }
type TaxonomyEdge = { start: string, end: string, count: number }
async function buildTaxonomyGraph() {
    const A = gimmeTaxonomy(datsetId, 'v0', [Class.name]).then((data) => mapBy(data ?? [], 'value'))
    const B = gimmeTaxonomy(datsetId, 'v0', [SubClass.name]).then((data) => mapBy(data ?? [], 'value'))
    const C = gimmeTaxonomy(datsetId, 'v0', [SuperType.name]).then((data) => mapBy(data ?? [], 'value'))
    const D = gimmeTaxonomy(datsetId, 'v0', [Cluster.name]).then((data) => mapBy(data ?? [], 'value'))
    const [cls, subclass, supertype, cluster] = await Promise.all([A, B, C, D])

    const idfInfo: Record<string, Record<string, TaxonomyEntry>> = {
        class: cls, subclass, supertype, cluster
    }
    const data = nodeData;
    const lines = data.split('\n');
    // for each line, read in the bits...
    // level,level_name,label,name,parent,n_cells,centroid_x,centroid_y
    // here, name = 'value' from the idf cellPropertyConnection node thingy
    // levelName is class, subclass, etc...
    const graphs: Record<string, Graph<string, TaxonomyNode, TaxonomyEdge>> = {}
    for (const line of lines) {
        const [level, levelName, label, name, parent, numCells, cx, cy] = line.split(',');
        const taxonomyName = levelName.toLowerCase()
        if (!graphs[taxonomyName]) {
            graphs[taxonomyName] = { nodes: {}, edges: [], parent: null };
        }
        const taxonomy = graphs[taxonomyName];
        if (taxonomyName in idfInfo) {
            const IDFEntry: Record<string, TaxonomyEntry> = idfInfo[taxonomyName]
            const { index, color } = IDFEntry[name]
            graphs[taxonomyName] = {
                ...taxonomy,
                nodes: {
                    ...taxonomy.nodes,
                    [name]:
                    {
                        id: name, parent,
                        count: Number.parseInt(numCells),
                        index,
                        color: color ?? '0x00',
                        pos: [Number.parseFloat(cx), Number.parseFloat(cy)]
                    }
                }
            }

        }
    }
    return graphs;
}

function buildAnimationBuffers(layer: number, graph: Graph<string, TaxonomyNode, TaxonomyEdge>) {
    // fill in a float buffer that has pairs {index,layer}
    const nodes = numNodes(graph)
    const A = new Float32Array(nodes * 3)
    const B = new Float32Array(nodes * 3)
    const color = new Uint8Array(nodes * 4);
    let offset = 0;

    // get the colors...
    visitOldestAncestors(graph, (me: TaxonomyNode, parent: TaxonomyNode | null) => {
        const [r, g, b] = hexToRgb(parent?.color ?? '0xff0000')
        color[offset] = r;
        color[offset + 1] = g;
        color[offset + 2] = b;
        color[offset + 3] = 255;
        offset += 4;
    });

    offset = 0;
    visitChildParentPairs(graph, (me: TaxonomyNode, parent: TaxonomyNode | null) => {

        A[offset] = me.pos[0];
        A[offset + 1] = me.pos[1];
        A[offset + 2] = me.count;
        // fill in the parent, use 'me' if it has no parent
        B[offset] = parent?.pos[0] ?? me.pos[0]
        B[offset + 1] = parent?.pos[1] ?? me.pos[1]
        B[offset + 2] = parent?.count ?? me.count;
        offset += 3
    });
    return { child: A, parent: B, nodes, color };
}