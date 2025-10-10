/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <this is a demo, but not a demo of correct react-hook useage!> */
import { logger, type WebResource } from '@alleninstitute/vis-core';
import { Box2D, PLANE_XY, type box2D, type Interval, type vec2 } from '@alleninstitute/vis-geometry';
import {
    defaultPlanarDecoder,
    loadOmeZarrFileset,
    type OmeZarrFileset,
    type PlanarRenderSettings,
    type PlanarRenderSettingsChannels,
} from '@alleninstitute/vis-omezarr';
import { useContext, useState, useRef, useCallback, useEffect } from 'react';
import { zoom, pan } from '../common/camera';
import { SharedCacheContext } from '../common/react/priority-cache-provider';
import { buildConnectedRenderer } from './render-utils';

const defaultInterval: Interval = { min: 0, max: 80 };

function makeZarrSettings(screenSize: vec2, view: box2D, param: number, omezarr: OmeZarrFileset): PlanarRenderSettings {
    const omezarrChannels = omezarr.getColorChannels().reduce((acc, val, index) => {
        acc[val.label ?? `${index}`] = {
            rgb: val.rgb,
            gamut: val.range,
            index,
        };
        return acc;
    }, {} as PlanarRenderSettingsChannels);

    const fallbackChannels: PlanarRenderSettingsChannels = {
        R: { rgb: [1.0, 0, 0], gamut: defaultInterval, index: 0 },
        G: { rgb: [0, 1.0, 0], gamut: defaultInterval, index: 1 },
        B: { rgb: [0, 0, 1.0], gamut: defaultInterval, index: 2 },
    };

    return {
        camera: { screenSize, view },
        planeLocation: param,
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
    const [omezarr, setOmezarr] = useState<OmeZarrFileset | null>(null);
    const [view, setView] = useState(Box2D.create([0, 0], [1, 1]));
    const [planeParam, setPlaneParam] = useState(0.5);
    const [dragging, setDragging] = useState(false);
    const [renderer, setRenderer] = useState<ReturnType<typeof buildConnectedRenderer>>();
    const [tick, setTick] = useState<number>(0);
    const cnvs = useRef<HTMLCanvasElement>(null);

    const load = async (res: WebResource) => {
        const fileset = await loadOmeZarrFileset(res, new URL('./fetch.worker.ts', import.meta.url));
        setOmezarr(fileset);
        setPlaneParam(0.5);
        const level = fileset.getLevel({ index: 0 });
        if (!level) {
            throw new Error('level 0 does not exist!');
        }

        const size = level.sizeInUnits(PLANE_XY);
        if (size) {
            logger.info('size', size);
            setView(Box2D.create([0, 0], size));
        }
    };

    // you could put this on the mouse wheel, but for this demo we'll have buttons
    const handleScrollSlice = (next: 1 | -1) => {
        if (omezarr) {
            const step = omezarr.nextSliceStep(PLANE_XY, view, screenSize);
            setPlaneParam((prev) => Math.max(0, Math.min(prev + next * (step ?? 1), 1)));
        }
    };

    const handleZoom = useCallback(
        (e: WheelEvent) => {
            e.preventDefault();

            const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;
            const v = zoom(view, screenSize, zoomScale, [e.offsetX, e.offsetY]);
            setView(v);
        },
        [view, screenSize],
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
        if (cnvs.current && server && !renderer) {
            const { regl, cache } = server;
            const renderer = buildConnectedRenderer(regl, screenSize, cache, defaultPlanarDecoder, () => {
                requestAnimationFrame(() => {
                    setTick(performance.now());
                });
            });
            setRenderer(renderer);
            load(props.res);
        }
    }, [cnvs.current]);

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
    }, [omezarr, planeParam, view, tick]);

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
                <button type="button" onClick={() => handleScrollSlice(-1)}>
                    &#9664;
                </button>
                <button type="button" onClick={() => handleScrollSlice(1)}>
                    &#9654;
                </button>
            </div>
        </div>
    );
}
