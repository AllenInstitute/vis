import REGL, { type Framebuffer2D } from 'regl';
import { Box2D, Vec2, type box2D, type vec2, type vec4 } from '@alleninstitute/vis-geometry';
import type { ColumnarTree, ColumnBuffer, ColumnRequest } from '~/common/loaders/scatterplot/scatterbrain-loader';
import type { Camera } from '~/common/camera';
import { beginLongRunningFrame, type AsyncDataCache } from '@alleninstitute/vis-scatterbrain';
import type { RenderCallback } from './types';
import type { UmapScatterplot } from '~/data-sources/scatterplot/umap';
import { applyOptionalTrn } from './utils';
import { fetchItem, getVisibleItems } from '~/common/loaders/scatterplot/data';
import { buildContourRenderer } from './contour';

type Props = {
    view: vec4;
    count: number;
    pointSize: number;
    position: REGL.Buffer;
    color: REGL.Buffer;
    metadataFilter:number;
    offset?: vec2 | undefined;
    target: Framebuffer2D | null;
};
const RESOLUTION = 1024;
export function buildHeightMapRenderer(regl: REGL.Regl) {
    // build the regl command first
    const secrets = regl.framebuffer({
        width:RESOLUTION,
        height:RESOLUTION,
        colorType:'float'
    })
    // const contourCmd = buildContourRenderer(regl);
    const cmd = regl<
        { view: vec4; offset: vec2; pointSize: number, metadataFilter:number },
        { position: Float32Array; metadata: Float32Array },
        Props
    >({
        vert: `
    precision highp float;
    attribute vec2 position;
    attribute float metadata;
    
    uniform float pointSize;
    uniform vec4 view;
    uniform vec2 offset;
    uniform float metadataFilter;

    varying float contribution;
    
    void main(){
        gl_PointSize=pointSize;
        vec2 size = view.zw-view.xy;
        vec2 pos = ((position+offset)-view.xy)/size;
        vec2 clip = (pos*2.0)-1.0;
        if(metadata == metadataFilter){
            contribution = 1.0;
        }else {
            contribution = 0.0;//-step(0.1, metadata-metadataFilter);

        }
        gl_Position = vec4(clip,0.0,1);
    }`,
        frag: `
        precision highp float;
    varying float contribution;
    void main(){
        float d = length(gl_PointCoord.xy - vec2(0.5,0.5));
        if(d>0.5) {
        discard;
        }
        float r = smoothstep(0.0,0.5,0.5-d);
         gl_FragColor = vec4((2.0*contribution*r)/1.0,mix(0.6,0.0,step(0.03,d)),mix(1.0-contribution,0.0,step(0.03,d)),1.0);
    }`,
        attributes: {
            metadata: regl.prop<Props, 'color'>('color'),
            position: regl.prop<Props, 'position'>('position'),
        },
        uniforms: {
            metadataFilter:regl.prop<Props, 'metadataFilter'>('metadataFilter'),
            view: regl.prop<Props, 'view'>('view'),
            offset: regl.prop<Props, 'offset'>('offset'),
            pointSize: regl.prop<Props, 'pointSize'>('pointSize'),
        },

        blend: {
            enable: true, 
            func: {
                srcRGB: 'one',
                dstRGB:'one',
                srcAlpha: 'zero',
                dstAlpha:'zero'
            },
            equation:'add',
        },
        depth:{
            enable:false,
        },
        framebuffer: regl.prop<Props, 'target'>('target'),
        count: regl.prop<Props, 'count'>('count'),
        primitive: 'points',
    });
    
    const renderDots = (
        item: ColumnarTree<vec2> & { offset?: vec2 | undefined },
        settings: {pointSize:number,filter:number, view:box2D,target:REGL.Framebuffer2D|null},
        columns: Record<string, ColumnBuffer | object | undefined>
    ) => {
        const { color:metadata, position } = columns;
        const {filter} = settings;
        const count = item.content.count;
        if (
            metadata &&
            position &&
            'type' in metadata &&
            'type' in position &&
            metadata.type === 'vbo' &&
            position.type === 'vbo'
        ) {
            // regl.clear({framebuffer:secrets,color:[0,0,0,0]})
            cmd({
                view: Box2D.toFlatArray(settings.view),
                count,
                position: position.data,
                pointSize: settings.pointSize,
                metadataFilter:filter,
                color: metadata.data,
                offset: item.offset ?? [0, 0],
                target: settings.target,
            });
            
            // contourCmd({
            //     view:  Box2D.toFlatArray(settings.view),
            //     // box:  Box2D.toFlatArray(settings.view),
            //     heightmap: secrets,
            //     txStep: [1/RESOLUTION,1/RESOLUTION],
            //     color: [1,1,1,1],
            //     target: settings.target
            // })
        } else {
            // todo freak out!
            throw new Error('omg the internet lied to me');
        }
    };
    return renderDots;
}

type CacheContentType = {
    type: 'vbo';
    data: REGL.Buffer;
};

type Renderer = ReturnType<typeof buildHeightMapRenderer>;
export type RenderSettings<C> = {
    camera: Camera;
    cache: AsyncDataCache<string, string, C>;
    renderer: Renderer;
    regl: REGL.Regl;
    callback: RenderCallback;
    concurrentTasks?: number;
    queueInterval?: number;
    cpuLimit?: number;
};
const cacheKey = (reqKey: string, item: ColumnarTree<vec2>, settings: { colorBy: ColumnRequest }) =>
    `${reqKey}:${item.content.name}:${settings.colorBy.name}|${settings.colorBy.type}`;

export function renderTopographicUmap<C extends CacheContentType | object>(
    target: REGL.Framebuffer2D | null,
    umap: UmapScatterplot,
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

    const { dataset, colorBy, pointSize,filter } = umap;
    const unitsPerPixel = Vec2.div(Box2D.size(view), screen);

    camera = { ...camera, view: applyOptionalTrn(camera.view, umap.toModelSpace, true) };
    // camera = camera.projection === 'webImage' ? flipY(camera) : camera;
    const items = getVisibleItems(umap.dataset, settings.camera.view, 10 * unitsPerPixel[0]);
    // make the frame, return some junk
    return beginLongRunningFrame(
        concurrentTasks,
        queueInterval,
        items,
        cache,
        { view, dataset, target,filter, colorBy, regl, pointSize },
        fetchItem,
        renderer,
        callback,
        cacheKey,
        cpuLimit
    );
}