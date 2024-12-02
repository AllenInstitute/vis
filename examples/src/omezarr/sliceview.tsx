import { type box2D, Box2D, Vec2 } from '@alleninstitute/vis-geometry';
import {
    buildAsyncOmezarrRenderer,
    defaultDecoder,
    type VoxelTile,
    type ZarrDataset,
    type RenderSettings,
} from '@alleninstitute/vis-omezarr';
import type { RenderFrameFn } from '@alleninstitute/vis-scatterbrain';
import React, { useCallback, useState } from 'react';
import { useContext, useEffect, useRef } from 'react';
import { renderServerContext } from '~/common/react/render-server-provider';
type Props = {
    omezarr: ZarrDataset | undefined;
};
const settings: RenderSettings = {
    tileSize: 256,
    gamut: {
        R: { gamut: { min: 0, max: 1000 }, index: 0 },
        G: { gamut: { min: 0, max: 6000 }, index: 1 },
        B: { gamut: { min: 0, max: 600 }, index: 2 },
    },
    plane: 'xy',
    planeIndex: 3,
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
    const [view, setView] = useState<box2D>(Box2D.create([0, 0], [250, 120]));
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
        if (server && renderer.current && cnvs.current && omezarr) {
            const hey: RenderFrameFn<ZarrDataset, VoxelTile> = (target, cache, callback) => {
                if (renderer.current) {
                    return renderer.current(
                        omezarr,
                        { ...settings, camera: { ...settings.camera, view } },
                        callback,
                        target,
                        cache
                    );
                }
                return null;
            };
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
    }, [server, renderer.current, cnvs.current, omezarr, view]);
    const pan = useCallback(
        (e: React.MouseEvent<HTMLCanvasElement>) => {
            if (e.ctrlKey) {
                const pos = Vec2.div([-e.movementX, -e.movementY], settings.camera.screenSize);
                const scaledOffset = Vec2.mul(pos, Box2D.size(view));
                const v = Box2D.translate(view, scaledOffset);
                setView(v);
            }
        },
        [view]
    );
    return (
        <canvas
            id={'hey there'}
            ref={cnvs}
            onMouseMove={pan}
            onWheel={(e) => {
                const scale = e.deltaY > 0 ? 1.1 : 0.9;
                const m = Box2D.midpoint(view);
                const v = Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m);
                setView(v);
            }}
            width={settings.camera.screenSize[0]}
            height={settings.camera.screenSize[1]}
        ></canvas>
    );
}
