/**
 * Per-device cache of `BuiltPipeline`s keyed by deterministic fingerprint.
 *
 * Layout: `WeakMap<GPUDevice, Map<fingerprint, BuiltPipeline>>`. The outer `WeakMap` lets the
 * cache drop a device's entries automatically when the device itself is garbage-collected; the
 * inner `Map` is a plain LRU-less keyed cache (Phase 8 will add eviction).
 *
 * Module-private. Intentionally NOT exported from the public webgpu barrel — only `build.ts`
 * should manage cache reads/writes; consumer code obtains `BuiltPipeline`s through `pipeline()`.
 */

import type { BuiltPipeline } from './build';

const cache = new WeakMap<GPUDevice, Map<string, BuiltPipeline>>();

/** Look up a previously-built pipeline by fingerprint, or `undefined` on miss. */
export function getCached(device: GPUDevice, fingerprint: string): BuiltPipeline | undefined {
    return cache.get(device)?.get(fingerprint);
}

/** Record a freshly-built pipeline under the supplied fingerprint. */
export function setCached(device: GPUDevice, fingerprint: string, built: BuiltPipeline): void {
    let perDevice = cache.get(device);
    if (perDevice === undefined) {
        perDevice = new Map();
        cache.set(device, perDevice);
    }
    perDevice.set(fingerprint, built);
}

/** Test-only escape hatch: drop a device's entries. Not exported from the public barrel. */
export function clearDeviceCache(device: GPUDevice): void {
    cache.delete(device);
}
