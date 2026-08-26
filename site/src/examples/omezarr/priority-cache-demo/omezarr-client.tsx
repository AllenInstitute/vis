import { getResourceUrl, logger, type WebResource } from '@alleninstitute/vis-core';
import { Box2D, Camera2D, PLANE_XY, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import {
    type OmeZarrMetadata,
    loadMetadata,
    sizeInUnits,
    type RenderSettings,
    renderChannelsFromMetadata,
    nextSliceStep,
    decoderFactory,
} from '@alleninstitute/vis-omezarr';
import { useContext, useState, useRef, useCallback, useEffect } from 'react';
import { SharedCacheContext } from '../../common/react/priority-cache-provider';
import { buildConnectedRenderer } from './render-utils';

function makeZarrSettings(screenSize: vec2, view: box2D, param: number, omezarr: OmeZarrMetadata): RenderSettings {
    return {
        camera: { screenSize, view },
        planeLocation: param,
        plane: PLANE_XY,
        tileSize: 256,
        channels: renderChannelsFromMetadata(omezarr),
    };
}

type Props = {
    res: WebResource;
    screenSize: vec2;
};

const WORKERS = new URL('../../common/loaders/ome-zarr/fetch.worker.ts', import.meta.url);

// const WORKERS = new URL('../common/loaders/ome-zarr/fetch-slice.worker', import.meta.url);
export function OmeZarrView(props: Props) {
    const { screenSize } = props;
    const server = useContext(SharedCacheContext);
    const [omezarr, setOmezarr] = useState<OmeZarrMetadata | null>(null);
    const [view, setView] = useState(Box2D.create([0, 0], [1, 1]));
    const [planeParam, setPlaneParam] = useState(0.5);
    const [dragging, setDragging] = useState(false);
    const [renderer, setRenderer] = useState<ReturnType<typeof buildConnectedRenderer>>();
    const [tick, setTick] = useState<number>(0);
    const cnvs = useRef<HTMLCanvasElement>(null);

    // you could put this on the mouse wheel, but for this demo we'll have buttons
    const handleScrollSlice = (next: 1 | -1) => {
        if (omezarr) {
            const step = nextSliceStep(omezarr, PLANE_XY, view, screenSize);
            setPlaneParam((prev) => Math.max(0, Math.min(prev + next * (step ?? 1), 1)));
        }
    };

    const handleZoom = useCallback(
        (e: WheelEvent) => {
            e.preventDefault();

            const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;
            const v = Camera2D.zoom(view, screenSize, zoomScale, [e.offsetX, e.offsetY]);
            setView(v);
        },
        [view, screenSize]
    );

    const handlePan = (e: React.MouseEvent) => {
        if (dragging) {
            const v = Camera2D.pan(view, screenSize, [e.movementX, e.movementY]);
            setView(v);
        }
    };

    const handleMouseDown = () => {
        setDragging(true);
    };

    const handleMouseUp = () => {
        setDragging(false);
    };
    useEffect(() => {
        if (cnvs.current && server && !renderer) {
            const { decoder } = decoderFactory(getResourceUrl(props.res), WORKERS);
            const { regl, cache } = server;
            // the renderer has to be built after the metadata arrives: its render command is compiled for a
            // fixed channel count, and only the file can say how many channels it actually has
            loadMetadata(props.res).then((v) => {
                const dataset = v.getFirstShapedDataset(0);
                if (!dataset) {
                    throw new Error('dataset 0 does not exist!');
                }
                const size = sizeInUnits(PLANE_XY, v.attrs.multiscales[0].axes, dataset);
                if (size) {
                    logger.info('size', size);
                    // fitToScreen frames the whole image at the screen's aspect ratio - framing it as the raw
                    // data extent instead would stretch any non-square image onto this square canvas
                    setView(Camera2D.fitToScreen(size, screenSize));
                }
                const numChannels = Object.keys(renderChannelsFromMetadata(v)).length;
                setRenderer(
                    buildConnectedRenderer(
                        regl,
                        screenSize,
                        cache,
                        decoder,
                        () => {
                            requestAnimationFrame(() => {
                                setTick(performance.now());
                            });
                        },
                        numChannels
                    )
                );
                setPlaneParam(0.5);
                setOmezarr(v);
            });
        }
    }, [props.res, server, screenSize, renderer]);

    useEffect(() => {
        if (omezarr && cnvs.current && renderer) {
            const settings = makeZarrSettings(screenSize, view, planeParam, omezarr);
            const ctx = cnvs.current.getContext('2d');
            if (ctx) {
                renderer?.render(omezarr, settings);
                requestAnimationFrame(() => {
                    renderer?.copyPixels(ctx);
                });
            }
        }
    }, [omezarr, planeParam, view, tick, renderer, screenSize]);

    useEffect(() => {
        const canvas = cnvs.current;
        if (canvas) {
            canvas.addEventListener('wheel', handleZoom, { passive: false });
        }
        return () => {
            if (canvas) {
                canvas.removeEventListener('wheel', handleZoom);
            }
        };
    }, [handleZoom]);

    return (
        <div
            style={{
                display: 'block',
                width: screenSize[0],
                height: screenSize[1],
                backgroundColor: '#777',
            }}
        >
            <canvas
                ref={cnvs}
                width={screenSize[0]}
                height={screenSize[1]}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseMove={handlePan}
            />
            <div style={{}}>
                <button
                    type="button"
                    onClick={() => handleScrollSlice(-1)}
                >
                    &#9664;
                </button>
                <button
                    type="button"
                    onClick={() => handleScrollSlice(1)}
                >
                    &#9654;
                </button>
            </div>
        </div>
    );
}
