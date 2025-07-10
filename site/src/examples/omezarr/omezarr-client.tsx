import { logger, type WebResource } from '@alleninstitute/vis-core';
import { Box2D, PLANE_XY, type box2D, type Interval, type vec2 } from '@alleninstitute/vis-geometry';
import {
    OmeZarrMetadata,
    loadMetadata,
    sizeInUnits,
    type RenderSettings,
    type RenderSettingsChannels,
} from '@alleninstitute/vis-omezarr';
import { useContext, useState, useRef, useCallback, useEffect } from 'react';
import { zoom, pan } from '../common/camera';
import { multithreadedDecoder } from '../common/loaders/ome-zarr/sliceWorkerPool';
import { SharedCacheContext } from '../common/react/priority-cache-provider';
import { buildConnectedRenderer } from './render-utils';

const defaultInterval: Interval = { min: 0, max: 80 };

function makeZarrSettings(screenSize: vec2, view: box2D, orthoVal: number, omezarr: OmeZarrMetadata): RenderSettings {
    const omezarrChannels = omezarr.colorChannels.reduce((acc, val, index) => {
        acc[val.label ?? `${index}`] = {
            rgb: val.rgb,
            gamut: val.range,
            index,
        };
        return acc;
    }, {} as RenderSettingsChannels);

    const fallbackChannels: RenderSettingsChannels = {
        R: { rgb: [1.0, 0, 0], gamut: defaultInterval, index: 0 },
        G: { rgb: [0, 1.0, 0], gamut: defaultInterval, index: 1 },
        B: { rgb: [0, 0, 1.0], gamut: defaultInterval, index: 2 },
    };

    return {
        camera: { screenSize, view },
        orthoVal,
        plane: PLANE_XY,
        tileSize: 256,
        channels: Object.keys(omezarrChannels).length > 0 ? omezarrChannels : fallbackChannels,
    };
}

type Props = {
    res: WebResource;
    screenSize: vec2;
};

export function OmeZarrView(props: Props) {
    const { screenSize } = props;
    const server = useContext(SharedCacheContext);
    const [omezarr, setOmezarr] = useState<OmeZarrMetadata | null>(null);
    const [view, setView] = useState(Box2D.create([0, 0], [1, 1]));
    const [planeIndex, setPlaneIndex] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [renderer, setRenderer] = useState<ReturnType<typeof buildConnectedRenderer>>();
    const [tick, setTick] = useState<number>(0);
    const cnvs = useRef<HTMLCanvasElement>(null);

    const load = (res: WebResource) => {
        loadMetadata(res).then((v) => {
            setOmezarr(v);
            setPlaneIndex(Math.floor(v.maxOrthogonal(PLANE_XY) / 2));
            const dataset = v.getFirstShapedDataset(0);
            if (!dataset) {
                throw new Error('dataset 0 does not exist!');
            }
            const size = sizeInUnits(PLANE_XY, v.attrs.multiscales[0].axes, dataset);
            if (size) {
                logger.info('size', size);
                setView(Box2D.create([0, 0], size));
            }
        });
    };

    // you could put this on the mouse wheel, but for this demo we'll have buttons
    const handlePlaneIndex = (next: 1 | -1) => {
        setPlaneIndex((prev) => Math.max(0, Math.min(prev + next, (omezarr?.maxOrthogonal(PLANE_XY) ?? 1) - 1)));
    };

    const handleZoom = useCallback(
        (e: WheelEvent) => {
            e.preventDefault();

            const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;
            const v = zoom(view, screenSize, zoomScale, [e.offsetX, e.offsetY]);
            setView(v);
        },
        [view],
    );

    const handlePan = (e: React.MouseEvent) => {
        if (dragging) {
            const v = pan(view, screenSize, [e.movementX, e.movementY]);
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
        if (cnvs.current && server) {
            // do all setup as soon as we have a canvas reference
            cnvs.current.addEventListener('wheel', handleZoom);
            const { regl, cache } = server;
            const renderer = buildConnectedRenderer(regl, screenSize, cache, multithreadedDecoder, () => {
                requestAnimationFrame(() => {
                    setTick(performance.now());
                });
            });
            setRenderer(renderer);
            load(props.res);
        }
    }, [cnvs.current, server]);

    useEffect(() => {
        if (omezarr && cnvs.current) {
            const settings = makeZarrSettings(screenSize, view, planeIndex, omezarr);
            const ctx = cnvs.current.getContext('2d');
            if (ctx) {
                renderer?.render(omezarr, settings);
                requestAnimationFrame(() => {
                    renderer?.copyPixels(ctx);
                });
            }
        }
    }, [omezarr, planeIndex, view, tick]);
    useEffect(() => {
        if (cnvs?.current) {
            cnvs.current.addEventListener('wheel', handleZoom, { passive: false });
        }
        return () => {
            if (cnvs?.current) {
                cnvs.current.removeEventListener('wheel', handleZoom);
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
                <button type="button" onClick={() => handlePlaneIndex(-1)}>
                    &#9664;
                </button>
                <button type="button" onClick={() => handlePlaneIndex(1)}>
                    &#9654;
                </button>
            </div>
        </div>
    );
}
