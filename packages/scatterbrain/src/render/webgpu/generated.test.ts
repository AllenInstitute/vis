import { describe, expect, test } from 'vitest';

import { generate } from './generated';


describe('this shader is annoying', () => {
    const good = /*wgsl*/`
     // attribs //
    struct Vertex {
        @builtin(vertex_index) vIndex: u32,
        @location(0) umapxy: vec2f,
        @location(1) Class:u32,
@location(2) subClass:u32,
@location(3) cellId:u32,
        @location(4) gaba:f32,
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
        gaba_range:vec2f,
    };

    @group(0) @binding(0)
    var<uniform> unis:Uniforms;
    
    // texture bindings... no longer considered uniform...
    // TIL textureSampler is banned in vertex stage... neat
    @group(0) @binding(1) var lookupTexture: texture_2d<f32>;
    @group(0) @binding(2) var gradientTexture: texture_2d<f32>;
    
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
        let p = v.umapxy;
        let withinFilterBox = within(p.x,unis.spatialFilterBox.xz)*within(p.y,unis.spatialFilterBox.yw);
        let filteredIn: f32 = withinFilterBox *
            step(0.01,textureLoad(lookupTexture, vec2u(0,v.Class),0).a) * step(0.01,textureLoad(lookupTexture, vec2u(1,v.subClass),0).a) * step(0.01,textureLoad(lookupTexture, vec2u(2,v.cellId),0).a)
          * within(v.gaba,unis.gaba_range);

        // highlighting
        let highlighted = 1.0-step(0.1,abs(f32(v.cellId-unis.highlightValue)));

        // from filtering, we can compute color
        let baseColor =
    vec4(textureLoad(lookupTexture,vec2u(0,v.Class),0).rgb,1.0);
        let clr = mix(unis.filteredOutColor, baseColor, filteredIn);

        // point size (todo make this a uniform...)
        // todo: handle offset (slides)
        let R = 2.0;
        let dPos = clip[v.vIndex]*R + p;
        out.color = clr;
        out.position = applyCamera(dPos,unis.view);
        return out;
    }`
    test('it looks good...', () => {
        const shader = generate({ categoricalColumns: ['Class', 'subClass', 'cellId'], categoricalTable: 'lookupTexture', colorByColumn: 'Class', gradientTable: 'gradientTexture', highlightByColumn: 'cellId', mode: 'color', positionColumn: 'umapxy', quantitativeColumns: ['gaba'], samplerName: 'smpl', tableSize: [2, 40] })
        expect(shader).toEqual(good)
    })
})