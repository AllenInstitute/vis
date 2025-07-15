import { describe, it, expect, vi } from 'vitest';
import { makeRGBColorVector, makeRGBAColorVector } from '../colors';
import { logger } from '../logger';

// Mock the logger to verify warning logs are emitted
vi.mock('../logger', () => ({
    logger: {
        warn: vi.fn(),
    },
}));

describe('makeRGBColorVector', () => {
    it('should return a black for invalid input and log warning', () => {
        const result = makeRGBColorVector('this is not a color');
        expect(result).toEqual([0, 0, 0]);
        expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle 3-character RGB without a hash', () => {
        const result = makeRGBColorVector('f00');
        expect(result).toEqual([1, 0, 0]);
    });

    it('should handle 3-character RGB with a hash', () => {
        const result = makeRGBColorVector('#f00');
        expect(result).toEqual([1, 0, 0]);
    });

    it('should handle 6-character RGB without a hash', () => {
        const result = makeRGBColorVector('ff0000');
        expect(result).toEqual([1, 0, 0]);
    });

    it('should handle 6-character RGB with a hash', () => {
        const result = makeRGBColorVector('#ff0000');
        expect(result).toEqual([1, 0, 0]);
    });

    it('should return non-normalized values when normalize is false', () => {
        const result = makeRGBColorVector('#ff0000', false);
        expect(result).toEqual([255, 0, 0]);
    });
});

describe('makeRGBAColorVector', () => {
    it('should return a transparent black for invalid input and log warning', () => {
        const result = makeRGBAColorVector('this is not a color');
        expect(result).toEqual([0, 0, 0, 0]);
        expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle 4-character RGBA without a hash', () => {
        const result = makeRGBAColorVector('f00f');
        expect(result).toEqual([1, 0, 0, 1]);
    });

    it('should handle 4-character RGBA with a hash', () => {
        const result = makeRGBAColorVector('#f00f');
        expect(result).toEqual([1, 0, 0, 1]);
    });

    it('should handle 8-character RGBA without a hash', () => {
        const result = makeRGBAColorVector('ff0000ff');
        expect(result).toEqual([1, 0, 0, 1]);
    });

    it('should handle 8-character RGBA with a hash', () => {
        const result = makeRGBAColorVector('#ff0000ff');
        expect(result).toEqual([1, 0, 0, 1]);
    });

    it('should handle RGB input and add alpha channel', () => {
        const result = makeRGBAColorVector('#ff0000');
        expect(result).toEqual([1, 0, 0, 1]);
    });

    it('should return non-normalized values when normalize is false', () => {
        const result = makeRGBAColorVector('#ff0000ff', false);
        expect(result).toEqual([255, 0, 0, 255]);
    });

    it('should handle RGB input and add non-normalized alpha channel when normalize is false', () => {
        const result = makeRGBAColorVector('#ff0000', false);
        expect(result).toEqual([255, 0, 0, 255]);
    });
});
