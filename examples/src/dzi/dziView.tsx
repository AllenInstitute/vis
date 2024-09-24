import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { renderServerContext } from './offscreen-renderer';
import {
    buildDziRenderer,
    type DziImage,
    type DziRenderSettings,
    type DziTile,
    type GpuProps as CachedPixels,
} from '@alleninstitute/vis-dzi';
import React from 'react';
import {
    AsyncDataCache,
    buildAsyncRenderer,
    type ReglCacheEntry,
    type RenderCallback,
    type RenderEvent,
    type RFN,
} from '@alleninstitute/vis-scatterbrain';
import REGL from 'regl';
import { isEqual } from 'lodash';

type Props = {
    id: string;
    dzi: DziImage;
    wheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
} & DziRenderSettings;

export function DziView(props: Props) {
    const { camera, dzi, wheel, id } = props;
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
            renderer.current = buildAsyncRenderer(buildDziRenderer(server.regl));
        }
        return () => {
            if (cnvs.current) {
                server?.destroyClient(cnvs.current);
            }
        };
    }, [server]);

    useEffect(() => {
        if (server && renderer.current && cnvs.current) {
            const renderMyData: RFN<DziImage, DziTile> = (
                target: REGL.Framebuffer2D | null,
                cache: AsyncDataCache<string, string, ReglCacheEntry>,
                callback
            ) => {
                if (renderer.current) {
                    // erase the frame before we start drawing on it
                    // server.regl?.clear({ framebuffer: target, color: [0, 0, 0, 0], depth: 1 });
                    return renderer.current(dzi, { camera: cam }, callback, target, cache);
                }
                return null;
            };
            server.beginRendering(
                renderMyData,
                (e) => {
                    console.log(e);
                    switch (e.status) {
                        case 'begin':
                            server.regl?.clear({ framebuffer: e.target, color: [0, 0, 0, 0], depth: 1 });
                            break;
                        case 'progress':
                            e.server.copyToClient();
                            break;
                        case 'finished':
                            e.server.copyToClient();
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
