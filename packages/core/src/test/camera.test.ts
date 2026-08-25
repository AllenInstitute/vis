import { describe, it, expect } from 'vitest';
import { Box2D, type vec2 } from '@alleninstitute/vis-geometry';
import { fitToScreen, pan, screenToData, zoom, zoomAround } from '../camera';

const SCREEN: vec2 = [100, 100];
const VIEW = Box2D.create([0, 0], [10, 10]);

describe('screenToData', () => {
    it('should map the corners of the screen onto the corners of the view', () => {
        expect(screenToData(VIEW, SCREEN, [0, 0])).toEqual([0, 0]);
        expect(screenToData(VIEW, SCREEN, [100, 100])).toEqual([10, 10]);
    });

    it('should treat a larger canvas Y as a larger data Y', () => {
        expect(screenToData(VIEW, SCREEN, [50, 10])).toEqual([5, 1]);
    });

    it('should account for a view that does not start at the origin', () => {
        expect(screenToData(Box2D.create([100, 200], [110, 210]), SCREEN, [50, 50])).toEqual([105, 205]);
    });
});

describe('zoomAround', () => {
    it('should leave the fixed point where it was', () => {
        const zoomed = zoomAround(VIEW, [5, 5], 0.5);

        expect(zoomed.minCorner).toEqual([2.5, 2.5]);
        expect(zoomed.maxCorner).toEqual([7.5, 7.5]);
    });

    it('should hold a corner still when asked to zoom about it', () => {
        const zoomed = zoomAround(VIEW, [0, 0], 0.5);

        expect(zoomed.minCorner).toEqual([0, 0]);
        expect(zoomed.maxCorner).toEqual([5, 5]);
    });

    it('should grow the view for a scale above one', () => {
        expect(Box2D.size(zoomAround(VIEW, [5, 5], 2))).toEqual([20, 20]);
    });
});

describe('zoom', () => {
    it('should keep the point under the cursor fixed', () => {
        const zoomed = zoom(VIEW, SCREEN, 0.5, [50, 50]);

        expect(zoomed.minCorner).toEqual([2.5, 2.5]);
        expect(zoomed.maxCorner).toEqual([7.5, 7.5]);
    });

    it('should zoom toward the cursor rather than its mirror image', () => {
        // a cursor at the top of the canvas should close in on the low end of the data axis
        const zoomed = zoom(VIEW, SCREEN, 0.5, [50, 0]);

        expect(zoomed.minCorner).toEqual([2.5, 0]);
        expect(zoomed.maxCorner).toEqual([7.5, 5]);
    });
});

describe('pan', () => {
    it('should move the view opposite the drag, scaled into data space', () => {
        // dragging 10px right across a 100px screen showing 10 units moves the view 1 unit left
        const panned = pan(VIEW, SCREEN, [10, 20]);

        expect(panned.minCorner).toEqual([-1, -2]);
        expect(panned.maxCorner).toEqual([9, 8]);
    });

    it('should leave the view alone for a zero delta', () => {
        expect(pan(VIEW, SCREEN, [0, 0])).toEqual(VIEW);
    });

    it('should scale the pan with the zoom level', () => {
        expect(pan(Box2D.create([0, 0], [1, 1]), SCREEN, [10, 0]).minCorner).toEqual([-0.1, 0]);
    });

    it('should agree with screenToData about which way the vertical axis runs', () => {
        expect(screenToData(pan(VIEW, SCREEN, [0, 10]), SCREEN, [0, 0])[1]).toBeLessThan(0);
    });
});

describe('fitToScreen', () => {
    it('should frame a wide image so all of its width fits', () => {
        const view = fitToScreen([200, 100], [100, 100]);

        expect(view.minCorner[0]).toBe(0);
        expect(view.maxCorner[0]).toBe(200);
    });

    it('should frame a tall image so all of its height fits', () => {
        const view = fitToScreen([100, 200], [100, 100]);

        expect(view.minCorner[1]).toBe(0);
        expect(view.maxCorner[1]).toBe(200);
    });

    it('should split the slack evenly across the axis with room to spare', () => {
        // a 2:1 image on a square screen leaves half a screen of slack, so a quarter on each side
        const view = fitToScreen([200, 100], [100, 100]);

        expect(view.minCorner).toEqual([0, -50]);
        expect(view.maxCorner).toEqual([200, 150]);
    });

    it('should match the aspect ratio of the screen so the image is not stretched', () => {
        const [width, height] = Box2D.size(fitToScreen([300, 100], [200, 100]));

        expect(width / height).toBeCloseTo(2);
    });

    it('should leave an image that already matches the screen aspect ratio alone', () => {
        const view = fitToScreen([200, 100], [200, 100]);

        expect(view.minCorner).toEqual([0, 0]);
        expect(view.maxCorner).toEqual([200, 100]);
    });
});
