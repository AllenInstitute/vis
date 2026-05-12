import { beginValidate, endValidate } from './validate';
import * as wgh from 'webgpu-utils';
import type { vec2, vec4 } from '@alleninstitute/vis-geometry';
import {
    $a,
    constant,
    fragmentEntry,
    func,
    location,
    member,
    param,
    returns,
    shader,
    struct,
    texture,
    uniform,
    vertexEntry,
} from './shaders';

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

export const applyCamera = func(
    'applyCamera',
    [param('dataPos', 'vec2f'), param('view', 'vec4f')],
    /*wgsl*/ `
    let size = view.zw-view.xy;
    let unit = (dataPos.xy-view.xy)/size;
    return vec4f((unit*2.0)-1.0,0.0,1.0);
    `,
    returns('vec4f')
);

export const rangeParameter = func(
    'rangeParameter',
    [param('v', 'f32'), param('range', 'vec2f')],
    /*wgsl*/ `
    return (v-range.x)/(range.y-range.x);
    `,
    returns('f32')
);

export const within = func(
    'within',
    [param('v', 'f32'), param('range', 'vec2f')],
    /*wgsl*/ `
    return step(range.x,v)*step(v,range.y);
    `,
    returns('f32')
);

const makeVertexStruct = (config: Config) => {
    const { positionColumn, categoricalColumns, quantitativeColumns } = config;
    const catStart = 1;
    const quantStart = catStart + categoricalColumns.length;
    return struct('Vertex', [
        member('vIndex', 'u32', [$a.builtin('vertex_index')]),
        member(positionColumn, 'vec2f', [$a.location(0)]),
        ...categoricalColumns.map((col, i) => member(col, 'u32', [$a.location(i + catStart)])),
        ...quantitativeColumns.map((col, i) => member(col, 'f32', [$a.location(i + quantStart)])),
    ]);
};

const vsOutputStruct = struct('VsOutput', [
    member('position', 'vec4f', [$a.builtin('position')]),
    member('color', 'vec4f', [$a.location(0)]),
]);

const makeUniformStruct = (config: Config) => {
    const { quantitativeColumns } = config;
    return struct('Uniforms', [
        member('view', 'vec4f'),
        member('spatialFilterBox', 'vec4f'),
        member('filteredOutColor', 'vec4f'),
        member('highlightColor', 'vec4f'),
        member('screenSize', 'vec2f'),
        member('offset', 'vec2f'),
        member('highlightValue', 'u32'),
        ...quantitativeColumns.map((col) => member(rangeFor(col), 'vec2f')),
    ]);
};

export function generate(config: Config): string {
    const {
        mode: _mode,
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

    const vertexStruct = makeVertexStruct(config);
    const uniformStruct = makeUniformStruct(config);

    return shader([
        vertexStruct,
        uniformStruct,
        vsOutputStruct,
        uniform('unis', uniformStruct.name, 0, 0),
        texture(categoricalTable, 'texture_2d<f32>', 0, 1),
        texture(gradientTable, 'texture_2d<f32>', 0, 2),
        applyCamera,
        rangeParameter,
        within,
        constant('clip', /*wgsl*/ `array<vec2f,4>(vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(-1, 1))`),
        vertexEntry(
            'vmain',
            [param('v', vertexStruct.name)],
            /*wgsl*/ `
        var out: ${vsOutputStruct.name};

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
        `,
            returns(vsOutputStruct.name)
        ),
        fragmentEntry(
            'fmain',
            [param('v', vsOutputStruct.name)],
            /*wgsl*/ `return v.color;`,
            returns('vec4f', [location(0)])
        ),
    ]).asSource();
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
        ...categoricalColumns.map(
            (_cat, i): GPUVertexBufferLayout => ({
                arrayStride: 4,
                attributes: [
                    {
                        format: 'uint32',
                        offset: 0,
                        shaderLocation: catStart + i,
                    },
                ],
                stepMode: 'instance',
            })
        ),
        ...quantitativeColumns.map(
            (_q, i): GPUVertexBufferLayout => ({
                arrayStride: 4,
                attributes: [
                    {
                        format: 'float32',
                        offset: 0,
                        shaderLocation: quantStart + i,
                    },
                ],
                stepMode: 'instance',
            })
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
    const makeUniformBuffer = () => wgh.makeStructuredView(defs.uniforms.unis);
    const updateUniforms = (updates: Partial<Uniforms>, view: ReturnType<typeof makeUniformBuffer>) => {
        view.set(updates);
    };
    return { pipeline, makeUniformBuffer, updateUniforms, uniformSize: size };
}
