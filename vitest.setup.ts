/**
 * Vitest global setup. Polyfills typed-array constructors and WebGPU globals that webgpu-utils
 * references at module-init time but Node hasn't exposed by default yet.
 *
 * `Float16Array` is stage-4 ES but in Node 22.x requires the `--js-float16array` flag. We map it
 * to `Uint16Array` for type-table population purposes — none of our tests exercise actual fp16
 * buffer reads/writes, so the substitution is benign.
 *
 * `GPUShaderStage` is a WebGPU runtime global (`{VERTEX:1, FRAGMENT:2, COMPUTE:4}`). Node
 * doesn't ship a WebGPU implementation, so we stub it with the canonical bitflags.
 */

declare global {
    // eslint-disable-next-line no-var
    var Float16Array: Uint16ArrayConstructor;
}

if (typeof globalThis.Float16Array === 'undefined') {
    (globalThis as unknown as { Float16Array: Uint16ArrayConstructor }).Float16Array =
        Uint16Array as unknown as Uint16ArrayConstructor;
}

if (typeof (globalThis as { GPUShaderStage?: unknown }).GPUShaderStage === 'undefined') {
    (globalThis as unknown as { GPUShaderStage: Record<string, number> }).GPUShaderStage = {
        VERTEX: 0x1,
        FRAGMENT: 0x2,
        COMPUTE: 0x4,
    };
}

if (typeof (globalThis as { GPUBufferUsage?: unknown }).GPUBufferUsage === 'undefined') {
    (globalThis as unknown as { GPUBufferUsage: Record<string, number> }).GPUBufferUsage = {
        MAP_READ: 0x0001,
        MAP_WRITE: 0x0002,
        COPY_SRC: 0x0004,
        COPY_DST: 0x0008,
        INDEX: 0x0010,
        VERTEX: 0x0020,
        UNIFORM: 0x0040,
        STORAGE: 0x0080,
        INDIRECT: 0x0100,
        QUERY_RESOLVE: 0x0200,
    };
}

if (typeof (globalThis as { GPUTextureUsage?: unknown }).GPUTextureUsage === 'undefined') {
    (globalThis as unknown as { GPUTextureUsage: Record<string, number> }).GPUTextureUsage = {
        COPY_SRC: 0x01,
        COPY_DST: 0x02,
        TEXTURE_BINDING: 0x04,
        STORAGE_BINDING: 0x08,
        RENDER_ATTACHMENT: 0x10,
    };
}

if (typeof (globalThis as { GPUColorWrite?: unknown }).GPUColorWrite === 'undefined') {
    (globalThis as unknown as { GPUColorWrite: Record<string, number> }).GPUColorWrite = {
        RED: 0x1,
        GREEN: 0x2,
        BLUE: 0x4,
        ALPHA: 0x8,
        ALL: 0xf,
    };
}

export {};
