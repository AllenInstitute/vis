
import { match } from 'ts-pattern'
import { vec4, type Interval } from '@alleninstitute/vis-geometry'
type ScatterplotShaderConfig = {
    categoricalFilters: readonly string[][] // the set of column names that have active filters in them. these will be mapped to vertex attributes COLUMN_${index}
    // our original approach used the column names as vertex attrib names in-shader code. in addition to requiring sanitization
    //  this was not any less confusing than generic "COLUMN_X" naming, as the names are ref-ids anyway.

    internalNames: {
        lookup: 'lookupTable',
        tableSize: 'tableSize',
    }
}


// this shader... has to support a lot of features!
/*
1. filter by N columns
2. color by a column-lookup, or by a gradient, overridden by filtering status
3. hover - which is powered by the filter-data (we pack extra info into the alpha channel...)
4. exfiltrate data like cell id and expression values via color-out
5. configurable Z-axis settings (high-expression cells in front, filtered out in back, etc)
6. size-change on hover

*/
const attrib = (i: number) => `COLUMN_${i.toFixed(0)}`
export function generateShader(config: ScatterplotShaderConfig) {


    const { categoricalFilters, internalNames } = config;
    const { lookup, tableSize } = internalNames
    // we do still want to generate shaders - there are going to be a bunch of shaders that are only slightly different from each other
    // and so a templated approach can be good
    const categoryOrder = categoricalFilters.flat().reduce((acc, cur, i) => ({ ...acc, [cur]: i }), {} as Record<string, number>)
    const readColumnSnippet = (i: number) =>/*glsl*/`texture2D(${lookup},vec2(${i.toFixed(0)}.5/${tableSize}.x , (${attrib(i)}+0.5)/${tableSize}.y))`
    const readColumnFilterStatus = (i: number) => `step(0.5,${readColumnSnippet(i)}.a)`
    // the snippet that powers filtering - a cell is filtered in if and only if lookup-table[COLUMN_X] has a non-zero alpha value for every "X"
    const filteredInSnippet = categoricalFilters.map((OR) =>
        `(${OR.map((category) => readColumnFilterStatus(categoryOrder[category])).join('+')})`).join('*')

    // returns a string that performs the filtering logic -
    // in pseudocode, and example might be (lookup(COL_0))*(lookup(COL_1)+lookup(COL_2))

    // this computes the CNF-style filter COL_0 AND (COL_1 OR COl_2)
    // note that the returned string will be filled with inline GLSL and will look way less legible than the above comment, as it must deal with texture sizes, offsets, etc...
    // return filteredInSnippet

    // a dot can be hovered
    // it has a radius, depth, and a color, and is either filtered in or out
    // we're going to define glsl functions that define all these aspects
    // note that they're not all completely independant - for example we'd like to move filtered-out cells to the back
    // in cases like that, we would call getIsFilteredIn() from within getDepth()



}

// of course - the most flexible thing would be to let user's of this system write whatever shader they like
// thats nice, but I think lets try a more "configure based on a few options" path for now

type DepthMode = { mode: 'quantitative', column: number, gamut: Interval, reverse?: boolean } | { mode: 'constant', value: number }
type CellDepthConfig = {
    hovered: DepthMode,
    filteredOut: DepthMode,
    normal: DepthMode,
}
function getDepth(config: CellDepthConfig) {
    const depthValueSnippet = (mode: DepthMode) =>
        match(mode)
            .with({ mode: 'constant' }, (c) => `${c.value}`)
            .otherwise(({ column, gamut, reverse }) =>  /*glsl*/`clamp(-1.0,1.0,${reverse ? '-' : ''}(${attrib(column)}-${gamut.min})/${gamut.max - gamut.min})`)

    const { hovered, filteredOut, normal } = config;
    return /*glsl*/`float getDepth(){
        return mix(
            ${depthValueSnippet(filteredOut)},
            mix(${depthValueSnippet(normal)},${depthValueSnippet(hovered)},isHovered()),
            getIsFilteredIn());
    }`
}
type CellFilterConfig = {
    lookup: string;
    tableSize: string;
    CNFColumns: number[][] // CNF = Clausal normal form, ANDs of ORs, like so: [[3,4],[1,0,2]] reads (3 OR 4) AND (1 OR 0 OR 2). the numbers are the column indexes.
}
// TODO: we have at least 3 different types of filtering
// categorical CNF-style filtering, spatial filtering (the selection box)
// and range-filtering, supporting the interesection of multiple quantitative columns at once
// 

