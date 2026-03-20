import { useContext, useEffect, useRef } from 'react';
import {
    type GpuProps as CachedPixels,
    type DziImage,
    type DziRenderSettings,
    type DziTile,
    buildAsyncDziRenderer,
} from '@alleninstitute/vis-dzi';
import { Vec2, type vec2 } from '@alleninstitute/vis-geometry';
import type { RenderFrameFn, buildAsyncRenderer } from '@alleninstitute/vis-core';

import { renderServerContext } from '../common/react/render-server-provider';

type Props = {
    id: string;
    dzi: DziImage;
    svgOverlay: HTMLImageElement | null;
    onWheel?: (e: WheelEvent) => void;
    onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
} & DziRenderSettings;

export function DziViewer({
    svgOverlay,
    camera,
    dzi,
    onWheel,
    id,
    onMouseDown,
    onMouseUp,
    onMouseMove,
    onMouseLeave,
}: Props) {
    const server = useContext(renderServerContext);
    const canvas = useRef<HTMLCanvasElement>(null);

    // the renderer needs WebGL for us to create it, and WebGL needs a canvas to exist, and that canvas needs to be the same canvas forever
    // hence the awkwardness of refs + an effect to initialize the whole hting
    const renderer =
        useRef<
            ReturnType<typeof buildAsyncRenderer<DziImage, DziTile, DziRenderSettings, string, string, CachedPixels>>
        >(undefined);

    useEffect(() => {
        const el = canvas.current;
        if (server?.regl) {
            renderer.current = buildAsyncDziRenderer(server.regl);
        }
        return () => {
            if (el) {
                server?.destroyClient(el);
            }
        };
    }, [server]);

    useEffect(() => {
        const compose = (ctx: CanvasRenderingContext2D, image: ImageData) => {
            // first, draw the results from webGL
            ctx.putImageData(image, 0, 0);

            if (svgOverlay) {
                // then add our svg overlay
                const { width, height } = svgOverlay;
                const svgSize: vec2 = [width, height];
                const start = Vec2.mul(camera.view.minCorner, svgSize);
                const wh = Vec2.sub(Vec2.mul(camera.view.maxCorner, svgSize), start);
                const [sx, sy] = start;
                const [sw, sh] = wh;
                ctx.drawImage(svgOverlay, sx, sy, sw, sh, 0, 0, ctx.canvas.width, ctx.canvas.height);
            }
        };

        if (server && renderer.current && canvas.current) {
            const renderMyData: RenderFrameFn<DziImage, DziTile> = (target, cache, callback) => {
                if (renderer.current) {
                    // erase the frame before we start drawing on it
                    return renderer.current(dzi, { camera }, callback, target, cache);
                }
                return null;
            };
            server.beginRendering(
                renderMyData,
                (e) => {
                    if (e.status === 'begin') {
                        server.regl?.clear({
                            framebuffer: e.target,
                            color: [0, 0, 0, 0],
                            depth: 1,
                        });
                    } else if (e.status === 'progress' || e.status === 'finished') {
                        e.server.copyToClient(compose);
                    }
                },
                canvas.current,
            );
        }
    }, [server, svgOverlay, dzi, camera]);

    // React registers onWheel as a passive listener, so we can't call preventDefault from it.
    // Instead we register our own non-passive listener and forward to the prop.
    useEffect(() => {
        const el = canvas.current;
        if (!el) {
            return;
        }
        const handleWheel = (e: WheelEvent) => {
            e.preventDefault();
            onWheel?.(e);
        };
        el.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            el.removeEventListener('wheel', handleWheel);
        };
    }, [onWheel]);

    return (
        <canvas
            id={id}
            ref={canvas}
            width={camera.screenSize[0]}
            height={camera.screenSize[1]}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
        />
    );
}
