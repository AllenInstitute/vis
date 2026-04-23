import type { vec2 } from "@alleninstitute/vis-geometry";
import type { ScatterbrainShaderUtils } from "../webgl/shader";

function rangeFor(col: string) {
    return `${col}_range`;
}

function rangeFilterExpression(quantitativeColumns: readonly string[]) {
    return quantitativeColumns.map((attrib) => /*wgsl*/ `within(v.${attrib},unis.${rangeFor(attrib)})`).join(' * ');
}
function categoricalFilterExpression(categoricalColumns: readonly string[], tableSize: vec2, tableName: string) {
    // categorical columns are in order - this array will have the same order as the col in the texture
    const [w, h] = tableSize;
    return categoricalColumns
        .map(
            (attrib, i) =>
                /*wgsl*/ `step(0.01,textureLoad(${tableName}, vec2u(${i.toFixed(0)},v.${attrib}),0).a)`,
        )
        .join(' * ');
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
    highlightByColumn: string;
};

export function generate(config: Config): string {
    const {
        mode,
        quantitativeColumns,
        categoricalColumns,
        categoricalTable,
        tableSize,
        gradientTable,
        positionColumn,
        colorByColumn,
        highlightByColumn,
    } = config;
    const catFilter = categoricalFilterExpression(categoricalColumns, tableSize, categoricalTable);
    const rangeFilter = rangeFilterExpression(quantitativeColumns);


    const categoryColumnIndex = categoricalColumns.indexOf(colorByColumn);

    const [w, h] = tableSize;
    const colorByCategorical = /*wgsl*/ `
    vec4(textureLoad(${categoricalTable},vec2u(${categoryColumnIndex.toFixed(0)},v.${colorByColumn}),0).rgb,1.0)`;

    const colorByQuantitative = /*wgsl*/ `
    textureLoad(${gradientTable},vec2u(vec2(rangeParameter(${colorByColumn},unis.${rangeFor(colorByColumn)})*f32(textureDimensions(${gradientTable}).x),0.0)),0)
    `;
    const colorize = categoryColumnIndex !== -1 ? colorByCategorical : colorByQuantitative;

    // todo support picking mode
    return /*wgsl*/ `
    // attribs //
    struct Vertex {
        @builtin(vertex_index) vIndex: u32,
        @location(0) ${positionColumn}: vec2f,
        ${categoricalColumns.map((col, i) => /*wgsl*/ `@location(${i + 1}) ${col}:u32,`).join('\n')}
        ${quantitativeColumns.map((col, i) => /*wgsl*/ `@location(${i + 1 + categoricalColumns.length}) ${col}:f32,`).join('\n')}
    };
    // uniforms //
    struct Uniforms {
        view: vec4f,
        spatialFilterBox:vec4f,
        filteredOutColor: vec4f,
        highlightColor: vec4f,
        screenSize:vec2f,
        offset:vec2f,
        highlightValue: u32,
        // quantitative columns each need a range value - its the min,max in a vec2
        ${quantitativeColumns.map((col) => /*wgsl*/ `${rangeFor(col)}:vec2f,`).join('\n')}
    };

    @group(0) @binding(0)
    var<uniform> unis:Uniforms;
    
    // texture bindings... no longer considered uniform...
    // TIL textureSampler is banned in vertex stage... neat
    @group(0) @binding(1) var ${categoricalTable}: texture_2d<f32>;
    @group(0) @binding(2) var ${gradientTable}: texture_2d<f32>;
    
    // utility functions //
    fn applyCamera(dataPos:vec2f, view:vec4f)->vec4f {
        let size = view.zw-view.xy;
        let unit = (dataPos.xy-view.xy)/size;
        return vec4f((unit*2.0)-1.0,0.0,1.0);
    }
    fn rangeParameter(v:f32,range:vec2f)->f32{
        return (v-range.x)/(range.y-range.x);
    }
    fn within( v:f32,  range:vec2f)->f32{
        return step(range.x,v)*step(v,range.y);
    }

    struct VsOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
    };

    const clip = array<vec2f,4>(
            vec2f(1, -1), 
            vec2f(1, 1),  
            vec2f(-1, -1),
            vec2f(-1, 1)
        );

    @vertex
    fn vmain(v:Vertex)->VsOutput{
        var out: VsOutput;

        // lets directly compute stuff, rather than helper functions
        // this might be what people want with tgpu - much easier to synthesize a shader
        // but also crazy annoying in its own way I think...
        let p = v.${positionColumn};
        let withinFilterBox = within(p.x,unis.spatialFilterBox.xz)*within(p.y,unis.spatialFilterBox.yw);
        let filteredIn: f32 = withinFilterBox *
            ${catFilter.length > 0 ? catFilter : '1.0'}
          * ${rangeFilter.length > 0 ? rangeFilter : '1.0'};
        
        // highlighting
        let highlighted = 1.0-step(0.1,abs(f32(v.${highlightByColumn}-unis.highlightValue)));

        // from filtering, we can compute color
        let baseColor = ${colorize};
        let clr = mix(unis.filteredOutColor, baseColor, filteredIn);

        // point size (todo make this a uniform...)
        // todo: handle offset (slides)
        let R = 2.0;
        let dPos = clip[v.vIndex]*R + p;
        out.color = clr;
        out.position = applyCamera(dPos,unis.view);
        return out;
    }
    `;

}