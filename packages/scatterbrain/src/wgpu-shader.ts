
// like the webGL version, (shader.ts) but in wgsl (webGPU)
import type { Cacheable } from '@alleninstitute/vis-core';
import type { box2D } from '@alleninstitute/vis-geometry';
import * as wgh from 'webgpu-utils'



export function buildRenderFn(device: GPUDevice) {

    const { binding, size } = defs.uniforms['unis'];
    const uniformView = wgh.makeStructuredView(defs.uniforms.unis);
    const uniBuffer = device.createBuffer({
        size,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM,
        label: 'scatterbrin uniform buffer',
    });
    const bg0 = pipeline.getBindGroupLayout(0);
    const bg = device.createBindGroup({
        layout: bg0,
        label: 'scatterplot bindgroup 0',
        entries: [{ binding, resource: uniBuffer }]
    })
    // can I re-use an encoder? ANSWER: NO! what the hell is the point of all these if you cant keep them?
    return (props: {
        view: box2D, radius: number, highlight: number, ctx: GPUCanvasContext, blocks: ReadonlyArray<{
            columns: Record<string, VBO>,
            count: number,
        }>
    }) => {
        const { view, ctx, highlight, radius, blocks } = props;
        uniformView.set({
            view: { min: view.minCorner, max: view.maxCorner },
            pointSize: [radius / 2, radius * 2],
            highlight
        });
        // now copy the typed array to the actual gpu buffer:
        device.queue.writeBuffer(uniBuffer, 0, uniformView.arrayBuffer)
        const enc = device.createCommandEncoder({ label: 'scatterbrain encoder' })

        const pass = enc.beginRenderPass({
            colorAttachments: [
                {
                    clearValue: [0, 0, 0.5, 1],
                    loadOp: 'clear',
                    storeOp: 'store',
                    view: ctx.getCurrentTexture().createView(),
                }
            ]
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bg);

        for (const block of blocks) {
            const { count, columns } = block
            pass.setVertexBuffer(0, columns.position.buffer)
            pass.setVertexBuffer(1, columns.colorBy.buffer)
            pass.setVertexBuffer(2, columns.highlightBy.buffer)
            pass.draw(4, count);
        }

        pass.end();
        device.queue.submit([enc.finish()]);
    }
}
export class VBO implements Cacheable {
    constructor(readonly buffer: GPUBuffer) {
    }
    destroy() {
        this.buffer.destroy();
    }
    sizeInBytes() {
        return this.buffer.size;
    }
}
