import { isEqual, keys, map } from 'lodash';
import { beginValidate, endValidate } from './validate';
import * as wgh from 'webgpu-utils';
import type { vec2, vec4 } from '@alleninstitute/vis-geometry';
import { setCategoricalLookupTableValues } from './lookup-texture';

function rangeFor(col: string): `${string}_range` {
    return `${col}_range`;
}

function rangeFilterExpression(quantitativeColumns: readonly string[]) {
    return quantitativeColumns.map((attrib) => /*wgsl*/ `within(v.${attrib},unis.${rangeFor(attrib)})`).join(' * ');
}
function categoricalFilterExpression(categoricalColumns: readonly string[], tableName: string) {
    // categorical columns are in order - this array will have the same order as the col in the texture
    return categoricalColumns
        .map((attrib, i) => /*wgsl*/ `step(0.01,textureLoad(${tableName}, vec2u(${i.toFixed(0)},v.${attrib}),0).a)`)
        .join(' * ');
}

export type Config = {
    mode: 'color' | 'info';
    quantitativeColumns: string[];
    categoricalColumns: string[];
    categoricalTable: string;
    gradientTable: string;
    positionColumn: string;
    colorByColumn: string;
    highlightByColumn: { kind: 'quantitative' | 'metadata'; column: string };
    vertexLocationOrder: string[];
};
type QuantitativeFilterRanges = Record<`${string}_range`, vec2>;
// the type of the uniforms on the TS side of the fence
export type Uniforms = {
    view: vec4;
    spatialFilterBox: vec4;
    filteredOutColor: vec4;
    highlightColor: vec4;
    screenSize: vec2;
    offset: vec2;
    highlightValue: number;
} & QuantitativeFilterRanges;

