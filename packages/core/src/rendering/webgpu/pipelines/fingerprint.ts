/**
 * Deterministic fingerprint for a built pipeline.
 *
 * Two `pipeline(graph, shader, state, device)` calls collide iff:
 *  - they're for the same `WgslShader` (compared by `shader.id`);
 *  - every slot the shader declares resolves to the same `(group, binding)`;
 *  - the supplied `state` normalizes to the same canonical form (see `pipeline-state.ts`).
 *
 * The hash itself is djb2-32 over the canonical-JSON payload. djb2 is sync, fast, and 32-bit —
 * collision risk for the small populations a single `GPUDevice` will ever cache is negligible,
 * and we use it as a cache key (not for cryptographic intent).
 */

import type { BindingMap } from '../resources';
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
