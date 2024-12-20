import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { RenderServerProvider } from '../common/react/render-server-provider';
import React from 'react';
import { DziView } from './dziView';
import type { DziImage, DziRenderSettings } from '@alleninstitute/vis-dzi';
import { Box2D, Vec2, type box2D } from '@alleninstitute/vis-geometry';

const example: DziImage = {
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
const exampleDzi: DziImage = {
    imagesUrl: 'https://openseadragon.github.io/example-images/highsmith/highsmith_files/',
    format: 'jpg',
    overlap: 2,
    size: {
        width: 7026,
        height: 9221,
    },
    tileSize: 256,
};
const exampleSettings: DziRenderSettings = {
    camera: {
        screenSize: [500, 500],
        view: Box2D.create([0, 0], [1, 1]),
    },
};
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
export function TwoClientsPOC() {
    // the DZI renderer expects a "relative" camera - that means a box, from 0 to 1. 0 is the bottom or left of the image,
    // and 1 is the top or right of the image, regardless of the aspect ratio of that image.
    const [view, setView] = useState<box2D>(Box2D.create([0, 0], [1, 1]));
    const zoom = (e: React.WheelEvent<HTMLCanvasElement>) => {
        const scale = e.deltaY > 0 ? 1.1 : 0.9;
        const m = Box2D.midpoint(view);
        const v = Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m);
        setView(v);
    };
    const overlay = useRef<HTMLImageElement>(new Image());
    useEffect(() => {
        overlay.current.onload = () => {
            console.log('loaded svg!');
        };
        overlay.current.src =
            'https://idk-etl-prod-download-bucket.s3.amazonaws.com/idf-22-07-pathology-image-move/pat_images_JGCXWER774NLNWX2NNR/7179-A6-I6-MTG-classified/annotation.svg';
    }, []);
    return (
        <RenderServerProvider>
            <DziView
                id="left"
                svgOverlay={overlay.current}
                dzi={example}
                camera={{ ...exampleSettings.camera, view }}
                wheel={zoom}
            />
            <DziView
                id="right"
                dzi={exampleDzi}
                svgOverlay={overlay.current}
                camera={{ ...exampleSettings.camera, view }}
                wheel={zoom}
            />
        </RenderServerProvider>
    );
}
