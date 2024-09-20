import { useContext, useEffect, useRef } from 'react';
import { reglContext } from './offscreen-renderer';
import { buildDziRenderer, type DziImage, type DziRenderSettings, type DziTile } from '@alleninstitute/vis-dzi';
import React from 'react';
import { Box2D } from '@alleninstitute/vis-geometry';
import { buildAsyncRenderer } from '@alleninstitute/vis-scatterbrain';
import { partial } from 'lodash';

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
const exampleSettings: DziRenderSettings = {
    camera: {
        screenSize: [1024, 1024],
        view: Box2D.create([0, 0], [1, 1]),
    },
};
export function DziView() {
    const server = useContext(reglContext);
    const renderer =
        useRef<ReturnType<typeof buildAsyncRenderer<DziImage, DziTile, DziRenderSettings, string, string, any>>>();
    const cnvs = useRef<HTMLCanvasElement>(null);
    useEffect(() => {
        if (server && server.regl) {
            buildDziRenderer(server.regl);
            const what = buildDziRenderer(server.regl);
            renderer.current = buildAsyncRenderer(what);
        }
    }, [server]);
    useEffect(() => {
        if (server && renderer.current && cnvs.current) {
            // const hey= partial(renderer.current, example,exampleSettings)// ()=>renderer.current(example,exampleSettings,callback,target)
            const hey = (target, cache, callback) => {
                return renderer.current(example, exampleSettings, callback, target, cache);
            };
            const ctx = cnvs.current.getContext('bitmaprenderer');
            server.beginRendering(hey, (e) => console.log(e), ctx!);
        }
    }, [server, renderer.current, cnvs.current]);
    return (
        <canvas
            ref={cnvs}
            width={1024}
            height={1024}
        ></canvas>
    );
}
