import { describe, it, expect } from 'vitest';
import type { Interval, vec3 } from '@alleninstitute/vis-geometry';
import type { OmeZarrColorChannel } from '../zarr/types';
import { clampGamutToDataRange, fallbackRGBChannels, renderChannelsFromMetadata } from './render-channels';

const colorChannel = (
    label: string | undefined,
    range: Interval,
    window: Interval,
    rgb: vec3 = [1, 1, 1]
): OmeZarrColorChannel => ({ label, range, window, rgb, rgba: [...rgb, 1] });

// renderChannelsFromMetadata asks only for colorChannels, so a plain object satisfies it
const metadataWith = (colorChannels: OmeZarrColorChannel[]) => ({ colorChannels });

describe('clampGamutToDataRange', () => {
    it('should leave a display range that fits inside the data range alone', () => {
        expect(clampGamutToDataRange({ min: 2, max: 71 }, { min: 0, max: 255 })).toEqual({ min: 2, max: 71 });
    });

    it('should clamp a display range that reaches past the data range', () => {
        expect(clampGamutToDataRange({ min: 0, max: 473 }, { min: 0, max: 255 })).toEqual({ min: 0, max: 255 });
    });

    it('should clamp the low end of the display range too', () => {
        expect(clampGamutToDataRange({ min: -10, max: 4095 }, { min: 0, max: 65535 })).toEqual({ min: 0, max: 4095 });
    });

    it('should fall back to the display range when the data range is degenerate', () => {
        expect(clampGamutToDataRange({ min: 0, max: 473 }, { min: 0, max: 0 })).toEqual({ min: 0, max: 473 });
    });
});

describe('fallbackRGBChannels', () => {
    it('should map three data channels onto plain red, green and blue', () => {
        expect(fallbackRGBChannels()).toEqual({
            R: { index: 0, gamut: { min: 0, max: 80 }, rgb: [1, 0, 0] },
            G: { index: 1, gamut: { min: 0, max: 80 }, rgb: [0, 1, 0] },
            B: { index: 2, gamut: { min: 0, max: 80 }, rgb: [0, 0, 1] },
        });
    });

    it('should take a caller supplied gamut', () => {
        expect(fallbackRGBChannels({ min: 0, max: 255 }).R.gamut).toEqual({ min: 0, max: 255 });
    });
});

describe('renderChannelsFromMetadata', () => {
    it('should key the channels by their label and clamp their gamuts', () => {
        // the blue channel here describes uint8 data with a display end of 473
        const metadata = metadataWith([
            colorChannel('red', { min: 0, max: 128 }, { min: 0, max: 255 }, [1, 0, 0]),
            colorChannel('green', { min: 2, max: 71 }, { min: 0, max: 255 }, [0, 1, 0]),
            colorChannel('blue', { min: 0, max: 473 }, { min: 0, max: 255 }, [0, 0, 1]),
        ]);

        expect(renderChannelsFromMetadata(metadata)).toEqual({
            red: { index: 0, gamut: { min: 0, max: 128 }, rgb: [1, 0, 0] },
            green: { index: 1, gamut: { min: 2, max: 71 }, rgb: [0, 1, 0] },
            blue: { index: 2, gamut: { min: 0, max: 255 }, rgb: [0, 0, 1] },
        });
    });

    it('should fall back to a positional key for unlabeled channels', () => {
        const metadata = metadataWith([colorChannel(undefined, { min: 0, max: 10 }, { min: 0, max: 255 })]);

        expect(renderChannelsFromMetadata(metadata)).toEqual({
            ch0: { index: 0, gamut: { min: 0, max: 10 }, rgb: [1, 1, 1] },
        });
    });

    it('should fall back to plain RGB channels when the file has no omero metadata', () => {
        expect(renderChannelsFromMetadata(metadataWith([]))).toEqual(fallbackRGBChannels());
    });
});
