import { describe, expect, test } from 'vitest';
import { buildShaders, type Config, configureShader } from './shader';
import type { ScatterbrainDataset } from './types';

const tenx: ScatterbrainDataset = {
    type: 'normal',
    metadata: {
        points: 1494801,
        boundingBox: {
            lx: -11.541528999999999,
            ly: -13.448518,
            lz: 0,
            ux: 24.993372,
            uy: 23.086382999999998,
            uz: 36.534901,
        },
        tightBoundingBox: {
            lx: -11.541528999999999,
            ly: -13.448518,
            lz: 0,
            ux: 24.993372,
            uy: 22.9617,
            uz: 0,
        },
        root: {
            file: 'r.bin',
            numSpecimens: 100496,
            children: [
                {
                    file: 'r0.bin',
                    numSpecimens: 33084,
                    children: [
                        {
                            file: 'r00.bin',
                            numSpecimens: 1004,
                            children: [],
                        },
                        {
                            file: 'r02.bin',
                            numSpecimens: 8959,
                            children: [],
                        },
                        {
                            file: 'r04.bin',
                            numSpecimens: 18257,
                            children: [],
                        },
                        {
                            file: 'r06.bin',
                            numSpecimens: 21375,
                            children: [
                                {
                                    file: 'r060.bin',
                                    numSpecimens: 1150,
                                    children: [],
                                },
                                {
                                    file: 'r062.bin',
                                    numSpecimens: 818,
                                    children: [],
                                },
                                {
                                    file: 'r064.bin',
                                    numSpecimens: 65649,
                                    children: [],
                                },
                                {
                                    file: 'r066.bin',
                                    numSpecimens: 5242,
                                    children: [],
                                },
                            ],
                        },
                    ],
                },
                {
                    file: 'r2.bin',
                    numSpecimens: 83987,
                    children: [
                        {
                            file: 'r20.bin',
                            numSpecimens: 41058,
                            children: [
                                {
                                    file: 'r200.bin',
                                    numSpecimens: 10658,
                                    children: [],
                                },
                                {
                                    file: 'r202.bin',
                                    numSpecimens: 37462,
                                    children: [],
                                },
                                {
                                    file: 'r204.bin',
                                    numSpecimens: 4385,
                                    children: [],
                                },
                                {
                                    file: 'r206.bin',
                                    numSpecimens: 23558,
                                    children: [],
                                },
                            ],
                        },
                        {
                            file: 'r22.bin',
                            numSpecimens: 19404,
                            children: [
                                {
                                    file: 'r220.bin',
                                    numSpecimens: 33089,
                                    children: [],
                                },
                                {
                                    file: 'r224.bin',
                                    numSpecimens: 33541,
                                    children: [],
                                },
                                {
                                    file: 'r226.bin',
                                    numSpecimens: 303,
                                    children: [],
                                },
                            ],
                        },
                        {
                            file: 'r24.bin',
                            numSpecimens: 69249,
                            children: [
                                {
                                    file: 'r240.bin',
                                    numSpecimens: 25571,
                                    children: [],
                                },
                                {
                                    file: 'r242.bin',
                                    numSpecimens: 32062,
                                    children: [],
                                },
                                {
                                    file: 'r244.bin',
                                    numSpecimens: 40682,
                                    children: [],
                                },
                                {
                                    file: 'r246.bin',
                                    numSpecimens: 60049,
                                    children: [
                                        {
                                            file: 'r2460.bin',
                                            numSpecimens: 49708,
                                            children: [],
                                        },
                                        {
                                            file: 'r2462.bin',
                                            numSpecimens: 12312,
                                            children: [],
                                        },
                                        {
                                            file: 'r2464.bin',
                                            numSpecimens: 8059,
                                            children: [],
                                        },
                                        {
                                            file: 'r2466.bin',
                                            numSpecimens: 3863,
                                            children: [],
                                        },
                                    ],
                                },
                            ],
                        },
                        {
                            file: 'r26.bin',
                            numSpecimens: 40202,
                            children: [
                                {
                                    file: 'r260.bin',
                                    numSpecimens: 18073,
                                    children: [],
                                },
                                {
                                    file: 'r262.bin',
                                    numSpecimens: 6172,
                                    children: [],
                                },
                                {
                                    file: 'r264.bin',
                                    numSpecimens: 25204,
                                    children: [],
                                },
                                {
                                    file: 'r266.bin',
                                    numSpecimens: 5508,
                                    children: [],
                                },
                            ],
                        },
                    ],
                },
                {
                    file: 'r4.bin',
                    numSpecimens: 41387,
                    children: [
                        {
                            file: 'r40.bin',
                            numSpecimens: 9924,
                            children: [],
                        },
                        {
                            file: 'r42.bin',
                            numSpecimens: 40161,
                            children: [],
                        },
                        {
                            file: 'r44.bin',
                            numSpecimens: 1883,
                            children: [],
                        },
                        {
                            file: 'r46.bin',
                            numSpecimens: 33158,
                            children: [],
                        },
                    ],
                },
                {
                    file: 'r6.bin',
                    numSpecimens: 74145,
                    children: [
                        {
                            file: 'r60.bin',
                            numSpecimens: 53224,
                            children: [
                                {
                                    file: 'r600.bin',
                                    numSpecimens: 41323,
                                    children: [
                                        {
                                            file: 'r6000.bin',
                                            numSpecimens: 1895,
                                            children: [],
                                        },
                                        {
                                            file: 'r6002.bin',
                                            numSpecimens: 24075,
                                            children: [],
                                        },
                                        {
                                            file: 'r6004.bin',
                                            numSpecimens: 1609,
                                            children: [],
                                        },
                                        {
                                            file: 'r6006.bin',
                                            numSpecimens: 18091,
                                            children: [],
                                        },
                                    ],
                                },
                                {
                                    file: 'r602.bin',
                                    numSpecimens: 30526,
                                    children: [],
                                },
                                {
                                    file: 'r604.bin',
                                    numSpecimens: 4394,
                                    children: [],
                                },
                                {
                                    file: 'r606.bin',
                                    numSpecimens: 21398,
                                    children: [],
                                },
                            ],
                        },
                        {
                            file: 'r62.bin',
                            numSpecimens: 46391,
                            children: [
                                {
                                    file: 'r620.bin',
                                    numSpecimens: 9355,
                                    children: [],
                                },
                                {
                                    file: 'r622.bin',
                                    numSpecimens: 20763,
                                    children: [],
                                },
                                {
                                    file: 'r624.bin',
                                    numSpecimens: 7436,
                                    children: [],
                                },
                                {
                                    file: 'r626.bin',
                                    numSpecimens: 11283,
                                    children: [],
                                },
                            ],
                        },
                        {
                            file: 'r64.bin',
                            numSpecimens: 42149,
                            children: [],
                        },
                        {
                            file: 'r66.bin',
                            numSpecimens: 20038,
                            children: [],
                        },
                    ],
                },
            ],
        },
        spatialColumn: '488I12FURRB8ZY5KJ8TCoordinates',
        visualizationReferenceId: '488I12FURRB8ZY5KJ8T',
        geneFileEndpoint:
            'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/data/',
        metadataFileEndpoint:
            'https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/metadata/',
        pointAttributes: {
            FS00DXV0T9R1X9FJ4QE: {
                name: 'FS00DXV0T9R1X9FJ4QE',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Class',
            },
            QY5S8KMO5HLJUF0P00K: {
                name: 'QY5S8KMO5HLJUF0P00K',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Subclass',
            },
            '15BK47DCIOF1SLLUW9P': {
                name: '15BK47DCIOF1SLLUW9P',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Supertype',
            },
            CBGC0U30VV9JPR60TJU: {
                name: 'CBGC0U30VV9JPR60TJU',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Cluster',
            },
            '4MV7HA5DG2XJZ3UD8G9': {
                name: '4MV7HA5DG2XJZ3UD8G9',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Neurotransmitter Type',
            },
            Y937CVUSVZC7KYOHWVO: {
                name: 'Y937CVUSVZC7KYOHWVO',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Dissection Region',
            },
            KRP9GYF002I5OPM7JSR: {
                name: 'KRP9GYF002I5OPM7JSR',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Donor ID',
            },
            N3YEG845JSIPMS3C0MJ: {
                name: 'N3YEG845JSIPMS3C0MJ',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Platform',
            },
            O95N6FNAK13WZWEIU5N: {
                name: 'O95N6FNAK13WZWEIU5N',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Sex',
            },
            Q0LG0S1W23HUAKA2SW3: {
                name: 'Q0LG0S1W23HUAKA2SW3',
                size: 2,
                elements: 1,
                elementSize: 2,
                type: 'uint16',
                description: 'Genotype',
            },
            '488I12FURRB8ZY5KJ8TCoordinates': {
                name: '488I12FURRB8ZY5KJ8TCoordinates',
                size: 8,
                elements: 2,
                elementSize: 4,
                type: 'float',
                description: 'Pallium-Glut',
            },
        },
    },
};
describe('configure', () => {
    test('can we generate a sensible shader from settings', () => {
        const { config, columnNameToShaderName } = configureShader({
            dataset: tenx,
            categoricalFilters: {},
            mode: 'color',
            colorBy: { kind: 'quantitative', column: '123', gradient: 'viridis', range: { min: 0, max: 10 } },
            quantitativeFilters: [],
        });
        const shaders = buildShaders(config);

        const expectedConfig: Config = {
            categoricalColumns: [],
            categoricalTable: 'lookup',
            colorByColumn: 'COLOR_BY_MEASURE',
            gradientTable: 'gradient',
            mode: 'color',
            tableSize: [1, 1],
            quantitativeColumns: ['COLOR_BY_MEASURE'],
            positionColumn: 'position',
        };
        const expectedShader = /*glsl*/ `
        precision highp float;
    // attribs //

    attribute vec2 position;

    attribute float COLOR_BY_MEASURE;

    // uniforms //

    uniform vec4 view;
    uniform vec2 screenSize;
    uniform vec2 offset;
    uniform vec4 spatialFilterBox;
    uniform vec4 filteredOutColor;
    uniform float hoveredValue;

    uniform sampler2D gradient;
    uniform sampler2D lookup;
    // quantitative columns each need a range value - its the min,max in a vec2
    uniform vec2 COLOR_BY_MEASURE_range;


    // utility functions //

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


    // per-point interface functions //

    float isHovered(){

        return 0.0;
    }
    vec3 getDataPosition(){
        return vec3(position+offset,0.0);
    }
    float isFilteredIn(){

    vec3 p = getDataPosition();
    return within(p.x,spatialFilterBox.xz)*within(p.y,spatialFilterBox.yw)
    * 1.0
    * within(COLOR_BY_MEASURE,COLOR_BY_MEASURE_range);

    }
    // the primary per-point functions, called directly //
    vec4 getClipPosition(){
        return applyCamera(getDataPosition());
    }
    float getPointSize(){
        return mix(2.0,6.0,isHovered());
    }
    vec4 getColor(){

        return mix(filteredOutColor,
    texture2D(gradient,vec2(rangeParameter(COLOR_BY_MEASURE,COLOR_BY_MEASURE_range),0.5))
    ,isFilteredIn());

    }
    varying vec4 color;
    void main(){
        color = getColor();
        gl_PointSize = getPointSize();
        gl_Position = getClipPosition();
    }`;
        expect(config).toEqual(expectedConfig);
        expect(shaders.vs.replace(/\s/g, '')).toEqual(expectedShader.replace(/\s/g, ''));
        expect(columnNameToShaderName).toEqual({
            '123': 'COLOR_BY_MEASURE',
            '488I12FURRB8ZY5KJ8TCoordinates': 'position',
        });
    });
});
