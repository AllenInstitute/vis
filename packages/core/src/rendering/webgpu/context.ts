/**
 * `RenderingContext` — device-scoped owner of pipeline build state.
 *
 * Replaces the previous module-level `WeakMap<GPUDevice, Map<fingerprint, BuiltPipeline>>` cache
 * with a per-instance cache so applications and tests can hold isolated caches against the same
 * `GPUDevice`, dispose them deterministically, and instrument them via `stats()`.
 *
 * Future phases extend this class — Phase 4 adds `ctx.resource(slot, init?)` over the
 * externally-supplied `bufferManager`; Phase 5 adds `ctx.drawable({...})`; Phase 7 adds
 * `ctx.encoder()` + `ctx.submit(scene)` and the bind-group cache.
 *
 * **Ownership contract**: a `BufferManager` is **always externally constructed**. The context
 * holds a reference but never creates, manages, or disposes it. `ctx.dispose()` clears the
 * pipeline cache only — the caller's `BufferManager` lifetime is untouched.
 */

import type { BufferManager } from './memory/types';
import { type BuiltPipeline, buildPipeline } from './pipelines/build';
import type { BindingGraph } from './pipelines/binding-graph';
import { pipelineFingerprint } from './pipelines/fingerprint';
import {
    normalizePipelineState,
    type PipelineStateDescriptor,
} from './pipelines/pipeline-state';
import { resolveShaderBindings } from './pipelines/traverse';
import type { WgslShader } from './shaders';

/**
 * Spec passed to `renderingContext()` / `new RenderingContext()`.
 *
 * - `device`: the `GPUDevice` every built pipeline targets.
 * - `label`: optional debug label; surfaces in error messages (e.g. use-after-dispose).
 * - `bufferManager`: optional, user-constructed `BufferManager`. Phase 3 accepts but does not
 *   consume it. Phase 4 wires `ctx.resource(slot, init?)` over this reference.
 */
export interface RenderingContextSpec {
    readonly device: GPUDevice;
    readonly label?: string;
    readonly bufferManager?: BufferManager;
}

/**
 * Telemetry snapshot returned by `ctx.stats()`. Extended per phase: Phase 4 adds
 * `{bytes, leasedBytes}`; Phase 7 adds `{bindGroups, ...}`. Shape is intentionally a single
 * object so callers can spread or destructure without churn.
 */
export interface RenderingContextStats {
    readonly pipelines: number;
}

/**
 * Device-scoped facade for pipeline build + (future) resource/drawable/encoder construction.
 *
 * Construct via the lowercase factory `renderingContext(spec)` to match the surrounding
 * authoring style; the class export exists for type annotations and `instanceof` checks.
 */
export class RenderingContext {
    readonly device: GPUDevice;
    readonly label?: string;
    readonly bufferManager?: BufferManager;

    private readonly _pipelineCache: Map<string, BuiltPipeline> = new Map();
    private _disposed = false;

    constructor(spec: RenderingContextSpec) {
        this.device = spec.device;
        if (spec.label !== undefined) this.label = spec.label;
        if (spec.bufferManager !== undefined) this.bufferManager = spec.bufferManager;
    }

    /** Number of `BuiltPipeline`s currently cached on this instance. */
    get pipelineCount(): number {
        return this._pipelineCache.size;
    }

    /** `true` once `dispose()` has been called. Further `pipeline()` calls will throw. */
    get disposed(): boolean {
        return this._disposed;
    }

    /**
     * Build (or return a cached) `BuiltPipeline` for `(graph, shader, state)` against this
     * context's device. Identical inputs return the same instance; differing state (after
     * canonical normalization) produces a distinct entry.
     */
    pipeline(
        graph: BindingGraph,
        shader: WgslShader,
        state: PipelineStateDescriptor
    ): BuiltPipeline {
        this.assertNotDisposed();
        const normalizedState = normalizePipelineState(state);
        const slotIndex = resolveShaderBindings(graph, shader);
        const fingerprint = pipelineFingerprint(shader, slotIndex, normalizedState);
        const cached = this._pipelineCache.get(fingerprint);
        if (cached !== undefined) return cached;
        const built = buildPipeline(
            this.device,
            graph,
            shader,
            normalizedState,
            slotIndex,
            fingerprint
        );
        this._pipelineCache.set(fingerprint, built);
        return built;
    }

    /**
     * Drop every cached `BuiltPipeline` without disposing the context. Safe to call repeatedly;
     * subsequent `pipeline()` calls rebuild on demand.
     */
    disposePipelineCache(): void {
        this._pipelineCache.clear();
    }

    /**
     * Tear down everything this context owns. Idempotent. After `dispose()` further
     * `pipeline()` calls throw. **Does not** dispose the externally-supplied `bufferManager` —
     * that lifetime belongs to the caller.
     */
    dispose(): void {
        if (this._disposed) return;
        this.disposePipelineCache();
        this._disposed = true;
    }

    /** Snapshot of current cache occupancy. Cheap; suitable for HUDs / instrumentation. */
    stats(): RenderingContextStats {
        return { pipelines: this._pipelineCache.size };
    }

    private assertNotDisposed(): void {
        if (!this._disposed) return;
        const tag = this.label !== undefined ? ` '${this.label}'` : '';
        throw new Error(`RenderingContext${tag}: use-after-dispose.`);
    }
}

/**
 * Lowercase factory for `RenderingContext`. Matches the convention used by `group`, `bindings`,
 * `shader`, `struct`, etc.
 */
export function renderingContext(spec: RenderingContextSpec): RenderingContext {
    return new RenderingContext(spec);
}
