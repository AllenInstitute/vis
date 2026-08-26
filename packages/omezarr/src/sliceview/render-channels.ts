import type { Interval } from '@alleninstitute/vis-geometry';
import type { OmeZarrColorChannel, OmeZarrMetadata } from '../zarr/types';
import type { RenderSettingsChannels } from './slice-renderer';

const DEFAULT_GAMUT: Interval = { min: 0, max: 80 };

/**
 * Clamps a display range to what the data can hold. Some files declare an end past the max - uint8
 * data ending at 473, say - which spreads the gamut over values the data never reaches, rendering
 * that channel dim.
 * @param displayRange the omero window's start and end
 * @param dataRange the omero window's min and max
 */
export const clampGamutToDataRange = (displayRange: Interval, dataRange: Interval): Interval => {
    // a degenerate data range tells us nothing, so trust the display range
    if (dataRange.max <= dataRange.min) {
        return displayRange;
    }
    const clamp = (value: number) => Math.min(Math.max(value, dataRange.min), dataRange.max);
    return { min: clamp(displayRange.min), max: clamp(displayRange.max) };
};

/**
 * Plain red, green and blue, for files with no omero metadata to describe their channels.
 * @param gamut the gamut to give each channel
 */
export const fallbackRGBChannels = (gamut: Interval = DEFAULT_GAMUT): RenderSettingsChannels => {
    return {
        R: { index: 0, gamut, rgb: [1, 0, 0] },
        G: { index: 1, gamut, rgb: [0, 1, 0] },
        B: { index: 2, gamut, rgb: [0, 0, 1] },
    };
};

const channelSettings = (channel: OmeZarrColorChannel, index: number) => {
    return {
        index,
        gamut: clampGamutToDataRange(channel.range, channel.window),
        rgb: channel.rgb,
    };
};

/**
 * Builds render channels from a file's own omero metadata, keyed by channel label.
 * @param metadata metadata of the OME-Zarr file to render
 * @returns the file's channels, or {@link fallbackRGBChannels} if it has no omero metadata
 */
export const renderChannelsFromMetadata = (
    metadata: Pick<OmeZarrMetadata, 'colorChannels'>
): RenderSettingsChannels => {
    const { colorChannels } = metadata;
    if (colorChannels.length === 0) {
        return fallbackRGBChannels();
    }
    return colorChannels.reduce<RenderSettingsChannels>((acc, channel, index) => {
        acc[channel.label ?? `ch${index}`] = channelSettings(channel, index);
        return acc;
    }, {});
};
