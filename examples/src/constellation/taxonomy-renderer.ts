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
    target:REGL.Framebuffer2D|null,
    taxonomyPositions: REGL.Texture2D,
    taxonomySize: vec2,
    animationParam:number;
    pointSize: number;
    dataset:ScatterplotDataset,
    regl:REGL.Regl
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
    // taxonomy data - packed in class/sub/super/cluster order textures
    taxonomyPositions: REGL.Texture2D, // size = [4x |class/sub/super/cluster|]
    //format (rgba32 {x,y,pointSize})
    taxonomySize: vec2, // size of the taxonomy texture in pixels
    animationParam: number,
    offset?: vec2 | undefined;
    target: Framebuffer2D | null;
};
function bufferIsLegit(b: object | undefined): b is ColumnBuffer {
    return !!b && 'type' in b && b.type == 'vbo'
}
export function buildTaxonomyRenderer(regl: REGL.Regl) {
    // build the regl command first
    const cmd = regl<
        { view: vec4; itemDepth: number; offset: vec2; pointSize: number, taxonomySize: vec2, animationParam: number, taxonomyPositions: REGL.Texture2D },
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
    
    uniform float pointSize;
    uniform vec4 view;
    uniform float itemDepth;
    uniform vec2 offset;

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

    // I'd use an array, but array access must be compile-time constant in this version of GLSL :(
    vec3 getTaxonomyData(float p){
        // todo: make me branchless
        float u = p/taxonomySize.x;
        float vS = taxonomySize.y;

        if(p == 0.0){
            return texture2D(taxonomyPositions, vec2(u,Class/vS)).rgb;
        }
        if(p == 1.0){
            return texture2D(taxonomyPositions, vec2(u,SubClass/vS)).rgb;
        }
        if(p == 2.0){
            return texture2D(taxonomyPositions, vec2(u,SuperType/vS)).rgb;
        }
        if(p == 3.0){
            return texture2D(taxonomyPositions, vec2(u,Cluster/vS)).rgb;
        }
        return vec3(position,1.0);
    }
    // vec3 bendy(vec3 start, vec3 middle, vec3 end, float p){
    //     vec3 goal = mix(middle,end, p);
    //     return mix(start, goal, p);
    // }

    void main(){
        // vec3 p0 = getTaxonomyData(floor(animationParam)-1.0);
        vec3 p1 = getTaxonomyData(floor(animationParam));
        vec3 p2 = getTaxonomyData(floor(animationParam)+1.0);
        // vec2 mDir = normalize(p0.xy - p1.xy);
        // vec2 M = p1.xy + mDir * length(p2.xy - p1.xy)/3.0;
        // vec3 middle = vec3(M.x,M.y,p2.z);

        // vec3 P = bendy(p1,middle,p2,fract(animationParam));
        vec3 P = mix(p1,p2, fract(animationParam));

        gl_PointSize=pointSize*P.z;
        vec2 size = view.zw-view.xy;
        vec2 pos = ((P.xy+offset)-view.xy)/size;
        vec2 clip = (pos*2.0)-1.0;
        vec3 rgb = texture2D(taxonomyPositions, vec2(4.0/taxonomySize.x,(Class)/taxonomySize.y)).rgb;
        
        clr = vec4(rgb,1.0);
        
        gl_Position = vec4(clip,itemDepth/1000.0,1);
    }`,
        frag: `
        precision highp float;
        varying vec4 clr;
        void main(){
        if(length(gl_PointCoord-0.5)>0.5){
            discard;
        }
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
            view: regl.prop<Props, 'view'>('view'),
            offset: regl.prop<Props, 'offset'>('offset'),
            pointSize: regl.prop<Props, 'pointSize'>('pointSize'),
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
        const {taxonomyPositions,taxonomySize,animationParam,camera,pointSize,target}=settings
        const view = camera.view;
        const count = item.content.count;
        const itemDepth = item.content.depth;
        if (bufferIsLegit(position) && bufferIsLegit(Class) &&
            bufferIsLegit(SubClass) && bufferIsLegit(SuperType) &&
            bufferIsLegit(Cluster)) {
            cmd({
                view: Box2D.toFlatArray(view),
                count,
                itemDepth,
                position: position.data,
                Class:Class.data,
                SubClass:SubClass.data,
                SuperType:SuperType.data,
                Cluster: Cluster.data,
                taxonomyPositions,
                taxonomySize,
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
    const { dataset, Class,SubClass,SuperType,Cluster } = settings;
    const position = () =>
        fetchAndUpload(settings, item.content, { type: 'METADATA', name: dataset.spatialColumn }, signal);
    const cls = () => fetchAndUpload(settings, item.content, Class, signal);
    const sub = () => fetchAndUpload(settings, item.content, SubClass, signal);
    const spr = () => fetchAndUpload(settings, item.content, SuperType, signal);
    const clstr = () => fetchAndUpload(settings, item.content, Cluster, signal);
    return {
        position,
        Class:cls,
        SubClass:sub,
        SuperType:spr,
        Cluster:clstr,
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

    concurrentTasks = concurrentTasks ? Math.abs(concurrentTasks) : 5;
    queueInterval = queueInterval ? Math.abs(queueInterval) : 33;
    cpuLimit = cpuLimit ? Math.abs(cpuLimit) : undefined;

    const unitsPerPixel = Vec2.div(Box2D.size(view), screen);

    camera = { ...camera, view: applyOptionalTrn(camera.view, dataset.toModelSpace, true) };
    // camera = camera.projection === 'webImage' ? flipY(camera) : camera;
    const items = getVisibleItems(dataset.dataset, settings.camera.view, 10 * unitsPerPixel[0]);
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