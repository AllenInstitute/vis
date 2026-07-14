import type { BindingMap } from '../binding';
import type { WgslShader } from '../shaders';
import type { NormalizedPipelineState } from './pipeline-state';

/** Canonical payload that the fingerprint hashes. */
interface FingerprintPayload {
    readonly shaderId: string;
    readonly slots: ReadonlyArray<readonly [string, number, number]>;
    readonly state: NormalizedPipelineState;
}

/**
 * Compute a deterministic fingerprint for a `(shader, slotIndex, normalizedState)` triple.
 * Returns a hex string of the form `'pl_<hex>'` (the prefix makes the value easy to grep).
 *
 * Two calls collide iff the same `WgslShader` (by `shader.id`), the same `(group, binding)` for
 * every declared slot, and a `state` that normalizes to the same canonical form. The hash is
 * djb2-32 over canonical JSON — sync, fast, used purely as a cache key (not cryptographic);
 * collision risk across the small population one `GPUDevice` caches is negligible.
 */
export function pipelineFingerprint(
    shader: WgslShader,
    slotIndex: BindingMap,
    normalizedState: NormalizedPipelineState
): string {
    const slots: Array<readonly [string, number, number]> = [];
    for (const [slot, { group, binding }] of slotIndex) {
        slots.push([slot.name, group, binding] as const);
    }
    slots.sort((a, b) => a[0].localeCompare(b[0]));
    const payload: FingerprintPayload = {
        shaderId: shader.id,
        slots,
        state: normalizedState,
    };
    const ps = JSON.stringify(payload);
    return `pl_${djb2(ps).toString(16)}`;
}

/**
 * djb2 hash (32-bit unsigned). Sync, deterministic, no Web Crypto dependency. Adequate for
 * cache-key use.
 */
function djb2(s: string): number {
    let h = 5381;
    for (let i = 0; i < s.length; i++) {
        // Multiply by 33 (via shift+add) and XOR with the next char code.
        h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
    }
    return h;
}
