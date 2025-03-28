import { Box2D, CartesianPlane, type Interval, PLANE_XY, Vec2, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import { type OmeZarrMetadata, loadOmeZarr, sizeInUnits } from '@alleninstitute/vis-omezarr';
import type { RenderSettings } from '@alleninstitute/vis-omezarr';
import { logger } from '@alleninstitute/vis-scatterbrain';
import { useEffect, useMemo, useState } from 'react';
import { pan, zoom } from '~/common/camera';
import { RenderServerProvider } from '~/common/react/render-server-provider';
import { OmezarrViewer } from './omezarr-viewer';
import { SliceView } from './sliceview';

const demo_versa = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/';

const screenSize: vec2 = [500, 500];

const defaultInterval: Interval = { min: 0, max: 80 };

function makeZarrSettings(screenSize: vec2, view: box2D, orthoVal: number): RenderSettings {
    return {
        camera: { screenSize, view },
        gamut: {
            R: { gamut: defaultInterval, index: 0 },
            G: { gamut: defaultInterval, index: 1 },
            B: { gamut: defaultInterval, index: 2 },
        },
        plane: PLANE_XY,
        orthoVal,
        tileSize: 256,
    };
}

export function OmezarrDemo() {
    const [demoUrl, setDemoUrl] = useState<string>(demo_versa);
    const [omezarr, setOmezarr] = useState<OmeZarrMetadata>();
    const [view, setView] = useState(Box2D.create([0, 0], [1, 1]));
    const [planeIndex, setPlaneIndex] = useState(0);
    const [dragging, setDragging] = useState(false);

    const settings: RenderSettings | undefined = useMemo(
        () => (omezarr ? makeZarrSettings(screenSize, view, planeIndex) : undefined),
        [omezarr, view, planeIndex],
    );

    useEffect(() => {
        loadOmeZarr(demoUrl).then((v) => {
            setOmezarr(v);
            const dataset = v.getFirstShapedDataset(0);
            if (!dataset) {
                throw new Error('dataset 0 does not exist!');
            }
            const size = sizeInUnits(new CartesianPlane('xy'), v.attrs.multiscales[0].axes, dataset);
            if (size) {
                logger.info('size', size);
                setView(Box2D.create([0, 0], size));
            }
        });
    }, [demoUrl]);

    const handleZoom = (e: WheelEvent) => {
        e.preventDefault();
        const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;
        const v = zoom(view, screenSize, zoomScale, [e.offsetX, e.offsetY]);
        setView(v);
    };

    const handlePan = (e: React.MouseEvent<HTMLCanvasElement>) => {
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

    // you could put this on the mouse wheel, but for this demo we'll have buttons
    const handlePlaneIndex = (next: 1 | -1) => {
        setPlaneIndex((prev) => prev + next);
    };

    return (
        <RenderServerProvider>
            {omezarr && settings ? (
                <>
                    <div>
                        <input
                            type="text"
                            value={demoUrl}
                            onChange={(e) => setDemoUrl(e.target.value)}
                            style={{ width: '700px' }}
                        />
                        <button type="button" onClick={() => handlePlaneIndex(-1)}>
                            {'<-'}
                        </button>
                        <button type="button" onClick={() => handlePlaneIndex(1)}>
                            {'->'}
                        </button>
                    </div>
                    <OmezarrViewer
                        omezarr={omezarr}
                        id="omezarr-viewer"
                        screenSize={screenSize}
                        settings={settings}
                        onWheel={handleZoom}
                        onMouseMove={handlePan}
                        onMouseDown={handleMouseDown}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    />
                </>
            ) : (
                <h5>Unable to load OME-Zarr</h5>
            )}
        </RenderServerProvider>
    );
}
/**
 * HEY!!!
 * this is an example React Component for rendering A single slice of an OMEZARR image in a react component
 * This example is as bare-bones as possible! It is NOT the recommended way to do anything, its just trying to show
 * one way of:
 * 1. using our rendering utilities for OmeZarr data, specifically in a react component. Your needs for state-management,
 * slicing logic, etc might all be different!
 *
 */
function DataPlease() {
    // load our canned data for now:
    const [omezarr, setfile] = useState<OmeZarrMetadata | undefined>(undefined);
    useEffect(() => {
        loadOmeZarr(demo_versa).then((dataset) => {
            setfile(dataset);
            logger.info('loaded!');
        });
    }, []);
    return (
        <RenderServerProvider>
            <SliceView omezarr={omezarr} />
        </RenderServerProvider>
    );
}
