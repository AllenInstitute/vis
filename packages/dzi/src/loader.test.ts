import { beforeEach, describe, expect, it, vi } from 'vitest';
import { tilesInLayer, type DziImage, tileWithOverlap, imageSizeAtLayer, firstSuitableLayer } from './loader';
import { Box2D } from '@alleninstitute/vis-geometry';

describe('tiling math', () => {
    const highsmith: DziImage = {
        format: 'jpeg',
        imagesUrl: 'https://openseadragon.github.io/example-images/highsmith/highsmith_files/',
        overlap: 2,
        size: {
            width: 7026,
            height: 9221,
        },
        tileSize: 256,
    };
    describe('layer selection', () => {
        it('picks layer 9 when the screen is 512 px wide (and the image is much larger)', () => {
            expect(firstSuitableLayer(highsmith.size.width, 512)).toEqual(9);
        });
        it('picks layer 8 when the screen is less than 256 px wide (and the image is much larger)', () => {
            expect(firstSuitableLayer(highsmith.size.width, 255)).toEqual(8);
        });
        it('wont pick a layer that wont exist (screen larger than image)', () => {
            const pretend_max_image_width = 512;
            expect(firstSuitableLayer(pretend_max_image_width, 4096)).toEqual(9);
        });
    });
    it('divide 512 into 2 chunks', () => {
        const intervals = tileWithOverlap(512, 256, 1);
        console.log(intervals);
        expect(intervals.length).toEqual(2);
        expect(intervals[0].min).toBe(0);
        expect(intervals[0].max).toBe(257);
        expect(intervals[1].min).toBe(255);
        expect(intervals[1].max).toBe(512);
    });
    // these sizes were all checked manually against the returned tile sizes from the example dzi in the given link
    it('matches observed image dimensions (https://openseadragon.github.io/example-images/highsmith/highsmith.dzi) at layer 7', () => {
        const tiles = tilesInLayer(highsmith, 7);
        expect(tiles.length).toBe(1);
        const s = Box2D.size(tiles[0][0]);
        expect(s).toEqual([55, 73]);
    });
    it('matches observed image dimensions (https://openseadragon.github.io/example-images/highsmith/highsmith.dzi) at layer 8', () => {
        const tiles = tilesInLayer(highsmith, 8);
        expect(tiles.length).toBe(1);
        const s = Box2D.size(tiles[0][0]);
        expect(s).toEqual([110, 145]);
    });
    it('image size is as expected for real data (layer 9) ', () => {
        const size = imageSizeAtLayer(highsmith, 9);
        expect(size).toEqual([220, 289]);
    });
    it('matches observed image dimensions (https://openseadragon.github.io/example-images/highsmith/highsmith.dzi) at layer 9', () => {
        const tiles = tilesInLayer(highsmith, 9);
        expect(tiles.length).toBe(2);
        expect(Box2D.size(tiles[0][0])).toEqual([220, 258]);
        expect(Box2D.size(tiles[1][0])).toEqual([220, 35]);
    });

    it('matches observed image dimensions (https://openseadragon.github.io/example-images/highsmith/highsmith.dzi) at layer 10', () => {
        const tiles = tilesInLayer(highsmith, 10);
        expect(tiles.length).toBe(3);
        expect(tiles[0].length).toBe(2);
        expect(Box2D.size(tiles[0][0])).toEqual([258, 258]); // 0_0
        expect(Box2D.size(tiles[0][1])).toEqual([186, 258]); // 1_0
        expect(Box2D.size(tiles[1][0])).toEqual([258, 260]); // 0_1
        expect(Box2D.size(tiles[1][1])).toEqual([186, 260]); // 1_1
        expect(Box2D.size(tiles[2][0])).toEqual([258, 67]); // 0_2
        expect(Box2D.size(tiles[2][1])).toEqual([186, 67]); // 1_2
    });
});
