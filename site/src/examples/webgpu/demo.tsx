import { type PropsWithChildren, useEffect, useRef, useState } from 'react';
import { isWebGpuAvailable, startWebGpuDemo } from './renderer';

/**
 * Live demo: three slowly rotating solids (cube, tetrahedron, dodecahedron) sharing one camera
 * uniform, each with its own color, rendered with the `@alleninstitute/vis-core` WebGPU authoring
 * API. Runs client-side only (mount with `client:only="react"`).
 */
export function WebGpuShapesDemo() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [supported] = useState(() => isWebGpuAvailable());
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!supported) return;
        const canvas = canvasRef.current;
        if (canvas === null) return;

        let dispose: (() => void) | undefined;
        let cancelled = false;
        startWebGpuDemo(canvas)
            .then((d) => {
                if (cancelled) d();
                else dispose = d;
            })
            .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));

        return () => {
            cancelled = true;
            dispose?.();
        };
    }, [supported]);

    if (!supported) {
        return (
            <Notice>
                WebGPU isn’t available in this browser. Try a recent Chrome or Edge (or enable the
                WebGPU flag in your browser’s settings).
            </Notice>
        );
    }
    if (error !== null) {
        return <Notice>Couldn’t start the WebGPU demo: {error}</Notice>;
    }

    return (
        <canvas
            ref={canvasRef}
            style={{
                width: '100%',
                maxWidth: 720,
                height: 420,
                display: 'block',
                borderRadius: 8,
                background: '#0f1013',
            }}
        />
    );
}

function Notice({ children }: PropsWithChildren) {
    return (
        <div
            style={{
                maxWidth: 720,
                padding: '1rem 1.25rem',
                borderRadius: 8,
                border: '1px solid var(--sl-color-gray-5, #444)',
                background: 'var(--sl-color-gray-6, #1b1b1f)',
                color: 'var(--sl-color-gray-2, #ddd)',
                fontSize: '0.95rem',
            }}
        >
            {children}
        </div>
    );
}
