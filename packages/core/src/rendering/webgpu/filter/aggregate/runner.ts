import type { BufferTables, Tables } from '../types'
import * as wgh from 'webgpu-utils'

const entries = <T extends {}>(r: T): ReadonlyArray<[string, T[keyof T]]> => Object.entries(r);
function mapTablesToBindings<Ts extends Tables>(
    tables: BufferTables<Ts>,
    lookups: Record<string, Record<string, number>>
): { resource: GPUBuffer; binding: number }[] {
    return entries(tables)
        .flatMap(([name, table]) => {
            return entries(table).map(([field, buffer]) => {
                const b = lookups[name]?.[field];
                if (b) {
                    return { resource: buffer as GPUBuffer, binding: b };
                }
                return undefined;
            });
        })
        .filter((x) => x !== undefined);
}

export function buildRunner<Ts extends Tables>(device: GPUDevice, tables: Ts, pipe: { defs: wgh.ShaderDataDefinitions, pipeline: GPURenderPipeline }) {

    let safeLookups: Record<string, Record<string, number>> = {};
    // let outputBindings: Record<string,number> = {};
    // associate a binding with every field of every table
    let binding = 1; // elements (optional) takes up group 1 binding 0
    for (const t of Object.keys(tables)) {
        safeLookups[t] = {};
        for (const col of Object.keys(tables[t]!)) {
            safeLookups[t]![col] = binding;
            binding += 1;
        }
    }

    const runner = (enc: GPUCommandEncoder, inputSets: { tables: BufferTables<Ts>, count: number, elements?: GPUBuffer }[], camera: GPUBuffer, results: GPUTextureView, clearFirst: boolean = false) => {

        const { pipeline } = pipe;
        // create some bind groups...
        const bg0 = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [{ binding: 0, resource: camera }]
        })
        const bg1l = pipeline.getBindGroupLayout(1)
        const bg1s = inputSets.map((s) => {
            return device.createBindGroup({
                layout: bg1l,
                entries: mapTablesToBindings(s.tables, safeLookups)
            });
        })
        const pass = enc.beginRenderPass({ colorAttachments: [{ view: results, loadOp: clearFirst ? 'clear' : 'load', storeOp: 'store' }] })
        pass.setPipeline(pipeline);
        // bind all the stuff...
        pass.setBindGroup(0, bg0);
        for (let i = 0; i < inputSets.length; i++) {
            pass.setBindGroup(1, bg1s[i]);
            const { elements, count } = inputSets[i];
            if (elements) {
                pass.setIndexBuffer(elements, 'uint32')
                pass.drawIndexed(count);
            } else {
                pass.draw(count);
            }
        }
        pass.end();
    }
    return runner;
}