import REGL, { type Framebuffer2D } from 'regl';
import { Box2D, Vec2, type box2D, type vec2, type vec4 } from '@alleninstitute/vis-geometry';
import type { ColumnarTree, ColumnBuffer, ColumnRequest, ScatterplotDataset } from '~/common/loaders/scatterplot/scatterbrain-loader';
import { fetchAndUpload, getVisibleItems, getVisibleItemsInSlide, type Dataset } from '~/common/loaders/scatterplot/data';
import type { Camera } from '~/common/camera';
import { beginLongRunningFrame, type AsyncDataCache, type RenderCallback } from '@alleninstitute/vis-scatterbrain';
import { applyOptionalTrn } from '~/data-renderers/utils';
import type { UmapScatterplot } from '~/data-sources/scatterplot/umap';

type InnerRenderSettings = {
    Class: ColumnRequest;
    SubClass: ColumnRequest;
    SuperType: ColumnRequest;
    Cluster: ColumnRequest;
    camera: Camera,
    target: REGL.Framebuffer2D | null,
    taxonomyPositions: REGL.Texture2D,
    taxonomySize: vec2,
    animationParam: number;
    pointSize: number;
    colorBy: number;
    dataset: ScatterplotDataset,
    filter_out_hack: number;
    regl: REGL.Regl
}
type Props = {
    view: vec4;
    itemDepth: number;
    count: number;
    pointSize: number;
    position: REGL.Buffer;

    Class: REGL.Buffer,
    SubClass: REGL.Buffer,
    SuperType: REGL.Buffer,
    Cluster: REGL.Buffer,

    colorBy: number;
    // taxonomy data - packed in class/sub/super/cluster order textures
    taxonomyPositions: REGL.Texture2D, // size = [4x |class/sub/super/cluster|]
    //format (rgba32 {x,y,pointSize})
    taxonomySize: vec2, // size of the taxonomy texture in pixels
    animationParam: number,
    offset?: vec2 | undefined;
    target: Framebuffer2D | null;
    filter_out_hack: number;
};
function bufferIsLegit(b: object | undefined): b is ColumnBuffer {
    return !!b && 'type' in b && b.type == 'vbo'
}
export function buildTaxonomyRenderer(regl: REGL.Regl) {
    // build the regl command first
    const cmd = regl<
        { view: vec4; itemDepth: number; colorBy: number; offset: vec2; pointSize: number, taxonomySize: vec2, animationParam: number, taxonomyPositions: REGL.Texture2D, filter_out_hack: number },
        {
            position: REGL.Buffer;
            Class: REGL.Buffer,
            SubClass: REGL.Buffer,
            SuperType: REGL.Buffer,
            Cluster: REGL.Buffer,
        },
        Props
    >({
        vert: `
    precision highp float;
    attribute vec2 position;

    attribute float Class;
    attribute float SubClass;
    attribute float SuperType;
    attribute float Cluster;
    
    uniform float colorBy;
    uniform float pointSize;
    uniform vec4 view;
    uniform float itemDepth;
    uniform vec2 offset;
    uniform float filter_out_hack;

    uniform vec2 taxonomySize;
    uniform sampler2D taxonomyPositions;

    // animation control //
    uniform float animationParam;
    // animationParam: an encoded value:
    // floor(p) => startTaxonomy
    // ceil(p) => endTaxonomy
    // fract(p) => [0:1] mix between start and end above
    // 0,1,2,3,4,5 ==> class, subclass, supercluster, cluster, position

    varying vec4 clr;
    float getColorAttr(){
        if(colorBy < 5.0){
            return Class;
        }else if(colorBy<6.0){
            return SubClass;
        }else if(colorBy<7.0){
            return SuperType;
        }else {
            return Cluster;
        }
    }
    // I'd use an array, but array access must be compile-time constant in this version of GLSL :(
    vec4 getTaxonomyData(float p){
        // todo: make me branchless
        float u = (p+0.5)/taxonomySize.x;
        float vS = taxonomySize.y;

        if(p == 0.0){
            return texture2D(taxonomyPositions, vec2(u,(Class+0.5)/vS));
        }
        if(p == 1.0){
            return texture2D(taxonomyPositions, vec2(u,(SubClass+0.5)/vS));
        }
        if(p == 2.0){
            return texture2D(taxonomyPositions, vec2(u,(SuperType+0.5)/vS));
        }
        if(p == 3.0){
            return texture2D(taxonomyPositions, vec2(u,(Cluster+0.5)/vS));
        }
        return vec4(position,1.0,2.71828);
    }
    // ye olde "noise" trick from the internet:
    vec2 rand(vec2 co){
        return vec2(fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453),fract(sin(dot(co.yx, vec2(12.9898, 78.233))) * 54758.5453));
    }
    vec2 polarNoise(vec2 co){
        vec2 uni = rand(co);
        float theta = uni.y*3.14159*2.0;
        float R = uni.x;
        vec2 P = vec2(R*cos(theta),R*sin(theta));
        // annoyingly, kinda uniform concentric rings...
        return P;
    }
    vec2 visualAggregate(vec4 P, float dotScale){
        // compress the true UMAP position into a little range around the taxonomy centroid
        // fuzz the true position with a little chaos to better distribute ultra-high density regions
        float numCells = P.w;
        // a good radius for this many cells is R where the circle with radius R has area = numCells.... maybe?
        // A = pi*R*R -> sqrt(numCells/PI) = R
        // then put that area in data space...
        float R = sqrt(numCells/3.14159)/dotScale;

        vec2 mini = polarNoise(position.xy);
        vec2 tiny = 6.5*R*pointSize*(position.xy-P.xy)/dotScale;
        mini *= R*pointSize; 
        mini = mix(mini,tiny,0.5);
        
        return P.xy + mini;
    }

    void main(){
        vec4 p1 = getTaxonomyData(floor(animationParam));
        vec4 p2 = getTaxonomyData(floor(animationParam)+1.0);


        vec4 P = mix(p1,p2, fract(animationParam));
        float dotScale = 500.0; // TODO use the radius of the dataset instead of this made-up number
        gl_PointSize= 6.0;//log(P.w); //mix(8.0,3.0,animationParam/5.0);
        P.xy = visualAggregate(P, dotScale);
        vec2 size = view.zw-view.xy;
        vec2 pos = ((P.xy+offset)-view.xy)/size;
        vec2 clip = (pos*2.0)-1.0;
        vec3 rgb = texture2D(taxonomyPositions, vec2((colorBy+0.5)/taxonomySize.x,(getColorAttr()+0.5)/taxonomySize.y)).rgb;
        // hack: pretend we're filtering by sub-type = something
        rgb = abs(SubClass - filter_out_hack)<0.5 ? vec3(1) : rgb;
        clr = vec4(rgb,1.0);
        
        gl_Position = vec4(clip,-1.0+itemDepth/1000.0,1);
    }`,
        frag: `
        #extension GL_EXT_frag_depth : enable
        precision highp float;
        varying vec4 clr;
        void main(){
        if(length(gl_PointCoord-0.5)>0.5){
            discard;
        }
        gl_FragDepthEXT = (length(gl_PointCoord - 0.5)/3.0);
        gl_FragColor = clr;
    }`,
        attributes: {
            Class: regl.prop<Props, 'Class'>('Class'),
            SubClass: regl.prop<Props, 'SubClass'>('SubClass'),
            SuperType: regl.prop<Props, 'SuperType'>('SuperType'),
            Cluster: regl.prop<Props, 'Cluster'>('Cluster'),
            position: regl.prop<Props, 'position'>('position'),
        },
        uniforms: {
            itemDepth: regl.prop<Props, 'itemDepth'>('itemDepth'),
            filter_out_hack: regl.prop<Props, 'filter_out_hack'>('filter_out_hack'),
            view: regl.prop<Props, 'view'>('view'),
            offset: regl.prop<Props, 'offset'>('offset'),
            pointSize: regl.prop<Props, 'pointSize'>('pointSize'),
            colorBy: regl.prop<Props, 'colorBy'>('colorBy'),
            taxonomyPositions: regl.prop<Props, 'taxonomyPositions'>('taxonomyPositions'),
            taxonomySize: regl.prop<Props, 'taxonomySize'>('taxonomySize'),
            animationParam: regl.prop<Props, 'animationParam'>('animationParam'),
        }, depth: {
            enable: true,
        },
        blend: {
            enable: false,
        },
        framebuffer: regl.prop<Props, 'target'>('target'),
        count: regl.prop<Props, 'count'>('count'),
        primitive: 'points',
    });
    const renderDots = (
        item: ColumnarTree<vec2> & { offset?: vec2 | undefined },
        settings: InnerRenderSettings,
        columns: Record<string, ColumnBuffer | object | undefined>
    ) => {
        const { Class, Cluster, SubClass, SuperType, position } = columns;
        const { taxonomyPositions, taxonomySize, colorBy, animationParam, camera, pointSize, target, filter_out_hack } = settings
        const view = camera.view;
        const count = item.content.count;
        const itemDepth = item.content.depth;
        if (bufferIsLegit(position) && bufferIsLegit(Class) &&
            bufferIsLegit(SubClass) && bufferIsLegit(SuperType) &&
            bufferIsLegit(Cluster)) {
            cmd({
                view: Box2D.toFlatArray(view),
                count,
                colorBy,
                itemDepth,
                position: position.data,
                Class: Class.data,
                SubClass: SubClass.data,
                SuperType: SuperType.data,
                Cluster: Cluster.data,
                taxonomyPositions,
                taxonomySize,
                filter_out_hack,
                animationParam,
                pointSize,
                offset: item.offset ?? [0, 0],
                target: target,
            });
        } else {
            throw new Error('omg')
        }
    };
    return renderDots;
}