function getIsFilteredIn(config: CellFilterConfig) {
    const { lookup, tableSize, CNFColumns } = config;

    // TODO this does not handle Quantitative filters at all!

    const readColumnSnippet = (i: number) =>/*glsl*/`texture2D(${lookup},vec2(${i.toFixed(0)}.5/${tableSize}.x , (${attrib(i)}+0.5)/${tableSize}.y))`
    const readColumnFilterStatus = (i: number) => `step(0.1,${readColumnSnippet(i)}.a)`
    // the snippet that powers filtering - a cell is filtered in if and only if lookup-table[COLUMN_X] has a non-zero alpha value for every "X"
    const filteredInSnippet = CNFColumns.map((OR) =>
        `(${OR.map((category) => readColumnFilterStatus(category)).join('+')})`).join('*')

    return /*glsl*/`float getIsFilteredIn(){
        return ${filteredInSnippet};
    }`
}
type CellHoverConfig = {
    hoverColumn: number;
    lookup: string;
    tableSize: string;
}
function getIsHovered(config: CellHoverConfig) {
    const { hoverColumn, lookup, tableSize } = config;
    const readColumnSnippet = (i: number) =>/*glsl*/`texture2D(${lookup},vec2(${i.toFixed(0)}.5/${tableSize}.x , (${attrib(i)}+0.5)/${tableSize}.y))`
    // note the 0.5 here - the alpha value > 0.1 implies filtered in (in this category at least) - alpha > 0.5 implies filtered in and hovered
    const readColumnFilterStatus = (i: number) => `step(0.5,${readColumnSnippet(i)}.a)`
    return /*glsl*/`float getIsHovered(){
        return ${readColumnFilterStatus(hoverColumn)};
    }`
}
type CellRadiusConfig = {

}
function getRadius(config: CellRadiusConfig) {
    return /*glsl*/`float getRadius(){
        return 2.0; // TODO
    }`
}

type ColorMode = { mode: 'categorical', column: number } | { mode: 'constant', value: vec4 } | { mode: 'quantitative', column: number, gamut: string }
// todo: 2 color modes to render ids - either the quantitative value or the color-by category value of the cell

type CellColorConfig = {
    gradient: string;
    lookup: string;
    tableSize: string;
    hovered: ColorMode,
    filteredOut: ColorMode,
    normal: ColorMode,
}
function getColor(config: CellColorConfig) {
    // TODO: handle missing values, which are sometimes encoded as NaN, and sometimes just 0.0
    const { gradient, hovered, filteredOut, normal, tableSize, lookup } = config;
    const readColumnSnippet = (i: number) =>/*glsl*/`texture2D(${lookup},vec2(${i.toFixed(0)}.5/${tableSize}.x , (${attrib(i)}+0.5)/${tableSize}.y))`
    const readGradientSnippet = (col: number, gamut: string) =>/*glsl*/`texture2D(${gradient}, vec2((${attrib(col)}-${gamut}.x)/(${gamut}.y-${gamut}.x), 0.5))`

    const snippet = (mode: ColorMode) =>
        match(mode)
            .with({ mode: 'categorical' }, (cat) =>/*glsl*/`vec4(${readColumnSnippet(cat.column)}.rgb,1.0)`)
            .with({ mode: 'constant' }, (flat) =>/*glsl*/`vec4(${flat.value.map(v => v.toFixed(4)).join(',')})`)
            .otherwise(({ column, gamut }) =>/*glsl*/`vec4(${readGradientSnippet(column, gamut)})`)

    return /*glsl*/`vec4 getColor(){
        return mix(
                ${snippet(filteredOut)},
                mix(${snippet(normal)}, ${snippet(hovered)}, isHovered()),
            getIsFilteredIn());
    }`
}