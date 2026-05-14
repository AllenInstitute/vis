// why does my normal import not work???
/// <reference types="@webgpu/types" />
import { decode } from 'tiff';

type DecodedImage = {
    width?: number;
    height?: number;
    shape?: number[];
    size?: { width: number; height: number };
    data?: Uint8Array | Uint8ClampedArray;
    bits?: Uint8Array | Uint8ClampedArray;
    getPixelsArray?: () => Uint8Array;
    components?: number;
    channels?: number;
};

function isDecodedImage(v: unknown): v is DecodedImage {
    if (!v || typeof v !== 'object') return false;
    const obj = v as Record<string, unknown>;
    return (
        typeof obj.width === 'number' ||
        Array.isArray(obj.shape) ||
        (typeof obj.size === 'object' &&
            obj.size !== null &&
            typeof (obj.size as Record<string, unknown>).width === 'number') ||
        obj.data instanceof Uint8Array ||
        typeof obj.getPixelsArray === 'function'
    );
}

export async function createTiffViewer(
    container: HTMLElement,
    url: string,
): Promise<{ canvas: HTMLCanvasElement; destroy: () => void }> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
    const buf = await res.arrayBuffer();

    const { rgba, width, height } = await decodeTiff(buf);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    // fill parent container
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    container.appendChild(canvas);

    if (navigator.gpu) {
        try {
            const destroy = await renderWithWebGPU(canvas, rgba, width, height);
            return { canvas, destroy };
        } catch (err) {
            // biome-ignore lint/suspicious/noConsole: just warning them
            console.warn('WebGPU rendering failed, falling back to 2D canvas', err);
        }
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('2D context not available');
    const packed = rgba.subarray(0, width * height * 4);
    const clamped = new Uint8ClampedArray(packed);
    const imageData = new ImageData(clamped, width, height);
    ctx.putImageData(imageData, 0, 0);
    const destroy = () => {
        try {
            if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
        } catch {}
    };
    return { canvas, destroy };
}

async function decodeTiff(buf: ArrayBuffer): Promise<{ rgba: Uint8Array; width: number; height: number }> {
    const input = new Uint8Array(buf);
    const r = await decode(input);
    const img = (Array.isArray(r) ? r[0] : r) as unknown;
    // dumb typing on the tiff converter
    if (!isDecodedImage(img)) throw new Error('No images decoded from TIFF');

    const width = img.width ?? img.shape?.[0] ?? img.size?.width;
    const height = img.height ?? img.shape?.[1] ?? img.size?.height;
    if (!width || !height) throw new Error('Decoded image missing width/height');

    const data: Uint8Array | Uint8ClampedArray | undefined = img.data ?? img.getPixelsArray?.() ?? img.bits;
    if (!data) throw new Error('Decoded image missing pixel data');

    const components = img.components ?? img.channels ?? 4;

    if (components === 4) {
        return { rgba: new Uint8Array(data.buffer, data.byteOffset, width * height * 4), width, height };
    }

    const out = new Uint8Array(width * height * 4);
    if (components === 3) {
        for (let i = 0, j = 0; i < width * height; i++, j += 3) {
            const o = i * 4;
            out[o] = data[j];
            out[o + 1] = data[j + 1];
            out[o + 2] = data[j + 2];
            out[o + 3] = 255;
        }
        return { rgba: out, width, height };
    }

    if (components === 1) {
        for (let i = 0; i < width * height; i++) {
            const v = data[i];
            const o = i * 4;
            out[o] = v;
            out[o + 1] = v;
            out[o + 2] = v;
            out[o + 3] = 255;
        }
        return { rgba: out, width, height };
    }

    return {
        rgba: new Uint8Array(data.buffer, data.byteOffset, Math.min(data.length, width * height * 4)),
        width,
        height,
    };
}

