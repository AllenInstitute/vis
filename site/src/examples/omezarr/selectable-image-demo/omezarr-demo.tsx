import { Box2D, type Interval, PLANE_XY, type vec2 } from '@alleninstitute/vis-geometry';
import {
    CachedOmeZarrConnection,
    type OmeZarrConnection,
    type RenderSettings,
    makeRenderSettings,
} from '@alleninstitute/vis-omezarr';
import { logger, type WebResource } from '@alleninstitute/vis-core';
import type React from 'react';
import { useId, useMemo, useState } from 'react';
import { pan, zoom } from '../../common/camera';
import { RenderServerProvider } from '../../common/react/render-server-provider';
import { OmeZarrViewer } from './omezarr-viewer';
import { OMEZARR_DEMO_FILESETS } from 'src/examples/common/filesets/omezarr';

const screenSize: vec2 = [800, 800];

const defaultGamut: Interval = { min: 0, max: 80 };

const workerFactory = () => new Worker(new URL('../../common/loaders/omezarr/fetch.worker.ts', import.meta.url));

export function OmezarrDemo() {
    const [customUrl, setCustomUrl] = useState<string>('');
    const [selectedDemoOptionValue, setSelectedDemoOptionValue] = useState<string>('');
    const [omezarr, setOmezarr] = useState<OmeZarrConnection | null>(null);
    const [omezarrJson, setOmezarrJson] = useState<string>('');
    const [view, setView] = useState(Box2D.create([0, 0], [1, 1]));
    const [planeIndex, setPlaneParam] = useState(0);
    const [dragging, setDragging] = useState(false);

    const selectId = useId();
    const textAreaId = useId();
    const omezarrId = useId();

    const settings: RenderSettings | undefined = useMemo(
        () =>
            omezarr?.metadata
                ? makeRenderSettings(omezarr.metadata, screenSize, view, planeIndex, defaultGamut)
                : undefined,
        [omezarr, view, planeIndex],
    );

    const load = async (res: WebResource) => {
        const newOmezarr = new CachedOmeZarrConnection(res, workerFactory);
        newOmezarr.loadMetadata().then((metadata) => {
            setOmezarr(newOmezarr);
            setOmezarrJson(JSON.stringify(metadata, undefined, 4));
            const level = metadata.getLevel({ index: 0 });
            if (!level) {
                throw new Error('dataset 0 does not exist!');
            }
            const size = level.sizeInUnits(PLANE_XY);
            if (size) {
                logger.info('size', size);
                setView(Box2D.create([0, 0], size));
            }
        });
    };

    const handleOptionSelected = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const selectedValue = e.target.value;
        if (omezarr !== null) {
            omezarr.close(); // VERY IMPORTANT! Cleans up web workers that won't be used anymore
        }
        setOmezarr(null);
        setSelectedDemoOptionValue(selectedValue);
        if (selectedValue && selectedValue !== 'custom') {
            const option = OMEZARR_DEMO_FILESETS.find((v) => v.value === selectedValue);
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
        const resource: WebResource = isS3
            ? { type: 's3', url: customUrl, region: 'us-west-2' }
            : { type: 'https', url: customUrl };
        load(resource);
    };

    // you could put this on the mouse wheel, but for this demo we'll have buttons
    const handlePlaneIndex = (next: 1 | -1) => {
        if (omezarr?.metadata) {
            const step = omezarr.metadata.nextSliceStep(PLANE_XY, view, screenSize);
            setPlaneParam((prev) => Math.max(0, Math.min(prev + next * (step ?? 1), 1)));
        }
    };

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

    return (
        <RenderServerProvider>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', flexDirection: 'row', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label htmlFor={selectId}>Select an OME-Zarr to View:</label>
                        <select id={selectId} name="webresource" onChange={handleOptionSelected}>
                            <option value="" key="default">
                                -- Please select an option --
                            </option>
                            {OMEZARR_DEMO_FILESETS.map((opt) => (
                                <option value={opt.value} key={opt.value}>
                                    {opt.label}
                                </option>
                            ))}
                            <option value="custom" key="custom">
                                * Enter a custom URL... *
                            </option>
                        </select>
                        {selectedDemoOptionValue === 'custom' && (
                            <div style={{ display: 'flex', flexDirection: 'row', gap: '8px' }}>
                                <input
                                    type="text"
                                    value={customUrl}
                                    onChange={(e) => setCustomUrl(e.target.value)}
                                    style={{ flexGrow: 1 }}
                                />
                                <button type="button" onClick={handleCustomUrlLoad}>
                                    Load
                                </button>
                            </div>
                        )}
                        <div
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '4px',
                                borderStyle: 'solid',
                                borderColor: 'black',
                                borderWidth: '1px',
                                padding: '1px',
                                marginTop: '8px',
                            }}
                        >
                            <div
                                style={{
                                    display: 'block',
                                    width: screenSize[0],
                                    height: screenSize[1],
                                    backgroundColor: '#777',
                                }}
                            >
                                {omezarr && settings && (
                                    <OmeZarrViewer
                                        omezarr={omezarr}
                                        id={omezarrId}
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
                            <div
                                style={{
                                    display: 'flex',
                                    flexDirection: 'row',
                                    gap: '8px',
                                    justifyContent: 'space-between',
                                }}
                            >
                                {(omezarr && (
                                    <span>
                                        Slide{' '}
                                        {Math.floor(planeIndex * (omezarr.metadata?.maxOrthogonal(PLANE_XY) ?? 1))} of{' '}
                                        {omezarr.metadata?.maxOrthogonal(PLANE_XY) ?? 0}
                                    </span>
                                )) || <span>No image loaded</span>}
                                <div style={{}}>
                                    <button type="button" onClick={() => handlePlaneIndex(-1)}>
                                        &#9664;
                                    </button>
                                    <button type="button" onClick={() => handlePlaneIndex(1)}>
                                        &#9654;
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label htmlFor={textAreaId}>Selected Image Metadata:</label>
                    <textarea
                        id={textAreaId}
                        readOnly
                        cols={100}
                        rows={36}
                        style={{ resize: 'none' }}
                        value={omezarrJson}
                    />
                </div>
            </div>
        </RenderServerProvider>
    );
}
