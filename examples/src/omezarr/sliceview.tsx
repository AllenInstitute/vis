import { Box2D } from '@alleninstitute/vis-geometry';
import {
    buildAsyncOmezarrRenderer,
    defaultDecoder,
    type VoxelTile,
    type ZarrDataset,
    type RenderSettings,
} from '@alleninstitute/vis-omezarr';
import type { RenderFrameFn } from '@alleninstitute/vis-scatterbrain';
import React from 'react';
import { useContext, useEffect, useRef } from 'react';
import { renderServerContext } from '~/common/react/render-server-provider';
type Props = {
    omezarr: ZarrDataset | undefined;
};
const settings: RenderSettings = {
    tileSize: 256,
    gamut: {
        R: { gamut: { min: 0, max: 80 }, index: 0 },
        G: { gamut: { min: 0, max: 100 }, index: 1 },
        B: { gamut: { min: 0, max: 100 }, index: 2 },
    },
    plane: 'xy',
    planeIndex: 0,
    camera: {
        view: Box2D.create([0, 0], [250, 120]),
        screenSize: [500, 500],
    },
};
function compose(ctx: CanvasRenderingContext2D, image: ImageData) {
    ctx.putImageData(image, 0, 0);
}

export function SliceView(props: Props) {
    const { omezarr } = props;
    const server = useContext(renderServerContext);
    const cnvs = useRef<HTMLCanvasElement>(null);
    const renderer = useRef<ReturnType<typeof buildAsyncOmezarrRenderer>>();
    useEffect(() => {
        if (server && server.regl) {
            renderer.current = buildAsyncOmezarrRenderer(server.regl, defaultDecoder);
        }
        return () => {
            if (cnvs.current) {
                server?.destroyClient(cnvs.current);
            }
        };
    }, [server]);

    useEffect(() => {
        console.log('maybe render...');
        if (server && renderer.current && cnvs.current && omezarr) {
            const hey: RenderFrameFn<ZarrDataset, VoxelTile> = (target, cache, callback) => {
                if (renderer.current) {
                    return renderer.current(omezarr, settings, callback, target, cache);
                }
                return null;
            };
            console.log('go!');
            server.beginRendering(
                hey,
                (e) => {
                    switch (e.status) {
                        case 'begin':
                            server.regl?.clear({ framebuffer: e.target, color: [0, 0, 0, 0], depth: 1 });
                            break;
                        case 'progress':
                            // wanna see the tiles as they arrive?
                            e.server.copyToClient(compose);
                            break;
                        case 'finished': {
                            e.server.copyToClient(compose);
                        }
                    }
                },
                cnvs.current
            );
        }
    }, [server, renderer.current, cnvs.current, omezarr]);
    return (
        <canvas
            id={'hey there'}
            ref={cnvs}
            width={settings.camera.screenSize[0]}
            height={settings.camera.screenSize[1]}
        ></canvas>
    );
}
