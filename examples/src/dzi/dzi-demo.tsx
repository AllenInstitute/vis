import { useEffect, useMemo, useRef, useState } from 'react';
import { RenderServerProvider } from '../common/react/render-server-provider';
import React from 'react';
import type { DziImage, DziRenderSettings } from '@alleninstitute/vis-dzi';
import { Box2D, Vec2, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import { DziViewer } from './dzi-viewer';

// We know the sizes and formats ahead of time for these examples,
// if you'd like to see how to get this data from an endpoint with a dzi file check out use-dzi-image.ts
const exampleA: DziImage = {
    format: 'jpeg',
    imagesUrl:
        'https://idk-etl-prod-download-bucket.s3.amazonaws.com/idf-23-10-pathology-images/pat_images_HPW332DMO29NC92JPWA/H20.33.029-A12-I6-primary/H20.33.029-A12-I6-primary_files/',
    overlap: 1,
    size: {
        width: 13446,
        height: 11596,
    },
    tileSize: 512,
};

const exampleB: DziImage = {
    imagesUrl: 'https://openseadragon.github.io/example-images/highsmith/highsmith_files/',
    format: 'jpg',
    overlap: 2,
    size: {
        width: 7026,
        height: 9221,
    },
    tileSize: 256,
};

const screenSize: vec2 = [500, 500];

const images = [exampleA, exampleB];

/**
 * HEY!!!
 * this is an example React Component for rendering two DZI images which share a camera.
 * Additionally, both images have an SVG overlay.
 * This example is as bare-bones as possible! It is NOT the recommended way to do anything, its just trying to show
 * one way of:
 * 1. using our rendering utilities for DZI data, specifically in a react component. Your needs for state-management,
 * SVG overlays, etc may all be different!
 *
 */
export function DziDemo() {
    // the DZI renderer expects a "relative" camera - that means a box, from 0 to 1. 0 is the bottom or left of the image,
    // and 1 is the top or right of the image, regardless of the aspect ratio of that image.
    const [view, setView] = useState<box2D>(Box2D.create([0, 0], [1, 1]));
    const zoom = (e: WheelEvent) => {
        e.preventDefault();
        const scale = e.deltaY > 0 ? 1.1 : 0.9;
        const m = Box2D.midpoint(view);
        const v = Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m);
        setView(v);
    };
    const overlay = useRef<HTMLImageElement>(new Image());

    const camera: DziRenderSettings['camera'] = useMemo(() => ({ screenSize, view }), [view]);

    useEffect(() => {
        overlay.current.onload = () => {
            console.log('loaded svg!');
        };
        overlay.current.src =
            'https://idk-etl-prod-download-bucket.s3.amazonaws.com/idf-22-07-pathology-image-move/pat_images_JGCXWER774NLNWX2NNR/7179-A6-I6-MTG-classified/annotation.svg';
    }, []);

    return (
        <RenderServerProvider>
            <p>Scroll below to view image</p>
            <div style={{ display: 'flex', flexDirection: 'row' }}>
                {images.map((v) => (
                    <div style={{ width: screenSize[0], height: screenSize[1] }}>
                        <DziViewer
                            id={v.imagesUrl}
                            dzi={v}
                            camera={camera}
                            svgOverlay={overlay.current}
                            onWheel={zoom}
                        />
                    </div>
                ))}
            </div>
        </RenderServerProvider>
    );
}
