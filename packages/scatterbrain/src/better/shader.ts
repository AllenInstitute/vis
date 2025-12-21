
// we have to generate a shader, due to the runtime-variable way in which columns of data
// are used for filtering (some in a range, some via a lookup table)

import REGL from "regl";
import type { ScatterbrainDataset, SlideviewScatterbrainDataset } from "./types";
import { filter, keys, mapValues, reduce } from "lodash";
import { Box2D, type box2D, type Interval, type vec2 } from "@alleninstitute/vis-geometry";
import { type Cacheable, type CachedVertexBuffer } from "@alleninstitute/vis-core";

// the set of columns and what to do with them can vary
// there might be 3 categorical columns and 2 range columns
// each range column (a vertex attrib) uses a uniform vec2 as its filter range
// due to a variety of limitations in WebGL / GLSL 1 - this is about as general as we can
// get without a great deal of extra performance cost


// scatterbrain does scatterplot rendering
// its main claim to fame is handling complex filtering
// when generating shaders, most of the variable parts flow through these
// utilities - this type's fields are the names of GLSL functions - the contents
// of the string must be the body of that function. All functions should take NO arguments
// and simply refer to global uniforms / attribs directly.
// as a quick reminder - recursion of any kind is forbidden in GLSL - so be careful
// as it will not be possible to detect this until runtime.
// its not unreasonable for some of these utils to call each other - just be sure to 
// avoid recursion!
// note - you dont have to use these! these are just kinda like guide-rails for
// patterns we've seen in our shaders so far! you could easily generate your own
// totally custom shaders!

type ScatterbrainShaderUtils = {
    uniforms: string;   // the GLSL declarations of the uniforms for this shader
    attributes: string; // the GLSL declarations of the vertex attributes for this shader
    commonUtilsGLSL: string; // prepend any GLSL to the final vertex shader
    isFilteredIn: string; // ()->float
    isHovered: string; // ()->float
    getColor: string; // ()-> vec4
    getDataPosition: string; // ()-> vec3 // the position of the point in data-space
    getClipPosition: string; // ()-> vec4 // the position of the point in clip space - (hint - apply the camera to data-space)
    getPointSize: string; // ()->float
}
export class VBO implements Cacheable {
    buffer: CachedVertexBuffer;
    constructor(buffer: CachedVertexBuffer) {
        this.buffer = buffer;
    }
    destroy() {
        this.buffer.buffer.destroy()
    }
    sizeInBytes() {
        return this.buffer.bytes;
    }
}

function buildVertexShader(utils: ScatterbrainShaderUtils) {
    return /*glsl*/`
    precision highp float;
    // attribs //
    ${utils.attributes}
    // uniforms //
    ${utils.uniforms}
    
    // utility functions //
    ${utils.commonUtilsGLSL}

    // per-point interface functions //
    float isFilteredIn(){
        ${utils.isFilteredIn}
    }
    float isHovered(){
        ${utils.isHovered}
    }
    vec3 getDataPosition(){
        ${utils.getDataPosition}
    }
    // the primary per-point functions, called directly //
    vec4 getClipPosition(){
        ${utils.getClipPosition}
    }
    float getPointSize(){
        ${utils.getPointSize}
    }
    vec4 getColor(){
        ${utils.getColor}
    }
    varying vec4 color;
    void main(){
        color = getColor();
        gl_PointSize = getPointSize();
        gl_Position = getClipPosition();
    }
    `
    // note that only getColor, getPointSize, and getPosition are called
    // that should make clear that the other fns are indended to simply be useful
    // concepts that the other main fns can call
}
export function buildShaders(config: Config) {
    return {
        vs: buildVertexShader(generate(config)),
        fs: /*glsl*/`
        precision highp float;
        varying vec4 color;
        void main(){
            gl_FragColor = color;
        }
        `
    }
}
export type Config = {
    mode: 'color' | 'info';
    quantitativeColumns: string[];
    categoricalColumns: string[];
    categoricalTable: string;
    gradientTable: string;
    positionColumn: string;
    colorByColumn: string;
}
function rangeFor(col: string) {
    return `${col}_range`;
}

export function buildScatterbrainRenderCommand(config: Config, regl: REGL.Regl) {
    const prop = (p: string) => regl.prop<any, string>(p)
    const { mode, quantitativeColumns, categoricalColumns, categoricalTable, gradientTable, positionColumn } = config;
    const ranges = reduce(quantitativeColumns, (unis, col) => ({ ...unis, [rangeFor(col)]: prop(rangeFor(col)) }), {} as Record<string, REGL.DynamicVariable<any>>);
    const { vs, fs } = buildShaders(config);
    const uniforms = {
        [categoricalTable]: prop('categoricalLookupTable'),
        [gradientTable]: prop('gradient'),
        ...ranges,
        view: prop('view'),
        screenSize: prop('screenSize'),
        offset: prop('offset'),
    }
    const cmd = regl({
        vert: vs,
        frag: fs,
        attributes: [positionColumn, ...categoricalColumns, ...quantitativeColumns].reduce((attribs, col) => ({ ...attribs, [col]: regl.prop<any, string>(col) }), {}),
        uniforms,
        blend: {
            enable: false
        },
        primitive: 'points',
        framebuffer: prop('target'),
        count: prop('count')
    });
    // 
    return (props: {
        target: REGL.Framebuffer2D | null,
        categoricalLookupTable: REGL.Texture2D,
        gradient: REGL.Texture2D,
        camera: { view: box2D, screenResolution: vec2 },
        offset: vec2,
        quantitativeRangeFilters: Record<string, vec2>,
        item: {
            count: number,
            columnData: Record<string, VBO>
        }
    }) => {
        const { target, gradient, camera, offset, quantitativeRangeFilters, categoricalLookupTable, item } = props
        const filterRanges = reduce(keys(quantitativeRangeFilters), (acc, cur) => ({ ...acc, [rangeFor(cur)]: quantitativeRangeFilters[cur] }), {})
        const { view, screenResolution } = camera
        const { count, columnData } = item;
        const rawBuffers = mapValues(columnData, (vbo) => vbo.buffer.buffer)
        cmd({ target, gradient, categoricalLookupTable, offset, count, view: Box2D.toFlatArray(view), screenSize: screenResolution, ...filterRanges, ...rawBuffers })
    }
}

