import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { renderServerContext } from './offscreen-renderer';
import { buildDziRenderer, type DziImage, type DziRenderSettings, type DziTile } from '@alleninstitute/vis-dzi';
import React from 'react';
import {
    AsyncDataCache,
    buildAsyncRenderer,
    type ReglCacheEntry,
    type RenderCallback,
} from '@alleninstitute/vis-scatterbrain';
import REGL from 'regl';
import { isEqual } from 'lodash';

type Props = {
    dzi: DziImage;
    wheel: (e: React.WheelEvent<HTMLCanvasElement>) => void;
} & DziRenderSettings;

export function DziView(props: Props) {
    const { camera, dzi, wheel } = props;
    const server = useContext(renderServerContext);

    // memoize our camera because this is still a tacky demo - there are many different ways to approach this!
    const [cam, setCam] = useState(camera);
    useEffect(() => {
        if (!isEqual(cam, camera)) {
            setCam(camera);
        }
    }, [camera]);

    const renderer =
        useRef<ReturnType<typeof buildAsyncRenderer<DziImage, DziTile, DziRenderSettings, string, string, any>>>();
    const cnvs = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (server && server.regl) {
            buildDziRenderer(server.regl);
            const what = buildDziRenderer(server.regl);
            renderer.current = buildAsyncRenderer(what);
        }
    }, [server]);
    useEffect(() => {
        if (server && renderer.current && cnvs.current) {
            const renderMyData = (
                target: REGL.Framebuffer2D | null,
                cache: AsyncDataCache<string, string, ReglCacheEntry>,
                callback: RenderCallback
            ) => {
                if (renderer.current) {
                    // erase the frame
                    server.regl?.clear({ framebuffer: target, color: [0, 0, 0, 0], depth: 1 });
                    return renderer.current(dzi, { camera: cam }, callback, target, cache);
                }
                return null;
            };
            server.beginRendering(renderMyData, (e) => console.log(e), cnvs.current);
        }
    }, [server, renderer.current, cnvs.current, cam]);
    return (
        <canvas
            ref={cnvs}
            onWheel={wheel}
            width={camera.screenSize[0]}
            height={camera.screenSize[1]}
        ></canvas>
    );
}
