
// like the webGL shader, but in wgsl (webGPU)
import * as wgh from 'webgpu-utils'

type Config = {}
export function buildHighlightShader(config: Config) {
    return /*wgsl*/`

    struct View {
        min: vec2f,
        max: vec2f,
    };
    struct Uniforms {
        view: View,
        highlight: u32,
        pointSize: vec2f, // in data space <regular, highlighted>
    };

    struct Vertex {
        location(0) clip: vec2f, // indexed clip-space vertex, to make points bigger than 1px
        location(1) position: vec2f,
        location(2) colorBy: u32,
        location(3) highlightBy: u32,
    }

    

    fn isHighlighted(v:Vertex,u:Uniforms)->bool{
        return v.highlightBy == u.highlight;
    }
    fn highlightMix(v:Vertex,u:Uniforms)->f32 {
        return step(0.01, abs(v.highlightBy-u.highlight));
    }
    // get the clip-space position of this vertex
    fn applyCamera(v:Vertex, u:Uniforms)->vec2f {
        let view = u.view;
        let pointSize = u.pointSize; 

        let S = view.max-view.min;
        let R = mix(pointSize.x,pointSize.y, highlightMix(v,u));
        let dPos = v.clip*R + v.position;
        let uPos =(dPos-view.min)/S;
        // now clip space
        return (uPos*2.0)-1.0;
    }
    fn getColor(v:Vertex, u:Uniforms)->vec4f {
        return mix(vec4f(0.5,0.5,0.5,1.0),vec4f(1.0,0.,0.,1.0),highlightMix(v,u));
    }

    struct VsOutput {
        @builtin(position) position: vec4f,
        @location(0) color: vec4f,
    };

    @group(0) @binding(0)
    var<uniform> unis: Uniforms;
    // todo: bind a buffer (or texture) for coloring...

    @vertex
    fn vmain(vert: Vertex)->VsOutput{
        var out: VsOutput;
        out.color = getColor(vert,unis);
        out.position = vec4f(applyCamera(vert,unis),0.5,1.0);
    }

    @fragment
    fn fmain(v:VsOutput)->vec4f{
        return v.color;
    }
    `
}

export function buildHighlightPipeline(device: GPUDevice) {
    const prgm = buildHighlightShader({});
    const module = device.createShaderModule({
        code: prgm,
        label: 'simple scatterplot highlighting'
    })
    const defs = wgh.makeShaderDataDefinitions(prgm)


}

