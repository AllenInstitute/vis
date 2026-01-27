
// we have to generate a shader, due to the runtime-variable way in which columns of data
// are used for filtering (some in a range, some via a lookup table)

import REGL from "regl";
import type { ScatterbrainDataset, SlideviewScatterbrainDataset } from "./types";
import { filter, keys, mapValues, reduce } from "lodash";
import { Box2D, type vec4, type box2D, type Interval, type vec2 } from "@alleninstitute/vis-geometry";
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
    
    float isHovered(){
        ${utils.isHovered}
    }
    vec3 getDataPosition(){
        ${utils.getDataPosition}
    }
    float isFilteredIn(){
        ${utils.isFilteredIn}
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
    tableSize: vec2;
    gradientTable: string;
    positionColumn: string;
    colorByColumn: string;
}
function rangeFor(col: string) {
    return `${col}_range`;
}
export type RenderProps = {
    target: REGL.Framebuffer2D | null,
    categoricalLookupTable: REGL.Texture2D,
    gradient: REGL.Texture2D,
    camera: { view: box2D, screenResolution: vec2 },
    offset: vec2,
    filteredOutColor: vec4,
    spatialFilterBox: box2D,
    quantitativeRangeFilters: Record<string, vec2>,
    hoveredValue: number,
    item: {
        count: number,
        columnData: Record<string, VBO>
    }
}
export function buildScatterbrainRenderCommand(config: Config, regl: REGL.Regl) {
    const prop = (p: string) => regl.prop<any, string>(p)
    const { quantitativeColumns, categoricalColumns, categoricalTable, gradientTable, positionColumn } = config;
    const ranges = reduce(quantitativeColumns, (unis, col) => ({ ...unis, [rangeFor(col)]: prop(rangeFor(col)) }), {} as Record<string, REGL.DynamicVariable<any>>);
    const { vs, fs } = buildShaders(config);
    const uniforms = {
        [categoricalTable]: prop('categoricalLookupTable'),
        [gradientTable]: prop('gradient'),
        ...ranges,
        spatialFilterBox: prop('spatialFilterBox'),
        filteredOutColor: prop('filteredOutColor'),
        view: prop('view'),
        hoveredValue: prop('hoveredValue'),
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
    return (props: RenderProps) => {
        const { target, hoveredValue, spatialFilterBox, filteredOutColor, gradient, camera, offset, quantitativeRangeFilters, categoricalLookupTable, item } = props
        const filterRanges = reduce(keys(quantitativeRangeFilters), (acc, cur) => ({ ...acc, [rangeFor(cur)]: quantitativeRangeFilters[cur] }), {})
        const { view, screenResolution } = camera
        const { count, columnData } = item;
        const rawBuffers = mapValues(columnData, (vbo) => vbo.buffer.buffer)
        cmd({ target, gradient, hoveredValue, filteredOutColor, spatialFilterBox: Box2D.toFlatArray(spatialFilterBox), categoricalLookupTable, offset, count, view: Box2D.toFlatArray(view), screenSize: screenResolution, ...filterRanges, ...rawBuffers })
    }
}

function rangeFilterExpression(qColumns: readonly string[]) {
    return qColumns.map(attrib =>/*glsl*/`within(${attrib},${rangeFor(attrib)})`).join(' * ')
}
function categoricalFilterExpression(cColumns: readonly string[], tableSize: vec2, tableName: string) {
    // categorical columns are in order - this array will have the same order as the col in the texture
    const [w, h] = tableSize;
    // return /*glsl*/`step(0.01,texture2D(${tableName},vec2(0.5,${cColumns[0]}+0.5)/vec2(${w.toFixed(1)},${h.toFixed(1)})).a)`
    return cColumns.map((attrib, i) =>
        /*glsl*/`step(0.01,texture2D(${tableName},vec2(${i.toFixed(0)}.5,${attrib}+0.5)/vec2(${w.toFixed(1)},${h.toFixed(1)})).a)`)
        .join(' * ')
}

export function generate(config: Config): ScatterbrainShaderUtils {
    const { mode, quantitativeColumns, categoricalColumns, categoricalTable, tableSize, gradientTable, positionColumn, colorByColumn } = config;
    console.log('tableSize: ', tableSize)
    const catFilter = categoricalFilterExpression(categoricalColumns, tableSize, categoricalTable)
    console.log('cat filter: ', catFilter)
    const rangeFilter = rangeFilterExpression(quantitativeColumns)
    const uniforms = /*glsl*/`
    uniform vec4 view;
    uniform vec2 screenSize;
    uniform vec2 offset;
    uniform vec4 spatialFilterBox;
    uniform vec4 filteredOutColor;
    uniform float hoveredValue;

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
    float within(float v, vec2 range){
        return step(range.x,v)*step(v,range.y);
    }
    `
    const categoryColumnIndex = categoricalColumns.indexOf(colorByColumn);
    const isCategoricalColor = categoryColumnIndex > -1
    const hoverCategoryExpr = /*glsl*/`1.0-step(0.1,abs(${colorByColumn}-hoveredValue))`
    const isHovered = /*glsl*/`
        return ${isCategoricalColor ? hoverCategoryExpr : '0.0'};`
    const isFilteredIn = /*glsl*/`
    vec3 p = getDataPosition();
    return within(p.x,spatialFilterBox.xz)*within(p.y,spatialFilterBox.yw)
    * ${catFilter.length > 0 ? catFilter : '1.0'}
    * ${rangeFilter.length > 0 ? rangeFilter : '1.0'};
      `

    const getDataPosition = /*glsl*/`return vec3(${positionColumn}+offset,0.0);`
    const getClipPosition = /*glsl*/`return applyCamera(getDataPosition());`
    const getPointSize = /*glsl*/`return mix(2.0,6.0,isHovered());` // todo!
    // todo - use config options!
    // if the colorByColumn is a categorical column, generate that
    // else, use a range-colorby
    const [w, h] = tableSize;
    const colorByCategorical = /*glsl*/`
    vec4(texture2D(${categoricalTable},vec2(${categoryColumnIndex.toFixed(0)}.5,${colorByColumn}+0.5)/vec2(${w.toFixed(1)},${h.toFixed(1)})).rgb,1.0)`

    const colorByQuantitative = /*glsl*/`
    texture2D(${gradientTable},vec2(rangeParameter(${colorByColumn},${rangeFor(colorByColumn)}),0.5))
    `
    const colorize = categoryColumnIndex != -1 ? colorByCategorical : colorByQuantitative

    const colorByCategoricalId = /*glsl*/` 
        float G = mod(${colorByColumn},256.0);
        float R = mod(${colorByColumn}/256.0,256.0);
        return vec4(R/255.0,G/255.0,0,1);
    `
    const colorByQuantitativeValue = /*glsl*/` 
        return vec4(0,rangeParameter(${colorByColumn},${rangeFor(colorByColumn)}),0,1);
    `
    const getColor = mode === 'color' ? /*glsl*/`
        return mix(filteredOutColor,${colorize},isFilteredIn());
    ` :
        (categoryColumnIndex === -1 ? colorByQuantitativeValue : colorByCategoricalId)
    console.log(getColor)
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
    categoricalFilters: Record<string, number> // category name -> maximum # of distinct values in that category
    quantitativeFilters: readonly string[] // the names of quantitative variables
    mode: 'color' | 'info',
    colorBy: { kind: 'metadata', column: string } | { kind: 'quantitative', column: string, gradient: 'viridis' | 'inferno', range: Interval }
}



export function configureShader(settings: ShaderSettings): { config: Config, columnNameToShaderName: Record<string, string> } {
    // given settings that make sense to a caller (stuff about the data we want to visualize)
    // produce an object that can be used to set up some internal config of the shader that would
    // do the visualization
    const { dataset, categoricalFilters, quantitativeFilters, colorBy, mode } = settings;
    console.log('cat filters...', categoricalFilters)
    // figure out the columns we care about
    // assign them names that are safe to use in the shader (A,B,C, whatever)
    const categories = keys(categoricalFilters).toSorted()
    const numCategories = categories.length;
    const longest = reduce(keys(categoricalFilters), (highest, cur) => Math.max(highest, categoricalFilters[cur]), 0)
    const qAttrs = reduce(quantitativeFilters.toSorted(), (acc, cur, i) => ({ ...acc, [cur]: `MEASURE_${i.toFixed(0)}` }), colorBy.kind === 'metadata' ? {} : { [colorBy.column]: 'COLOR_BY_MEASURE' } as Record<string, string>);
    const cAttrs = reduce(categories, (acc, cur, i) => ({ ...acc, [cur]: `CATEGORY_${i.toFixed(0)}` }), colorBy.kind === 'metadata' ? { [colorBy.column]: 'COLOR_BY_CATEGORY' } : {} as Record<string, string>);
    const colToAttribute = { ...qAttrs, ...cAttrs, [dataset.metadata.spatialColumn]: 'position' };

    const config: Config = {
        categoricalColumns: keys(cAttrs).map(columnName => colToAttribute[columnName]),
        quantitativeColumns: keys(qAttrs).map(columnName => colToAttribute[columnName]),
        categoricalTable: 'lookup',
        gradientTable: 'gradient',
        colorByColumn: colToAttribute[colorBy.column],
        mode,
        positionColumn: 'position',
        tableSize: [Math.max(numCategories, 1), Math.max(1, longest)]
    }
    return { config, columnNameToShaderName: colToAttribute }
}