// TODO Unit test for loading is no longer feasible, as it requires an actual Zarr group + arrays to resolve correctly.
// Best bet is to create a proper fake OmeZarr dataset and do a "unit" (really, integration) test that way.

import { Box2D, PLANE_XY, PLANE_YZ, type box2D } from '@alleninstitute/vis-geometry';
import { describe, expect, it } from 'vitest';
import { getVisibleTiles } from './loader';
import { OmeZarrMetadata } from '../zarr/metadata';
const exampleOmeZarr: OmeZarrMetadata = new OmeZarrMetadata(
    new URL('https://allen-genetic-tools.s3.us-west-2.amazonaws.com/tissuecyte/1263343692/ome-zarr/'),
    {
        nodeType: 'group',
        zarrFormat: 3,
        attributes: {
            multiscales: [
                {
                    name: 'test',
                    version: '2',
                    axes: [
                        {
                            name: 'c',
                            type: 'channel',
                            unit: 'millimeter',
                        },
                        {
                            name: 'z',
                            type: 'space',
                            unit: 'millimeter',
                        },
                        {
                            name: 'y',
                            type: 'space',
                            unit: 'millimeter',
                        },
                        {
                            name: 'x',
                            type: 'space',
                            unit: 'millimeter',
                        },
                    ],
                    datasets: [
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.00035, 0.00035],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0, 0],
                                    type: 'translation',
                                },
                            ],
                            path: '0',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0007, 0.0007],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.00035, 0.00035],
                                    type: 'translation',
                                },
                            ],
                            path: '1',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0014, 0.0014],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.00105, 0.00105],
                                    type: 'translation',
                                },
                            ],
                            path: '2',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0028, 0.0028],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.00245, 0.00245],
                                    type: 'translation',
                                },
                            ],
                            path: '3',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0056, 0.0056],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.00525, 0.00525],
                                    type: 'translation',
                                },
                            ],
                            path: '4',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0112, 0.0112],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.01085, 0.01085],
                                    type: 'translation',
                                },
                            ],
                            path: '5',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0224, 0.0224],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.02205, 0.02205],
                                    type: 'translation',
                                },
                            ],
                            path: '6',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0448, 0.0448],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.044449999999999996, 0.044449999999999996],
                                    type: 'translation',
                                },
                            ],
                            path: '7',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.0896, 0.0896],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.08925, 0.08925],
                                    type: 'translation',
                                },
                            ],
                            path: '8',
                        },
                        {
                            coordinateTransformations: [
                                {
                                    scale: [1, 0.1, 0.1792, 0.1792],
                                    type: 'scale',
                                },
                                {
                                    translation: [0, 0, 0.17885, 0.17885],
                                    type: 'translation',
                                },
                            ],
                            path: '9',
                        },
                    ],
                },
            ],
        },
    },
    {
        '0': {
            nodeType: 'array',
            path: '0',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 29998, 39998],
            attributes: {},
        },
        '1': {
            nodeType: 'array',
            path: '1',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 14999, 19999],
            attributes: {},
        },
        '2': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 7499, 9999],
            attributes: {},
        },
        '3': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 3749, 4999],
            attributes: {},
        },
        '4': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 1874, 2499],
            attributes: {},
        },
        '5': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 937, 1249],
            attributes: {},
        },
        '6': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 468, 624],
            attributes: {},
        },
        '7': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 234, 312],
            attributes: {},
        },
        '8': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 117, 156],
            attributes: {},
        },
        '9': {
            nodeType: 'array',
            path: '2',
            chunkShape: [],
            dataType: 'float32',
            shape: [3, 142, 58, 78],
            attributes: {},
        },
    },
);

describe('omezarr basic tiled loading', () => {
    describe('getVisibleTiles', () => {
        it('visible tiles cannot extend beyond the bounds of their layer', () => {
            const view: box2D = {
                minCorner: [-7, -11],
                maxCorner: [28, 35],
            };
            const camera = { view, screenSize: [210, 210] as const };
            const visible = getVisibleTiles(camera, PLANE_XY, 2, exampleOmeZarr, 256);
            // this is a basic regression test: we had a bug which would result in
            // tiles from the image being larger than the image itself (they would be the given tile size)
            expect(visible.length).toBe(1);
            const expectedLayer = exampleOmeZarr.getLevel({ multiscale: { index: 0 }, index: 9 });
            expect(expectedLayer).toBeDefined();
            if (expectedLayer === undefined) {
                throw new Error('invalid test condition: passed expect.toBeDefined while still undefined');
            }
            // we expect to be seeing the lowest resolution layer with our very zoomed out, low res camera
            const [_c, _z, y, x] = expectedLayer.shape;
            expect(visible[0].bounds).toEqual(Box2D.create([0, 0], [x, y]));
        });
    });
    describe('sizeInUnits', () => {
        it('respects scale transformations', () => {
            // const axes = exampleOmeZarr.attrs.multiscales[0].axes;
            const firstDataset = exampleOmeZarr.getLevel({ multiscale: { index: 0 }, index: 0 });
            const lastDataset = exampleOmeZarr.getLevel({ multiscale: { index: 0 }, index: 9 });
            expect(firstDataset).toBeDefined();
            expect(lastDataset).toBeDefined();

            if (firstDataset === undefined || lastDataset === undefined) {
                throw new Error('invalid test condition: passed expect.toBeDefined while still undefined');
            }

            const layer9xy = lastDataset.sizeInUnits(PLANE_XY);
            const layer0xy = firstDataset.sizeInUnits(PLANE_XY);

            const layer9yz = lastDataset.sizeInUnits(PLANE_YZ);
            const layer0yz = firstDataset.sizeInUnits(PLANE_YZ);
            // we're looking at the highest resolution and lowest resolution layers.
            // I think in an ideal world, we'd expect each layer to end up having an exactly equal size,
            // however I think that isnt happening here for floating-point reasons - so the small differences are acceptable.
            expect(layer9xy).toEqual([13.9776, 10.3936]);
            expect(layer0xy).toEqual([13.9993, 10.4993]);
            // note the Y coordinate (last above, first below) is as expected:
            expect(layer9yz).toEqual([10.3936, 14.200000000000001]);
            expect(layer0yz).toEqual([10.4993, 14.200000000000001]);
        });
    });
});
