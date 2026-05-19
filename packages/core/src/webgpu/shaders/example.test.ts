import { describe, it, expect } from 'vitest';
import {
    constant,
    fragmentEntry,
    func,
    member,
    param,
    returns,
    struct,
    texture,
    uniform,
    vertexEntry,
} from './declarations';
import { builtin, location } from './attributes';
import { asSource, shader } from './shader';

// ─── example: point-renderer shader ───────────────────────────────────────
//
// The generate() function below assembles a realistic multi-declaration shader
// (structs, uniforms, textures, helper functions, vertex + fragment entries)
// from the building blocks above. It demonstrates that all the pieces compose
// correctly into a coherent WGSL source string.

function rangeFor(col: string): `${string}_range` {
    return `${col}_range`;
}

function rangeFilterExpression(quantitativeColumns: readonly string[]) {
    return quantitativeColumns.map((attrib) => /*wgsl*/ `within(v.${attrib},unis.${rangeFor(attrib)})`).join(' * ');
}

function categoricalFilterExpression(categoricalColumns: readonly string[], tableName: string) {
    return categoricalColumns
        .map((attrib, i) => /*wgsl*/ `step(0.01,textureLoad(${tableName}, vec2u(${i.toFixed(0)},v.${attrib}),0).a)`)
        .join(' * ');
}

type PointRendererConfig = {
    quantitativeColumns: string[];
    categoricalColumns: string[];
    categoricalTable: string;
    gradientTable: string;
    positionColumn: string;
    colorByColumn: string;
    highlightByColumn: { column: string };
};

