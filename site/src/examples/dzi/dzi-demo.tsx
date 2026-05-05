import { useEffect, useMemo, useState } from 'react';
import { fetchDziMetadata, type DziImage } from '@alleninstitute/vis-dzi';
import { Box2D, type box2D, type vec2 } from '@alleninstitute/vis-geometry';

import { pan, zoom } from '../common/camera';
import { RenderServerProvider } from '../common/react/render-server-provider';
import { DziViewer } from './dzi-viewer';

const SVG_OVERLAY_URL =
    'https://idk-etl-prod-download-bucket.s3.amazonaws.com/idf-23-10-pathology-images/pat_images_JGCXWER774NLNWX2NNR/H20.33.040-A12-I6-primary/annotation.svg';

const DZI_URLS = [
    'https://idk-etl-prod-download-bucket.s3.amazonaws.com/idf-23-10-pathology-images/pat_images_JGCXWER774NLNWX2NNR/H20.33.040-A12-I6-primary/H20.33.040-A12-I6-primary.dzi',
    'https://idk-etl-prod-download-bucket.s3.amazonaws.com/idf-23-10-pathology-images/pat_images_JGCXWER774NLNWX2NNR/H20.33.040-A12-I6-analysis/H20.33.040-A12-I6-analysis.dzi',
];

const SCREEN_SIZE: vec2 = [400, 400];

/**
 * This React Component renders two DZI images which share a camera and a shared SVG overlay.
 *
 * It uses simple React state management for the camera, basic event handlers for mouse interactions,
 * and a shared RenderServer to render the DZI images to multiple canvases.
 */
export function DziDemo() {
    const [images, setImages] = useState<DziImage[]>([]);

    useEffect(() => {
        Promise.all(DZI_URLS.map(fetchDziMetadata)).then((results) => {
            setImages(results.filter((img): img is DziImage => img !== undefined));
        });
    }, []);

    // the DZI renderer expects a "relative" camera - that means a box, from 0 to 1. 0 is the bottom or left of the image,
    // and 1 is the top or right of the image, regardless of the aspect ratio of that image.
    const [view, setView] = useState<box2D>(Box2D.create([0, 0], [1, 1]));
    const [dragging, setDragging] = useState(false);

    const handleZoom = (e: WheelEvent) => {
        e.preventDefault();
        const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;
        const v = zoom(view, SCREEN_SIZE, zoomScale, [e.offsetX, e.offsetY]);
        setView(v);
    };

    const handlePan = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragging) {
            const v = pan(view, SCREEN_SIZE, [e.movementX, e.movementY]);
            setView(v);
        }
    };

    const handleMouseDown = () => {
        setDragging(true);
    };

    const handleMouseUp = () => {
        setDragging(false);
    };

    const [overlay, setOverlay] = useState<HTMLImageElement | null>(null);

    useEffect(() => {
        const img = new Image();
        img.onload = () => setOverlay(img);
        img.src = SVG_OVERLAY_URL;
    }, []);

    const camera = useMemo(() => ({ screenSize: SCREEN_SIZE, view }), [view]);

    return (
        <RenderServerProvider>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
                {images.map((v) => (
                    <div key={v.imagesUrl} style={{ width: SCREEN_SIZE[0], height: SCREEN_SIZE[1], marginTop: 0 }}>
                        <DziViewer
                            id={v.imagesUrl}
                            dzi={v}
                            camera={camera}
                            svgOverlay={overlay}
                            onMouseDown={handleMouseDown}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            onMouseMove={handlePan}
                            onWheel={handleZoom}
                        />
                    </div>
                ))}
            </div>
        </RenderServerProvider>
    );
}
