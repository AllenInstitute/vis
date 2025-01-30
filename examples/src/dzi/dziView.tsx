import { useContext, useEffect, useRef, useState } from 'react';
import {
    buildDziRenderer,
    type DziImage,
    type DziRenderSettings,
    type DziTile,
    type GpuProps as CachedPixels,
    buildAsyncDziRenderer,
} from '@alleninstitute/vis-dzi';
import React from 'react';
import { buildAsyncRenderer, type RenderFrameFn } from '@alleninstitute/vis-scatterbrain';
import { isEqual } from 'lodash';
import { renderServerContext } from '../common/react/render-server-provider';
import { Vec2, type vec2 } from '@alleninstitute/vis-geometry';

type Props = {
    id: string;
    dzi: DziImage;
    svgOverlay?: HTMLImageElement;
    wheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
} & DziRenderSettings;

function buildCompositor(svg: HTMLImageElement, settings: DziRenderSettings) {
    return (ctx: CanvasRenderingContext2D, image: ImageData) => {
        const { width, height } = svg;
        const { camera } = settings;
        const svgSize: vec2 = [width, height];
        const start = Vec2.mul(camera.view.minCorner, svgSize);
        const wh = Vec2.sub(Vec2.mul(camera.view.maxCorner, svgSize), start);
        const [sx, sy] = start;
        const [sw, sh] = wh;
        // first, draw the results from webGL
        ctx.putImageData(image, 0, 0);
        // then add our svg overlay
        ctx.drawImage(svg, sx, sy, sw, sh, 0, 0, ctx.canvas.width, ctx.canvas.height);
    };
}

export function DziView(props: Props) {
    const { svgOverlay, camera, dzi, wheel, id } = props;
    const server = useContext(renderServerContext);
    const cnvs = useRef<HTMLCanvasElement>(null);

    // this is a demo, so rather than work hard to have a referentially stable camera,
    // we just memoize it like so to prevent over-rendering
    const [cam, setCam] = useState(camera);
    useEffect(() => {
        if (!isEqual(cam, camera)) {
            setCam(camera);
        }
    }, [camera]);

    // the renderer needs WebGL for us to create it, and WebGL needs a canvas to exist, and that canvas needs to be the same canvas forever
    // hence the awkwardness of refs + an effect to initialize the whole hting
    const renderer =
        useRef<
            ReturnType<typeof buildAsyncRenderer<DziImage, DziTile, DziRenderSettings, string, string, CachedPixels>>
        >();

    useEffect(() => {
        if (server && server.regl) {
            renderer.current = buildAsyncDziRenderer(server.regl);
        }
        return () => {
            if (cnvs.current) {
                server?.destroyClient(cnvs.current);
            }
        };
    }, [server]);

    useEffect(() => {
        if (server && renderer.current && cnvs.current) {
            const renderMyData: RenderFrameFn<DziImage, DziTile> = (target, cache, callback) => {
                if (renderer.current) {
                    // erase the frame before we start drawing on it
                    return renderer.current(dzi, { camera: cam }, callback, target, cache);
                }
                return null;
            };
            let render = (ctx: CanvasRenderingContext2D, image: ImageData) => ctx.putImageData(image, 0, 0);
            if (svgOverlay) {
                render = buildCompositor(svgOverlay, { camera });
            }
            server.beginRendering(
                renderMyData,
                (e) => {
                    switch (e.status) {
                        case 'begin':
                            server.regl?.clear({ framebuffer: e.target, color: [0, 0, 0, 0], depth: 1 });
                            break;
                        case 'progress':
                            // wanna see the tiles as they arrive?
                            e.server.copyToClient(render);
                            break;
                        case 'finished': {
                            e.server.copyToClient(render);
                        }
                    }
                },
                cnvs.current
            );
        }
    }, [server, renderer.current, cnvs.current, cam]);
    return (
        <canvas
            id={id}
            ref={cnvs}
            onWheel={wheel}
            width={camera.screenSize[0]}
            height={camera.screenSize[1]}
        ></canvas>
    );
}
