import {
    type GpuProps as CachedPixels,
    type DziImage,
    type DziRenderSettings,
    type DziTile,
    buildAsyncDziRenderer,
} from '@alleninstitute/vis-dzi';
import { Vec2, type vec2 } from '@alleninstitute/vis-geometry';
import type { RenderFrameFn, buildAsyncRenderer } from '@alleninstitute/vis-core';
import { useContext, useEffect, useRef } from 'react';
import { renderServerContext } from '../common/react/render-server-provider';

type Props = {
    id: string;
    dzi: DziImage;
    svgOverlay: HTMLImageElement;
    onWheel?: (e: WheelEvent) => void;
    onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
} & DziRenderSettings;

export function DziViewer(props: Props) {
    const { svgOverlay, camera, dzi, onWheel, id, onMouseDown, onMouseUp, onMouseMove, onMouseLeave } = props;
    const server = useContext(renderServerContext);
    const cnvs = useRef<HTMLCanvasElement>(null);

    // the renderer needs WebGL for us to create it, and WebGL needs a canvas to exist, and that canvas needs to be the same canvas forever
    // hence the awkwardness of refs + an effect to initialize the whole hting
    const renderer =
        useRef<
            ReturnType<typeof buildAsyncRenderer<DziImage, DziTile, DziRenderSettings, string, string, CachedPixels>>
        >(undefined);

    useEffect(() => {
        if (server?.regl) {
            renderer.current = buildAsyncDziRenderer(server.regl);
        }
        return () => {
            if (cnvs.current) {
                server?.destroyClient(cnvs.current);
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

        if (server && renderer.current && cnvs.current) {
            const renderMyData: RenderFrameFn<DziImage, DziTile> = (target, cache, callback) => {
                if (renderer.current) {
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
                cnvs.current,
            );
        }
    }, [server, svgOverlay, dzi, camera]);

    // we have to add the listener this way because onWheel is a passive listener by default
    // that means we can't preventDefault to stop scrolling
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => onWheel?.(e);
        const canvas = cnvs;
        if (canvas?.current) {
            canvas.current.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (canvas?.current) {
                canvas.current.removeEventListener('wheel', handleWheel);
            }
        };
    }, [onWheel]);

    return (
        <canvas
            id={id}
            ref={cnvs}
            width={camera.screenSize[0]}
            height={camera.screenSize[1]}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
        />
    );
}
