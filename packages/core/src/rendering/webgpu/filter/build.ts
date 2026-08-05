import { map } from 'lodash';
import * as wgh from 'webgpu-utils';
// assuming we generated a shader, can we build a pipeline?
export function buildPipeline(dev: GPUDevice, code: string, entryPoint: string, label: string) {
    const module = dev.createShaderModule({
        code,
        label,
    });

    const defs = wgh.makeShaderDataDefinitions(code);
    const desc: wgh.PipelineDescriptor = {
        compute: {
            entryPoint,
        },
    };
    const layouts = wgh.makeBindGroupLayoutDescriptors(defs, desc);
    const pipeLayout: GPUPipelineLayout = dev.createPipelineLayout({
        bindGroupLayouts: map(layouts, (d) => dev.createBindGroupLayout(d)),
    });
    const pipeline = dev.createComputePipeline({
        label,
        compute: {
            module,
            entryPoint,
        },
        layout: pipeLayout,
    });
    return { defs, pipeline };
}