export function fetchTaxonomyItems(item: ColumnarTree<vec2>, settings: InnerRenderSettings, signal?: AbortSignal) {
    const { dataset, Class, SubClass, SuperType, Cluster } = settings;
    const position = () =>
        fetchAndUpload(settings, item.content, { type: 'METADATA', name: dataset.spatialColumn }, signal);
    const cls = () => fetchAndUpload(settings, item.content, Class, signal);
    const sub = () => fetchAndUpload(settings, item.content, SubClass, signal);
    const spr = () => fetchAndUpload(settings, item.content, SuperType, signal);
    const clstr = () => fetchAndUpload(settings, item.content, Cluster, signal);
    return {
        position,
        Class: cls,
        SubClass: sub,
        SuperType: spr,
        Cluster: clstr,
    } as const;
}

type CacheContentType = {
    type: 'vbo';
    data: REGL.Buffer;
};

type Renderer = ReturnType<typeof buildTaxonomyRenderer>;
export type RenderSettings<C> = {
    camera: Camera;
    cache: AsyncDataCache<string, string, C>;
    renderer: Renderer;
    callback: RenderCallback;
    concurrentTasks?: number;
    queueInterval?: number;
    cpuLimit?: number;
} & Omit<InnerRenderSettings, 'target'>;

// TODO: this cache key is totally insufficient!
const cacheKey = (reqKey: string, item: ColumnarTree<vec2>, settings: InnerRenderSettings) =>
    `${reqKey}:${item.content.name}`;

export function renderTaxonomyUmap<C extends CacheContentType | object>(
    target: REGL.Framebuffer2D | null,
    dataset: UmapScatterplot,
    settings: RenderSettings<C>
) {
    const {
        cache,
        camera: { view, screen },
        renderer,
        callback,
        regl,
    } = settings;
    let { camera, concurrentTasks, queueInterval, cpuLimit } = settings;

    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 3;
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33;
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined;

    const unitsPerPixel = Vec2.div(Box2D.size(view), screen);

    camera = { ...camera, view: applyOptionalTrn(camera.view, dataset.toModelSpace, true) };
    // because we move points around with our taxonomy shader, we cant rely on the positions in the quad-tree to 
    // let us cut down the points we request... for now just get all of them!
    const items = getVisibleItems(dataset.dataset, dataset.dataset.bounds, 200 * unitsPerPixel[0]);
    // make the frame, return some junk
    const inner: InnerRenderSettings = {
        ...settings,
        target,

    }
    return beginLongRunningFrame(
        concurrentTasks,
        queueInterval,
        items,
        cache,
        inner,
        fetchTaxonomyItems,
        renderer,
        callback,
        cacheKey,
        cpuLimit
    );
}