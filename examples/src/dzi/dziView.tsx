import { useContext, useEffect, useRef } from 'react';
import { reglContext } from './offscreen-renderer';
import { buildDziRenderer, type DziImage } from '@alleninstitute/vis-dzi';
import React from 'react';
import { Box2D } from '@alleninstitute/vis-geometry';

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
export function DziView() {
    const { regl, cache, canvas: offscreen } = useContext(reglContext);
    const renderer = useRef<ReturnType<typeof buildDziRenderer>>();
    const cnvs = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (regl) {
            renderer.current = buildDziRenderer(regl);
        }
    }, [regl]);
    useEffect(() => {
        if (offscreen && cnvs.current && regl && renderer.current && cache) {
            renderer.current(null, example, {
                regl,
                cache,
                callback: (e) => {
                    switch (e.status) {
                        case 'finished':
                        case 'finished_synchronously':
                            // get OUR canvas, and plop that bitmap!
                            const drawme = cnvs.current?.getContext('bitmaprenderer');
                            // this does not feel like a good idea...
                            drawme?.transferFromImageBitmap(offscreen.transferToImageBitmap());
                            break;
                    }
                },
                camera: {
                    screenSize: [cnvs.current.clientWidth, cnvs.current.clientHeight],
                    view: Box2D.create([0, 0], [1, 1]),
                },
            });
        }
    });
    return <canvas ref={cnvs}></canvas>;
}