export function generate(config: Config): string {
    const {
        mode,
        quantitativeColumns,
        categoricalColumns,
        categoricalTable,
        gradientTable,
        positionColumn,
        colorByColumn,
        highlightByColumn,
    } = config;
    const catFilter = categoricalFilterExpression(categoricalColumns, categoricalTable);
    const rangeFilter = rangeFilterExpression(quantitativeColumns);

    const categoryColumnIndex = categoricalColumns.indexOf(colorByColumn);

    const colorByCategorical = /*wgsl*/ `
    vec4(textureLoad(${categoricalTable},vec2u(${categoryColumnIndex.toFixed(0)},v.${colorByColumn}),0).rgb,1.0)`;

    const colorByQuantitative = /*wgsl*/ `
    textureLoad(${gradientTable},vec2u(vec2(rangeParameter(${colorByColumn},unis.${rangeFor(colorByColumn)})*f32(textureDimensions(${gradientTable}).x),0.0)),0)
    `;
    const colorize = categoryColumnIndex !== -1 ? colorByCategorical : colorByQuantitative;

    // todo support picking mode
    const catStart = 1;
    const quantStart = catStart + categoricalColumns.length;
    return /*wgsl*/ `
    // attribs //
    struct Vertex {
        @builtin(vertex_index) vIndex: u32,
        @location(0) ${positionColumn}: vec2f,
        ${categoricalColumns.map((col, i) => /*wgsl*/ `@location(${i + catStart}) ${col}:u32,`).join('\n')}
        ${quantitativeColumns.map((col, i) => /*wgsl*/ `@location(${i + quantStart}) ${col}:f32,`).join('\n')}
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
        let highlighted = 1.0-step(0.1,abs(f32(v.${highlightByColumn.column}-unis.highlightValue)));

        // from filtering, we can compute color
        let baseColor = ${colorize};
        let clr = mix(unis.filteredOutColor, baseColor, filteredIn);

        // point size (todo make this a uniform...)
        // todo: handle offset (slides)
        let R = 0.02;
        let dPos = clip[v.vIndex]*R + p;
        out.color = clr;
        out.position = applyCamera(dPos,unis.view);
        return out;
    }
    @fragment
    fn fmain(v:VsOutput)->@location(0) vec4f {
        return v.color; // todo: round points with discard?
    }
    `;
}
function generateVertexBufferLayout(config: Config) {
    // position at 0
    // then categorical
    // then quant
    // note that colorBy must be in either quantitative or categorical...
    // then highlightBy
    const { categoricalColumns, quantitativeColumns } = config;
    const catStart = 1;
    const quantStart = catStart + categoricalColumns.length;
    const what: GPUVertexBufferLayout[] = [
        {
            arrayStride: 8, // xy floats
            stepMode: 'instance',
            attributes: [
                {
                    shaderLocation: 0,
                    format: 'float32x2',
                    offset: 0,
                },
            ],
        },
        ...map(
            categoricalColumns,
            (cat, i): GPUVertexBufferLayout => ({
                arrayStride: 4,
                attributes: [
                    {
                        format: 'uint32',
                        offset: 0,
                        shaderLocation: catStart + i,
                    },
                ],
                stepMode: 'instance',
            }),
        ),
        ...map(
            quantitativeColumns,
            (q, i): GPUVertexBufferLayout => ({
                arrayStride: 4,
                attributes: [
                    {
                        format: 'float32',
                        offset: 0,
                        shaderLocation: quantStart + i,
                    },
                ],
                stepMode: 'instance',
            }),
        ),
    ];
    return what;
}
export function buildPipeline(device: GPUDevice, config: Config) {
    const shader = generate(config);
    beginValidate(device);
    const module = device.createShaderModule({
        code: shader,
        label: 'scatterbrain shader mod',
    });
    const defs = wgh.makeShaderDataDefinitions(shader);
    const vertexLayout = generateVertexBufferLayout(config);
    const blend: GPUBlendState = {
        alpha: {
            operation: 'add',
            srcFactor: 'one',
            dstFactor: 'one',
        },
        color: {
            operation: 'add',
            srcFactor: 'src-alpha',
            dstFactor: 'one-minus-src-alpha',
        },
    }; //TODO generate blendmode settings from config
    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module,
            buffers: vertexLayout,
            entryPoint: 'vmain',
        },
        fragment: {
            module,
            entryPoint: 'fmain',
            targets: [
                {
                    format: 'bgra8unorm',
                    blend,
                },
            ],
        },
        primitive: {
            topology: 'triangle-strip',
        },
    });
    endValidate(device);

    // make a buffer for the uniforms, and a little utility to update it

    const { size } = defs.uniforms['unis'];
    const uniformView = wgh.makeStructuredView(defs.uniforms.unis);
    const uniBuffer = device.createBuffer({
        size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        label: 'scatterbrin uniform buffer',
    });

    let gradientTexture = device.createTexture({
        format: 'rgba8unorm',
        size: { width: 256, height: 1 },
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    const updateGradient = (data: Uint8Array<ArrayBuffer>) => {
        beginValidate(device);
        if (data.byteLength >= 256 * 4) {
            gradientTexture.destroy();
            gradientTexture = device.createTexture({
                format: 'rgba8unorm',
                size: { width: 256, height: 1 },
                usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
            });
            device.queue.writeTexture(
                { texture: gradientTexture },
                data,
                { bytesPerRow: 4 * 256, rowsPerImage: 1 },
                { width: 256, height: 1 },
            );
        } else {
            // warn - we didnt updat the gradient
            console.warn('warning - not enough data to update gradient texture');
        }

        endValidate(device);
        return { binding: 2, resource: gradientTexture };
    };
    const updateUniforms = (unis: Partial<Uniforms>) => {
        uniformView.set(unis);
        // now we write that to the stashed buffer
        device.queue.writeBuffer(uniBuffer, 0, uniformView.arrayBuffer);
        return { binding: 0, resource: uniBuffer };
    };
    let lastCategories = {};
    let lookupTable = device.createTexture({
        format: 'rgba8unorm',
        size: { width: 1, height: 1 },
        usage: GPUTextureUsage.COPY_DST | GPUTextureUsage.TEXTURE_BINDING,
    });
    const updateCategorical = (
        categories: Readonly<Record<string, Readonly<Record<number, { color: vec4; filteredIn: boolean }>>>>,
    ) => {
        // first - determine the diff what what needs to change
        if (categories === lastCategories || isEqual(categories, lastCategories)) {
            // no change - return early, change nothing
            return { binding: 1, resource: lookupTable };
        }
        if (isEqual(keys(categories).toSorted(), keys(lastCategories).toSorted())) {
            // the set of categories stayed the same - great
            // but something in here changed...
            // TODO: optimize this to detect if we just change one pixel - a common case when filtering via the UI
            // for now, overwrite the whole thing
            lookupTable = setCategoricalLookupTableValues(categories, device, lookupTable);
        } else {
            // otherwise - re-build the whole thing, including the size...
            lookupTable = setCategoricalLookupTableValues(categories, device, lookupTable);
        }
        return { binding: 1, resource: lookupTable };
        // bindGroups dont have a destroy() - so I'm assuming its totally fine to leak them!!
    };
    return { pipeline, updateGradient, updateUniforms, updateCategorical };
}
