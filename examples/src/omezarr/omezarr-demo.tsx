import {
    Box2D,
    CartesianPlane,
    type Interval,
    PLANE_XY,
    type box2D,
    type vec2,
    type vec3,
} from '@alleninstitute/vis-geometry';
import { makeRGBColorVector } from '@alleninstitute/vis-core';
import { type OmeZarrMetadata, loadMetadata, sizeInUnits } from '@alleninstitute/vis-omezarr';
import type { RenderSettings, RenderSettingsChannels } from '@alleninstitute/vis-omezarr';
import { logger, type WebResource } from '@alleninstitute/vis-core';
import React, { useEffect, useMemo, useState } from 'react';
import { pan, zoom } from '~/common/camera';
import { RenderServerProvider } from '~/common/react/render-server-provider';
import { OmezarrViewer } from './omezarr-viewer';
import { SliceView } from './sliceview';

type DemoOption = { value: string, label: string, res: WebResource };

const demoOptions: DemoOption[] = [
    {
        value: 'opt1',
        label: 'VERSA OME-Zarr Example (HTTPS) (color channels: [R, G, B])',
        res: { type: 'https', url: 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/' }
    },
    {
        value: 'opt2',
        label: 'VS200 Example Image (S3) (color channels: [CFP, YFP])',
        res: { type: 's3', region: 'us-west-2', url: 's3://allen-genetic-tools/epifluorescence/1401210938/ome_zarr_conversion/1401210938.zarr/' }
    },
    {
        value: 'opt3',
        label: 'EPI Example Image (S3) (color channels: [R, G, B])',
        res: { type: 's3', region: 'us-west-2', url: 's3://allen-genetic-tools/epifluorescence/1383646325/ome_zarr_conversion/1383646325.zarr/' }
    },
    {
        value: 'opt4',
        label: 'STPT Example Image (S3) (color channels: [R, G, B])',
        res: { type: 's3', region: 'us-west-2', url: 's3://allen-genetic-tools/tissuecyte/823818122/ome_zarr_conversion/823818122.zarr/' }
    }
];

const screenSize: vec2 = [500, 500];

const defaultInterval: Interval = { min: 0, max: 80 };

function makeZarrSettings(screenSize: vec2, view: box2D, orthoVal: number, omezarr: OmeZarrMetadata): RenderSettings {
    const omezarrChannels = omezarr.colorChannels.reduce((acc, val, index) => {
        acc[val.label ?? `${index}`] = {
            rgb: val.rgb,
            gamut: val.range,
            index
        }
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
        channels: Object.keys(omezarrChannels).length > 0 ? omezarrChannels : fallbackChannels
    };
}

export function OmezarrDemo() {
    const [customUrl, setCustomUrl] = useState<string>("");
    const [selectedDemoOptionValue, setSelectedDemoOptionValue] = useState<string>("");
    const [omezarr, setOmezarr] = useState<OmeZarrMetadata | null>(null);
    const [omezarrJson, setOmezarrJson] = useState<string>("");
    const [view, setView] = useState(Box2D.create([0, 0], [1, 1]));
    const [planeIndex, setPlaneIndex] = useState(0);
    const [dragging, setDragging] = useState(false);

    const settings: RenderSettings | undefined = useMemo(
        () => (omezarr ? makeZarrSettings(screenSize, view, planeIndex, omezarr) : undefined),
        [omezarr, view, planeIndex],
    );

    const load = (res: WebResource) => {
        loadMetadata(res).then((v) => {
            setOmezarr(v);
            setOmezarrJson(JSON.stringify(v, undefined, 4));
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
    }

    const handleOptionSelected = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = e.target.value;
        setOmezarr(null);
        setSelectedDemoOptionValue(selectedValue);
        if (selectedValue && selectedValue !== 'custom') {
            const option = demoOptions.find((v) => v.value === selectedValue);
            if (option) {
                load(option.res);
            }
        }
    };

    const handleCustomUrlLoad = () => {
        const urlRegex = /^(s3|https):\/\/.*/;
        if (!urlRegex.test(customUrl)) {
            logger.error('cannot load resource: invalid URL');
            return;
        }
        const isS3 = customUrl.slice(0, 5) === 's3://';
        const resource: WebResource = isS3 ? { type: 's3', url: customUrl, region: 'us-west-2' } : { type: 'https', url: customUrl };
        load(resource);
    };

    // you could put this on the mouse wheel, but for this demo we'll have buttons
    const handlePlaneIndex = (next: 1 | -1) => {
        setPlaneIndex((prev) => Math.max(0, Math.min(prev + next, (omezarr?.maxOrthogonal(PLANE_XY) ?? 1) - 1)));
    };

    const handleZoom = (e: React.WheelEvent<HTMLCanvasElement>) => {
        // e.preventDefault();
        const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;
        const v = zoom(view, screenSize, zoomScale, [e.nativeEvent.offsetX, e.nativeEvent.offsetY]);
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

    return (
        <RenderServerProvider>
            <div style={{display: 'flex', flexDirection: 'column'}}>
                <h1>OME-Zarr Examples</h1>
                <div style={{display: 'flex', flexDirection: 'row', gap: '16px'}}>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <label>Select an OME-Zarr to View:</label>
                        <select 
                            name="webresource"
                            onChange={handleOptionSelected}
                        >
                            <option value="" key="default">-- Please select an option --</option>
                            {demoOptions.map((opt) => (
                                <option value={opt.value} key={opt.value}>{opt.label}</option>
                            ))}
                            <option value="custom" key="custom">* Enter a custom URL... *</option>
                        </select>
                        {selectedDemoOptionValue === 'custom' && (
                            <div style={{display: 'flex', flexDirection: 'row', gap: '8px'}}>
                                <input
                                    type="text"
                                    value={customUrl}
                                    onChange={(e) => setCustomUrl(e.target.value)}
                                    style={{flexGrow: 1}}
                                />
                                <button type="button" onClick={handleCustomUrlLoad}>Load</button>
                            </div>
                        )}
                        <div style={{
                            display: 'flex', 
                            flexDirection: 'column',
                            gap: '4px',
                            borderStyle: 'solid',
                            borderColor: 'black',
                            borderWidth: '1px', 
                            padding: '1px',
                            marginTop: '8px'
                        }}>
                            <div style={{ display: 'block', width: screenSize[0], height: screenSize[1], backgroundColor: '#777'}}>
                                {omezarr && settings && (
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
                                )}
                            </div>
                            <div style={{display: 'flex', flexDirection: 'row', gap: '8px', justifyContent: 'space-between'}}>
                                {omezarr && (
                                    <span>Slide {planeIndex + 1} of {(omezarr?.maxOrthogonal(PLANE_XY) ?? 0)}</span>
                                ) || (
                                    <span>No image loaded</span>
                                )}
                                <div style={{}}>
                                    <button type="button" onClick={() => handlePlaneIndex(-1)}>
                                        {'<-'}
                                    </button>
                                    <button type="button" onClick={() => handlePlaneIndex(1)}>
                                        {'->'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div style={{display: 'flex', flexDirection: 'column', gap: '8px'}}>
                        <label>Selected Image Metadata:</label>
                        <textarea readOnly cols={100} rows={36} style={{resize: 'none'}} value={omezarrJson}/>
                    </div>
                </div>
            </div>
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
        loadMetadata(demoOptions[0].res).then((dataset) => {
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