async function renderWithWebGPU(
    canvas: HTMLCanvasElement,
    rgba: Uint8Array,
    width: number,
    height: number,
): Promise<() => void> {
    const gpu = navigator.gpu as GPU;
    const adapter = await gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter available');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat ? navigator.gpu.getPreferredCanvasFormat() : 'bgra8unorm';

    context.configure({ device, format, alphaMode: 'opaque' });

    const texture = device.createTexture({
        size: { width, height },
        format: 'rgba8unorm',
        usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    // WebGPU requires bytesPerRow to be a multiple of 256
    const bytesPerPixel = 4;
    const unpaddedBytesPerRow = width * bytesPerPixel;
    const alignedBytesPerRow = Math.ceil(unpaddedBytesPerRow / 256) * 256;

    const rgbaData = new Uint8Array(rgba);

    if (alignedBytesPerRow === unpaddedBytesPerRow) {
        device.queue.writeTexture({ texture }, rgbaData, { bytesPerRow: unpaddedBytesPerRow }, { width, height });
    } else {
        const padded = new Uint8Array(alignedBytesPerRow * height);
        for (let row = 0; row < height; row++) {
            const srcStart = row * unpaddedBytesPerRow;
            const dstStart = row * alignedBytesPerRow;
            padded.set(rgbaData.subarray(srcStart, srcStart + unpaddedBytesPerRow), dstStart);
        }
        device.queue.writeTexture(
            { texture },
            padded,
            { bytesPerRow: alignedBytesPerRow, rowsPerImage: height },
            { width, height },
        );
    }

    const shader = `
    @group(0) @binding(0) var samp: sampler;
    @group(0) @binding(1) var tex: texture_2d<f32>;

    struct Uniforms { size: vec2<f32> };
    @group(0) @binding(2) var<uniform> uniforms: Uniforms;

    @vertex
    fn vs(@builtin(vertex_index) vi : u32) -> @builtin(position) vec4<f32> {
        var positions = array<vec2<f32>, 3>(
            vec2<f32>(-1.0, -1.0),
            vec2<f32>(3.0, -1.0),
            vec2<f32>(-1.0, 3.0)
        );
        return vec4<f32>(positions[vi], 0.0, 1.0);
    }

    @fragment
    fn fs(@builtin(position) fragCoord: vec4<f32>) -> @location(0) vec4<f32> {
        let uv = fragCoord.xy / uniforms.size;
        return textureSample(tex, samp, uv);
    }
    `;

    const module = device.createShaderModule({ code: shader });

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format }] },
        primitive: { topology: 'triangle-list' },
    });

    const sampler = device.createSampler({ magFilter: 'linear', minFilter: 'linear' });
    const uniformBuffer = device.createBuffer({
        size: 8,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([width, height]));
    const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
            { binding: 0, resource: sampler },
            { binding: 1, resource: texture.createView() },
            { binding: 2, resource: { buffer: uniformBuffer } },
        ],
    });

    function draw() {
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();
        const pass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: textureView,
                    clearValue: { r: 0, g: 0, b: 0, a: 1 },
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });

        pass.setPipeline(pipeline);
        pass.setBindGroup(0, bindGroup);
        pass.draw(3, 1, 0, 0);
        pass.end();

        device.queue.submit([commandEncoder.finish()]);
    }

    // handle resizes
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1;
    function updateCanvasSize(size?: { width: number; height: number }) {
        const clientW = size?.width ?? canvas.clientWidth ?? width;
        const clientH = size?.height ?? canvas.clientHeight ?? height;
        const w = Math.max(1, Math.floor(clientW * dpr));
        const h = Math.max(1, Math.floor(clientH * dpr));
        if (canvas.width !== w || canvas.height !== h) {
            canvas.width = w;
            canvas.height = h;
            device.queue.writeBuffer(uniformBuffer, 0, new Float32Array([w, h]));
            draw();
        }
    }

    // draw after first frame
    requestAnimationFrame(() => updateCanvasSize());
    const resizeObserver = new ResizeObserver((entries) => {
        const e = entries[0];
        if (e.target !== canvas) return;
        const r = e.contentRect;
        requestAnimationFrame(() => updateCanvasSize({ width: r.width, height: r.height }));
    });
    resizeObserver.observe(canvas);

    // draw in case layout is already complete
    draw();

    const destroy = () => {
        resizeObserver.disconnect();
        texture.destroy();
        uniformBuffer.destroy();
        if (canvas.parentElement) canvas.parentElement.removeChild(canvas);
    };

    return destroy;
}
