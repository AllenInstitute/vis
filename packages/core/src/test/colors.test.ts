import { describe, it, expect, vi } from 'vitest';
import { makeRGBColorVector, makeRGBAColorVector } from '../colors';
import { logger } from '../logger';

// Mock the logger to test warnings
vi.mock('../logger', () => ({
    logger: {
        warn: vi.fn(),
    },
}));

describe('makeRGBColorVector', () => {
    it('should return a black color vector for invalid input', () => {
        const result = makeRGBColorVector('invalid');
        expect(result).toEqual([0, 0, 0]);
        expect(logger.warn).toHaveBeenCalledWith('invalid color hash string; returning black color vector (0, 0, 0)');
    });

    it('should handle 3-character RGB without a hash', () => {
        const result = makeRGBColorVector('f00');
        expect(result).toEqual([1, 0, 0]); // Normalized RGB
    });

    it('should handle 3-character RGB with a hash', () => {
        const result = makeRGBColorVector('#f00');
        expect(result).toEqual([1, 0, 0]); // Normalized RGB
    });

    it('should handle 6-character RGB without a hash', () => {
        const result = makeRGBColorVector('ff0000');
        expect(result).toEqual([1, 0, 0]); // Normalized RGB
    });

    it('should handle 6-character RGB with a hash', () => {
        const result = makeRGBColorVector('#ff0000');
        expect(result).toEqual([1, 0, 0]); // Normalized RGB
    });
});

describe('makeRGBAColorVector', () => {
    it('should return a transparent black color vector for invalid input', () => {
        const result = makeRGBAColorVector('invalid');
        expect(result).toEqual([0, 0, 0, 0]);
        expect(logger.warn).toHaveBeenCalledWith(
            'invalid color hash string; returning transparent black color vector (0, 0, 0, 0)',
        );
    });

    it('should handle 4-character RGBA without a hash', () => {
        const result = makeRGBAColorVector('f00f');
        expect(result).toEqual([1, 0, 0, 1]); // Normalized RGBA
    });

    it('should handle 4-character RGBA with a hash', () => {
        const result = makeRGBAColorVector('#f00f');
        expect(result).toEqual([1, 0, 0, 1]); // Normalized RGBA
    });

    it('should handle 8-character RGBA without a hash', () => {
        const result = makeRGBAColorVector('ff0000ff');
        expect(result).toEqual([1, 0, 0, 1]); // Normalized RGBA
    });

    it('should handle 8-character RGBA with a hash', () => {
        const result = makeRGBAColorVector('#ff0000ff');
        expect(result).toEqual([1, 0, 0, 1]); // Normalized RGBA
    });

    it('should handle RGB input and add alpha channel', () => {
        const result = makeRGBAColorVector('#ff0000');
        expect(result).toEqual([1, 0, 0, 1]); // Normalized RGBA with alpha = 1
    });
});
