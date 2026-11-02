/**
 * A standalone render-target descriptor. Passed to `ctx.submit(scene, target)` /
 * `encoder.submit(scene, target)` to describe the rendering target of the render pass.
 */
export interface RenderTarget {
    readonly color: readonly GPURenderPassColorAttachment[];
    readonly depthStencil?: GPURenderPassDepthStencilAttachment;
    /** Optional debug label propagated to the begin-pass descriptor. */
    readonly label?: string;
}