export function generate(config: Config): ScatterbrainShaderUtils {
    const { mode, quantitativeColumns, categoricalColumns, categoricalTable, gradientTable, positionColumn, colorByColumn } = config;

    const uniforms = /*glsl*/`
    uniform vec4 view;
    uniform vec2 screenSize;
    uniform vec2 offset;
    uniform sampler2D ${gradientTable};
    uniform sampler2D ${categoricalTable};
    // quantitative columns each need a range value - its the min,max in a vec2
    ${quantitativeColumns.map((col) =>/*glsl*/`uniform vec2 ${rangeFor(col)};`).join('\n')}
    `

    const attributes = /*glsl*/`
    attribute vec2 ${positionColumn};
    ${categoricalColumns.map((col) =>/*glsl*/`attribute float ${col};`).join('\n')}
    ${quantitativeColumns.map((col) =>/*glsl*/`attribute float ${col};`).join('\n')}
    `

    const commonUtilsGLSL = /*glsl*/`
    vec4 applyCamera(vec3 dataPos){
        vec2 size = view.zw-view.xy;
        vec2 unit = (dataPos.xy-view.xy)/size;
        return vec4((unit*2.0)-1.0,0.0,1.0);
    }
    float rangeParameter(float v, vec2 range){
        return (v-range.x)/(range.y-range.x);
    }
    `

    const isHovered = /*glsl*/`return 0.0;` // todo hovering
    const isFilteredIn = /*glsl*/`return 1.0;` // todo filtering! 

    const getDataPosition = /*glsl*/`return vec3(${positionColumn}+offset,0.0);`
    const getClipPosition = /*glsl*/`return applyCamera(getDataPosition());`
    const getPointSize = /*glsl*/`return 2.0;` // todo!
    const getColor = /*glsl*/`
    float p = rangeParameter(${colorByColumn},${rangeFor(colorByColumn)});
    return texture2D(${gradientTable},vec2(p,0.5));
    ` // for now, lets assume this is a color-by-quantitative shader...


    return {
        attributes,
        uniforms,
        commonUtilsGLSL,
        getClipPosition,
        getColor,
        getDataPosition,
        getPointSize,
        isFilteredIn,
        isHovered,
    }
}


// these settings impact how the shader is generated -
// that means changing them may require re-building the renderer (and the shader beneath it)
export type ShaderSettings = {
    dataset: ScatterbrainDataset | SlideviewScatterbrainDataset
    categoricalFilters: Record<string, Record<number, boolean>> // category-->{value : filteredIn}
    quantitativeFilters: Record<string, Interval>
    colorBy: { kind: 'metadata', column: string } | { kind: 'quantitative', column: string, gradient: 'viridis' | 'inferno', range: Interval }
}



export function configureShader(settings: ShaderSettings): { config: Config, columnNameToShaderName: Record<string, string> } {
    // given settings that make sense to a caller (stuff about the data we want to visualize)
    // produce an object that can be used to set up some internal config of the shader that would
    // do the visualization
    const { dataset, categoricalFilters, quantitativeFilters, colorBy } = settings;
    // figure out the columns we care about
    // assign them names that are safe to use in the shader (A,B,C, whatever)

    const qAttrs = reduce(keys(quantitativeFilters).toSorted(), (acc, cur, i) => ({ ...acc, [cur]: `MEASURE_${i.toFixed(0)}` }), colorBy.kind === 'metadata' ? {} : { [colorBy.column]: 'COLOR_BY_MEASURE' } as Record<string, string>);
    const cAttrs = reduce(keys(categoricalFilters).toSorted(), (acc, cur, i) => ({ ...acc, [cur]: `CATEGORY_${i.toFixed(0)}` }), colorBy.kind === 'metadata' ? { [colorBy.column]: 'COLOR_BY_CATEGORY' } : {} as Record<string, string>);
    const colToAttribute = { ...qAttrs, ...cAttrs, [dataset.metadata.spatialColumn]: 'position' };

    const config: Config = {
        categoricalColumns: keys(cAttrs).map(columnName => colToAttribute[columnName]),
        quantitativeColumns: keys(qAttrs).map(columnName => colToAttribute[columnName]),
        categoricalTable: 'lookup',
        gradientTable: 'gradient',
        colorByColumn: colToAttribute[colorBy.column],
        mode: 'color',
        positionColumn: 'position',
    }
    return { config, columnNameToShaderName: colToAttribute }
}