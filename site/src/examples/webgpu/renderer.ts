/// <reference types="@webgpu/types" />
/**
 * Framework-agnostic orchestration for the demo: acquire a device, configure the canvas, build the
 * pipeline once, create one shared camera uniform + three per-shape (instance uniform + drawable),
 * build the scene graph once, and run a requestAnimationFrame loop that spins each shape and submits
 * that persistent scene to a fresh per-frame render target.
 *
 * Returns a `dispose()` that stops the loop and releases every GPU resource the demo owns.
 */

import * as webgpu from '@alleninstitute/vis-core/src/rendering/webgpu';
import {
    identity,
    lookAt,
    type Mat4,
    multiplyAll,
    perspective,
    rotationAxis,
    translation,
    type Vec3,
} from './camera';
import { cube, dodecahedron, type Mesh, tetrahedron } from './geometry';
import { buildShaderProgram, type InstanceUniforms } from './shader';

/** Whether the current environment can run this demo. */
export function isWebGpuAvailable(): boolean {
    return typeof navigator !== 'undefined' && navigator.gpu !== undefined;
}

interface ShapeSpec {
    readonly mesh: Mesh;
    readonly color: readonly [number, number, number, number];
    readonly translateX: number;
    readonly axis: Vec3;
    readonly speed: number; // radians / second
}

const SHAPES: readonly ShapeSpec[] = [
    { mesh: cube, color: [0.95, 0.4, 0.35, 1], translateX: -2.6, axis: [0, 1, 0], speed: 0.6 },
    { mesh: tetrahedron, color: [0.45, 0.85, 0.5, 1], translateX: 0, axis: [1, 1, 0], speed: 0.85 },
    { mesh: dodecahedron, color: [0.4, 0.6, 0.95, 1], translateX: 2.6, axis: [0.3, 1, 0.5], speed: 0.5 },
];

const EYE: Vec3 = [0, 1.6, 7];
const CENTER: Vec3 = [0, 0, 0];
const UP: Vec3 = [0, 1, 0];
const CLEAR = { r: 0.06, g: 0.07, b: 0.09, a: 1 } as const;

/** Start the demo on `canvas`. Resolves once the device is ready and the loop is running. */
export async function startWebGpuDemo(canvas: HTMLCanvasElement): Promise<() => void> {
    const adapter = await navigator.gpu.requestAdapter();
    if (adapter === null) throw new Error('No suitable GPUAdapter found.');
    const device = await adapter.requestDevice();

    const context = canvas.getContext('webgpu');
    if (context === null) throw new Error('Failed to acquire a WebGPU canvas context.');
    // `getPreferredCanvasFormat` returns 'bgra8unorm' | 'rgba8unorm' per spec — both valid core
    // `TextureFormat`s; narrow so the value satisfies the pipeline's fragment-target type.
    const format = navigator.gpu.getPreferredCanvasFormat() as 'bgra8unorm' | 'rgba8unorm';
    context.configure({ device, format, alphaMode: 'opaque' });

    // A modest batch-pool buffer manager covers the uniforms + geometry buffers.
    const bufferManager = new webgpu.BatchPoolBufferAdapter({
        device,
        maxBytes: 32 * 1024 * 1024,
        idleFrameLimit: 60,
        sizeBuckets: [256, 1024, 4096, 16384, 65536],
    });
    const ctx = webgpu.renderingContext({ device, bufferManager, label: 'shapes-demo' });

    const { program, graph, cameraSlot, instanceSlot, layout } = buildShaderProgram();
    const pipeline = ctx.pipeline(graph, program, {
        vertex: { layout },
        fragment: { targets: [{ format }] },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
        depthStencil: { format: 'depth24plus', depthWriteEnabled: true, depthCompare: 'less' },
    });

    // Shared camera uniform (updated on resize).
    const cameraRes = ctx.resource(cameraSlot, { viewProj: identity() });

    // One instance uniform + drawable per shape.
    const shapes = SHAPES.map((spec) => {
        const instance = ctx.resource(instanceSlot, {
            model: identity(),
            color: spec.color,
        } satisfies InstanceUniforms);
        const drawable = ctx.drawable({
            pipeline,
            vertex: { kind: 'typed', layout, data: { position: spec.mesh.positions } },
            index: { kind: 'arrays', data: spec.mesh.indices },
            // Bindings keyed by slot name: shared camera + this shape's instance uniform.
            bindings: { camera: cameraRes, instance },
            draw: { kind: 'indexed', indexCount: spec.mesh.indices.length },
            label: `shape[${spec.translateX}]`,
        });
        return { spec, instance, drawable };
    });

    const root = webgpu.container(shapes.map((s) => webgpu.draw(s.drawable)));

    // The scene graph is persistent: built once, reused every frame. The render target (which
    // wraps the per-frame swap-chain view) is supplied separately at submit time.
    const sceneGraph = webgpu.scene({ root });

    // Depth attachment, recreated on resize.
    let depthTexture: GPUTexture | undefined;
    let depthView: GPUTextureView | undefined;
    let sizedW = 0;
    let sizedH = 0;

    const resizeIfNeeded = (): void => {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.floor(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.floor(canvas.clientHeight * dpr));
        if (w === sizedW && h === sizedH) return;
        sizedW = w;
        sizedH = h;
        canvas.width = w;
        canvas.height = h;
        depthTexture?.destroy();
        depthTexture = device.createTexture({
            size: [w, h],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
        depthView = depthTexture.createView();
        // Camera aspect follows the canvas.
        const viewProj = multiplyAll(perspective((50 * Math.PI) / 180, w / h, 0.1, 100), lookAt(EYE, CENTER, UP));
        cameraRes.set({ viewProj });
        cameraRes.commit(device);
    };

    let raf = 0;
    let disposed = false;
    const start = performance.now();

    const frame = (): void => {
        if (disposed) return;
        resizeIfNeeded();

        const t = (performance.now() - start) / 1000;
        for (const { spec, instance } of shapes) {
            const model: Mat4 = multiplyAll(
                translation(spec.translateX, 0, 0),
                rotationAxis(spec.axis, t * spec.speed)
            );
            instance.set({ model });
            instance.commit(device);
        }

        const target: webgpu.RenderTarget = {
            color: [
                {
                    view: context.getCurrentTexture().createView(),
                    loadOp: 'clear',
                    clearValue: CLEAR,
                    storeOp: 'store',
                },
            ],
            depthStencil: {
                view: depthView as GPUTextureView,
                depthClearValue: 1,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        };
        ctx.submit(sceneGraph, target);

        raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);

    return function dispose(): void {
        if (disposed) return;
        disposed = true;
        cancelAnimationFrame(raf);
        depthTexture?.destroy();
        ctx.dispose();
        bufferManager.dispose();
        context.unconfigure();
    };
}
