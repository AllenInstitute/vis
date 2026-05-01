import { useEffect, useRef, useState } from 'react';
import { createTiffViewer } from '@alleninstitute/vis-tiff';

const DEFAULT_URLS = ['https://upload.wikimedia.org/wikipedia/commons/d/d8/Example.tiff'];

export function TiffDemo() {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [inputUrl, setInputUrl] = useState(DEFAULT_URLS[0]);
    const viewerRef = useRef<{ canvas: HTMLCanvasElement; destroy: () => void } | null>(null);
    const [loading, setLoading] = useState(false);

    async function loadUrl(next: string) {
        const container = containerRef.current;
        if (!container) return;
            viewerRef.current?.destroy();

        setLoading(true);
        try {
            const handle = await createTiffViewer(container, next);
            viewerRef.current = handle;
        } catch (err) {
            // biome-ignore lint/suspicious/noConsole: I'm erroring when I want
            console.error('Failed to create TIFF viewer', err);
        } finally {
            setLoading(false);
        }
    }

    // biome-ignore lint/correctness/useExhaustiveDependencies: just run once
    useEffect(() => {
        loadUrl(DEFAULT_URLS[0]);
        return () => {
            try {
                viewerRef.current?.destroy();
            } catch {}
        };
    }, []);

    return (
        <div>
            <h3>TIFF Demo</h3>
            <div style={{ marginBottom: 8 }}>
                <input value={inputUrl} onChange={(e) => setInputUrl(e.target.value)} style={{ width: '60%' }} />
                <button type='button' onClick={() => loadUrl(inputUrl)} style={{ marginLeft: 8 }} disabled={loading}>
                    Load
                </button>
            </div>
            <div style={{ position: 'relative', display: 'inline-block', width: '50%' }}>
                <div ref={containerRef} />
                {loading && (
                    <div
                        style={{
                            position: 'absolute',
                            left: 0,
                            top: 0,
                            right: 0,
                            bottom: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            pointerEvents: 'none',
                            background: 'transparent',
                        }}
                    >
                        <svg  width="40" height="40" viewBox="0 0 50 50" aria-hidden>
                            <title>Spinner</title>
                            <circle
                                cx="25"
                                cy="25"
                                r="20"
                                stroke="#333"
                                strokeWidth="4"
                                fill="none"
                                strokeLinecap="round"
                                strokeDasharray="31.4 31.4"
                            >
                                <animateTransform
                                    attributeName="transform"
                                    type="rotate"
                                    from="0 25 25"
                                    to="360 25 25"
                                    dur="0.5s"
                                    repeatCount="indefinite"
                                />
                            </circle>
                        </svg>
                    </div>
                )}
            </div>
        </div>
    );
}
