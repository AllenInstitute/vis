import React, { useEffect, useMemo, useState } from 'react';
import { RenderServerProvider } from '~/common/react/render-server-provider';
import { SliceView } from './sliceview';
import { type OmeZarrDataset, loadOmeZarr, sizeInUnits } from '@alleninstitute/vis-omezarr';
import { OmezarrViewer } from './omezarr-viewer';
import { type RenderSettings } from '@alleninstitute/vis-omezarr';
import { Box2D, Vec2, type box2D, type Interval, type vec2 } from '@alleninstitute/vis-geometry';

const demo_versa = 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/';

const screenSize: vec2 = [500, 500];

const defaultInterval: Interval = { min: 0, max: 80 };

function makeZarrSettings(screenSize: vec2, view: box2D, planeIdx: number): RenderSettings {
    return {
        camera: { screenSize, view },
        gamut: {
            R: { gamut: defaultInterval, index: 0 },
            G: { gamut: defaultInterval, index: 1 },
            B: { gamut: defaultInterval, index: 2 },
        },
        plane: 'xy',
        planeIndex: planeIdx,
        tileSize: 256,
    };
}

export function OmezarrDemo() {
    const [omezarr, setOmezarr] = useState<OmeZarrDataset>();
    const [view, setView] = useState(Box2D.create([0, 0], [1, 1]));
    const [planeIndex, setPlaneIndex] = useState(0);
    const [dragging, setDragging] = useState(false);

    const settings: RenderSettings | undefined = useMemo(
        () => (omezarr ? makeZarrSettings(screenSize, view, planeIndex) : undefined),
        [omezarr, view, planeIndex]
    );

    useEffect(() => {
        loadOmeZarr(demo_versa).then((v) => {
            setOmezarr(v);
            const size = sizeInUnits('xy', v.multiscales[0].axes, v.multiscales[0].datasets[0]);
            if (size) {
                console.log(size);
                setView(Box2D.create([0, 0], [size[0], size[1]]));
            }
        });
    }, []);

    const zoom = (e: WheelEvent) => {
        e.preventDefault();

        const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;

        // translate mouse pos to data space
        // offset divided by screen size gives us a percentage of the canvas where the mouse is
        // multiply percentage by view size to make it data space
        // add offset of the min corner so that the position takes into account any box offset
        const zoomPoint: vec2 = Vec2.add(
            view.minCorner,
            Vec2.mul(Vec2.div([e.offsetX, e.offsetY], screenSize), Box2D.size(view))
        );

        // scale the box with our new zoom point as the center
        const v = Box2D.translate(
            Box2D.scale(Box2D.translate(view, Vec2.scale(zoomPoint, -1)), [zoomScale, zoomScale]),
            zoomPoint
        );

        setView(v);
    };

    const pan = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragging) {
            const pos = Vec2.div([-e.movementX, -e.movementY], screenSize);
            const scaledOffset = Vec2.mul(pos, Box2D.size(view));
            const v = Box2D.translate(view, scaledOffset);
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

    return omezarr && settings ? (
        <RenderServerProvider>
            <div>
                <button onClick={() => handlePlaneIndex(-1)}>{'<-'}</button>
                <button onClick={() => handlePlaneIndex(1)}>{'->'}</button>
            </div>
            <OmezarrViewer
                omezarr={omezarr}
                id="omezarr-viewer"
                screenSize={screenSize}
                settings={settings}
                onWheel={zoom}
                onMouseMove={pan}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            />
        </RenderServerProvider>
    ) : (
        <h5>Unable to load OME-Zarr</h5>
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
    const [omezarr, setfile] = useState<OmeZarrDataset | undefined>(undefined);
    useEffect(() => {
        loadOmeZarr(demo_versa).then((dataset) => {
            setfile(dataset);
            console.log('loaded!');
        });
    }, []);
    return (
        <RenderServerProvider>
            <SliceView omezarr={omezarr} />
        </RenderServerProvider>
    );
}