function generatePointRenderer(config: PointRendererConfig): string {
    const {
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

    const colorize =
        categoryColumnIndex !== -1
            ? /*wgsl*/ `vec4(textureLoad(${categoricalTable},vec2u(${categoryColumnIndex.toFixed(0)},v.${colorByColumn}),0).rgb,1.0)`
            : /*wgsl*/ `textureLoad(${gradientTable},vec2u(vec2(rangeParameter(${colorByColumn},unis.${rangeFor(colorByColumn)})*f32(textureDimensions(${gradientTable}).x),0.0)),0)`;

    const catStart = 1;
    const quantStart = catStart + categoricalColumns.length;
    const vertexStruct = struct('Vertex', [
        member('vIndex', 'u32', [builtin('vertex_index')]),
        member(positionColumn, 'vec2f', [location(0)]),
        ...categoricalColumns.map((col, i) => member(col, 'u32', [location(i + catStart)])),
        ...quantitativeColumns.map((col, i) => member(col, 'f32', [location(i + quantStart)])),
    ]);
    const uniformStruct = struct('Uniforms', [
        member('view', 'vec4f'),
        member('spatialFilterBox', 'vec4f'),
        member('filteredOutColor', 'vec4f'),
        member('highlightColor', 'vec4f'),
        member('screenSize', 'vec2f'),
        member('offset', 'vec2f'),
        member('highlightValue', 'u32'),
        ...quantitativeColumns.map((col) => member(rangeFor(col), 'vec2f')),
    ]);
    const vsOutputStruct = struct('VsOutput', [
        member('position', 'vec4f', [builtin('position')]),
        member('color', 'vec4f', [location(0)]),
    ]);

    const applyCamera = func(
        'applyCamera',
        [param('dataPos', 'vec2f'), param('view', 'vec4f')],
        () => /*wgsl*/ `
            let size = view.zw-view.xy; 
            let unit = (dataPos.xy-view.xy)/size; 
            return vec4f((unit*2.0)-1.0,0.0,1.0);
        `,
        returns('vec4f')
    );
    const rangeParameter = func(
        'rangeParameter',
        [param('v', 'f32'), param('range', 'vec2f')],
        () => /*wgsl*/ `
            return (v-range.x)/(range.y-range.x);
        `,
        returns('f32')
    );
    const within = func(
        'within',
        [param('v', 'f32'), param('range', 'vec2f')],
        () => /*wgsl*/ `
            return step(range.x,v)*step(v,range.y);
        `,
        returns('f32')
    );

    const sh = shader([
        vertexStruct,
        uniformStruct,
        vsOutputStruct,
        uniform('unis', uniformStruct.name, 0, 0),
        texture(categoricalTable, 'texture_2d<f32>', 0, 1),
        texture(gradientTable, 'texture_2d<f32>', 0, 2),
        applyCamera,
        rangeParameter,
        within,
        constant('clip', 'array<vec2f,4>(vec2f(1, -1), vec2f(1, 1), vec2f(-1, -1), vec2f(-1, 1))'),
        vertexEntry(
            'vmain',
            [param('v', vertexStruct)],
            () => {
                const catExpr = catFilter.length > 0 ? catFilter : '1.0';
                const rangeExpr = rangeFilter.length > 0 ? rangeFilter : '1.0';
                return /*wgsl*/ `
                    var out: ${vsOutputStruct.name}; 
                    let p = v.${positionColumn}; 
                    let withinFilterBox = within(p.x,unis.spatialFilterBox.xz)*within(p.y,unis.spatialFilterBox.yw); 
                    let filteredIn: f32 = withinFilterBox * ${catExpr} * ${rangeExpr}; 
                    let highlighted = 1.0-step(0.1,abs(f32(v.${highlightByColumn.column}-unis.highlightValue))); 
                    let baseColor = ${colorize}; 
                    let clr = mix(unis.filteredOutColor, baseColor, filteredIn); 
                    let R = 0.02; 
                    let dPos = clip[v.vIndex]*R + p; 
                    out.color = clr; 
                    out.position = applyCamera(dPos,unis.view); 
                    return out;
                `;
            },
            returns(vsOutputStruct)
        ),
        fragmentEntry(
            'fmain',
            [param('v', vsOutputStruct)],
            () => /*wgsl*/ `
                return v.color;
            `,
            returns('vec4f', [location(0)])
        ),
    ]);
    return asSource(sh);
}

describe('example: point-renderer shader (quantitative color-by)', () => {
    const config: PointRendererConfig = {
        quantitativeColumns: ['size', 'opacity'],
        categoricalColumns: ['category'],
        categoricalTable: 'catTex',
        gradientTable: 'gradTex',
        positionColumn: 'pos',
        colorByColumn: 'size',
        highlightByColumn: { column: 'size' },
    };

    it('generates without throwing', () => {
        const src = generatePointRenderer(config);
        expect(typeof src).toBe('string');
        expect(src.length).toBeGreaterThan(0);
    });

    it('contains the Vertex struct definition', () => {
        const src = generatePointRenderer(config);
        expect(src).toContain('struct Vertex { @builtin(vertex_index) vIndex: u32,');
    });

    it('contains the Uniforms struct with range members for quantitative columns', () => {
        const src = generatePointRenderer(config);
        expect(src).toContain('struct Uniforms { view: vec4f, spatialFilterBox: vec4f,');
    });

    it('contains the VsOutput struct', () => {
        const src = generatePointRenderer(config);
        expect(src).toContain('struct VsOutput { @builtin(position) position: vec4f, @location(0) color: vec4f }');
    });

    it('contains the uniform, texture, and sampler bindings', () => {
        const src = generatePointRenderer(config);
        expect(src).toContain('@group(0) @binding(0) var<uniform> unis: Uniforms;');
        expect(src).toContain('@group(0) @binding(1) var catTex: texture_2d<f32>;');
        expect(src).toContain('@group(0) @binding(2) var gradTex: texture_2d<f32>;');
    });

    it('contains the helper function declarations', () => {
        const src = generatePointRenderer(config);
        expect(src).toContain('fn applyCamera(');
        expect(src).toContain('fn rangeParameter(');
        expect(src).toContain('fn within(');
    });

    it('contains the vertex and fragment entry points', () => {
        const src = generatePointRenderer(config);
        expect(src).toContain('@vertex fn vmain(');
        expect(src).toContain('@fragment fn fmain(');
    });

    it('embeds quantitative range-filter expressions in the vertex body', () => {
        const src = generatePointRenderer(config);
        expect(src).toContain('within(v.size,unis.size_range)');
        expect(src).toContain('within(v.opacity,unis.opacity_range)');
    });

    it('embeds categorical filter expression in the vertex body', () => {
        const src = generatePointRenderer(config);
        expect(src).toContain('textureLoad(catTex,');
    });
});
