// TODO Unit test for loading is no longer feasible, as it requires an actual Zarr group + arrays to resolve correctly.
// Best bet is to create a proper fake OmeZarr dataset and do a "unit" (really, integration) test that way.

import { Box2D, PLANE_XY, PLANE_YZ, type box2D } from '@alleninstitute/vis-geometry';
import { describe, expect, it } from 'vitest';
import { getVisibleTiles } from './loader';
import { exampleOmeZarr } from './loader.test-data';

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
