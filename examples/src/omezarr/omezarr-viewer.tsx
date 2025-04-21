import { Box2D, Vec2, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import {
    type RenderSettings,
    type VoxelTile,
    type OmeZarrMetadata,
    buildAsyncOmezarrRenderer,
    pickBestScale,
    planeSizeInVoxels,
} from '@alleninstitute/vis-omezarr';
import { type RenderFrameFn, type RenderServer } from '@alleninstitute/vis-core';
import { useContext, useEffect, useRef } from 'react';
import type REGL from 'regl';
import { renderServerContext } from '~/common/react/render-server-provider';
import { multithreadedDecoder } from '~/common/loaders/ome-zarr/sliceWorkerPool';
import { buildImageRenderer } from '~/common/image-renderer';
interface OmezarrViewerProps {
    omezarr: OmeZarrMetadata;
    id: string;
    screenSize: vec2;
    settings: RenderSettings;
    onWheel?: (e: React.WheelEvent<HTMLCanvasElement>) => void;
    onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export type OmezarrViewerState = {
    planeIndex: number;
    view: box2D;
};
function compose(ctx: CanvasRenderingContext2D, image: ImageData) {
    ctx.putImageData(image, 0, 0);
}
type StashedView = {
    camera: RenderSettings['camera'];
    image: REGL.Framebuffer2D;
};

export function OmezarrViewer({
    omezarr,
    id,
    settings,
    onWheel,
    onMouseDown,
    onMouseUp,
    onMouseMove,
    onMouseLeave,
}: OmezarrViewerProps) {
    const canvas = useRef<HTMLCanvasElement>(null);
    const server = useContext(renderServerContext);
    const renderer = useRef<ReturnType<typeof buildAsyncOmezarrRenderer>>();
    const imgRenderer = useRef<ReturnType<typeof buildImageRenderer>>();
    const stash = useRef<StashedView>();
    function stashProgress(server: RenderServer, target: REGL.Framebuffer2D) {
        if (imgRenderer.current && stash.current) {
            server.regl?.clear({
                framebuffer: stash.current.image,
                color: [0, 0, 0, 0],
                depth: 1,
            });
            // can I start a sneaky frame here....
            imgRenderer.current({
                box: Box2D.toFlatArray(settings.camera.view),
                img: target,
                target: stash.current.image,
                view: Box2D.toFlatArray(settings.camera.view),
            });
            stash.current.camera = { ...settings.camera };
        }
    }
    // setup renderer and delete it when component goes away
    useEffect(() => {
        const c = canvas?.current;
        if (server?.regl && omezarr) {
            const numChannels = omezarr.colorChannels.length || 3;
            renderer.current = buildAsyncOmezarrRenderer(server.regl, multithreadedDecoder, {
                numChannels,
                queueOptions: { maximumInflightAsyncTasks: 1 },
            });
            // set up the stash:
            stash.current = {
                camera: settings.camera,
                image: server.regl.framebuffer({
                    color: server.regl.texture({
                        width: settings.camera.screenSize[0],
                        height: settings.camera.screenSize[1],
                        min: 'linear',
                        mag: 'linear',
                    }),
                }),
            };
            imgRenderer.current = buildImageRenderer(server.regl);
            server.regl.clear({ framebuffer: stash.current.image, color: [0, 0, 0, 0], depth: 1 });
        }
        return () => {
            if (c) {
                stash.current?.image.destroy();
                server?.destroyClient(c);
            }
        };
    }, [server, omezarr]);

    // render frames
    useEffect(() => {
        if (server && renderer.current && canvas.current && omezarr) {
            const renderFrame: RenderFrameFn<OmeZarrMetadata, VoxelTile> = (target, cache, callback) => {
                if (renderer.current) {
                    // if we had a stashed buffer of the previous frame...
                    // we could pre-load it into target, right here!
                    return renderer.current(omezarr, settings, callback, target, cache);
                }
                return null;
            };
            const lowResPreview: RenderFrameFn<OmeZarrMetadata, VoxelTile> = (target, cache, callback) => {
                if (renderer.current) {
                    // if we had a stashed buffer of the previous frame...
                    // we could pre-load it into target, right here!
                    return renderer.current(
                        omezarr,
                        { ...settings, camera: { view: settings.camera.view, screenSize: [1, 1] } },
                        callback,
                        target,
                        cache,
                    );
                }
                return null;
            };

            server.beginRendering(
                renderFrame,
                (e) => {
                    switch (e.status) {
                        case 'begin':
                            server.regl?.clear({
                                framebuffer: e.target,
                                color: [0, 0, 0, 0],
                                depth: 1,
                            });
                            lowResPreview(e.target, server.cache, (_e) => {})?.cancelFrame(
                                'lowres preview beneath actual frame',
                            );
                            if (imgRenderer.current && stash.current) {
                                imgRenderer.current({
                                    box: Box2D.toFlatArray(stash.current.camera.view),
                                    img: stash.current.image,
                                    target: e.target,
                                    view: Box2D.toFlatArray(settings.camera.view),
                                });
                                e.server.copyToClient(compose);
                            }
                            break;
                        case 'progress':
                            // wanna see the tiles as they arrive?
                            e.server.copyToClient(compose);
                            if (e.target !== null && server) {
                                stashProgress(server, e.target);
                            }
                            break;
                        case 'finished': {
                            e.server.copyToClient(compose);
                            // stash our nice image... do this all the time?
                            if (e.target !== null && server) {
                                stashProgress(server, e.target);
                            }
                            break;
                        }
                        case 'cancelled':
                            break;
                        default: {
                            break;
                        }
                    }
                },
                canvas.current,
            );
        }
    }, [server, omezarr, settings]);

    return (
        <canvas
            id={id}
            ref={canvas}
            width={settings.camera.screenSize[0]}
            height={settings.camera.screenSize[1]}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
            onWheel={onWheel}
        />
    );
}
