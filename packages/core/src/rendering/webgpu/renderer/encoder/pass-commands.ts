/** Discriminated union of every command the encoder can emit into a render pass. */
export type PassCommand =
    | { readonly kind: 'setPipeline'; readonly pipeline: GPURenderPipeline }
    | {
          readonly kind: 'setBindGroup';
          readonly index: number;
          readonly bindGroup: GPUBindGroup;
      }
    | {
          readonly kind: 'setVertexBuffer';
          readonly slot: number;
          readonly buffer: GPUBuffer;
          readonly offset: number;
          readonly size: number;
      }
    | {
          readonly kind: 'setIndexBuffer';
          readonly buffer: GPUBuffer;
          readonly format: GPUIndexFormat;
          readonly offset: number;
          readonly size: number;
      }
    | {
          readonly kind: 'setViewport';
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly height: number;
          readonly minDepth: number;
          readonly maxDepth: number;
      }
    | {
          readonly kind: 'setScissorRect';
          readonly x: number;
          readonly y: number;
          readonly width: number;
          readonly height: number;
      }
    | { readonly kind: 'setStencilReference'; readonly value: number }
    | { readonly kind: 'setBlendConstant'; readonly color: GPUColor }
    | {
          readonly kind: 'draw';
          readonly vertexCount: number;
          readonly instanceCount: number;
          readonly firstVertex: number;
          readonly firstInstance: number;
      }
    | {
          readonly kind: 'drawIndexed';
          readonly indexCount: number;
          readonly instanceCount: number;
          readonly firstIndex: number;
          readonly baseVertex: number;
          readonly firstInstance: number;
      };

/** Apply a single command to the underlying pass encoder. */
export function applyPassCommand(pass: GPURenderPassEncoder, cmd: PassCommand): void {
    switch (cmd.kind) {
        case 'setPipeline':
            pass.setPipeline(cmd.pipeline);
            return;
        case 'setBindGroup':
            pass.setBindGroup(cmd.index, cmd.bindGroup);
            return;
        case 'setVertexBuffer':
            pass.setVertexBuffer(cmd.slot, cmd.buffer, cmd.offset, cmd.size);
            return;
        case 'setIndexBuffer':
            pass.setIndexBuffer(cmd.buffer, cmd.format, cmd.offset, cmd.size);
            return;
        case 'setViewport':
            pass.setViewport(cmd.x, cmd.y, cmd.width, cmd.height, cmd.minDepth, cmd.maxDepth);
            return;
        case 'setScissorRect':
            pass.setScissorRect(cmd.x, cmd.y, cmd.width, cmd.height);
            return;
        case 'setStencilReference':
            pass.setStencilReference(cmd.value);
            return;
        case 'setBlendConstant':
            pass.setBlendConstant(cmd.color);
            return;
        case 'draw':
            pass.draw(cmd.vertexCount, cmd.instanceCount, cmd.firstVertex, cmd.firstInstance);
            return;
        case 'drawIndexed':
            pass.drawIndexed(
                cmd.indexCount,
                cmd.instanceCount,
                cmd.firstIndex,
                cmd.baseVertex,
                cmd.firstInstance
            );
            return;
    }
}
