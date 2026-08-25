import type { Interval } from '@alleninstitute/vis-geometry';
import type { OmeZarrColorChannel, OmeZarrMetadata } from '../zarr/types';
import type { RenderSettingsChannels } from './slice-renderer';

const DEFAULT_GAMUT: Interval = { min: 0, max: 80 };

/**
 * Clamps a display range to what the data can hold. Some files declare an end past the max - uint8
 * data ending at 473, say - which spreads the gamut over values the data never reaches, rendering
 * that channel dim.
 * @param range the display range, from the omero window's start and end
 * @param window the data range, from the omero window's min and max
 */
export function clampGamutToDataRange(range: Interval, window: Interval): Interval {
    // a degenerate window tells us nothing, so trust the display range
    if (window.max <= window.min) {
        return range;
    }
    const clamp = (value: number) => Math.min(Math.max(value, window.min), window.max);
    return { min: clamp(range.min), max: clamp(range.max) };
}

/**
 * Plain red, green and blue, for files with no omero metadata to describe their channels.
 * @param gamut the gamut to give each channel
 */
export function fallbackRGBChannels(gamut: Interval = DEFAULT_GAMUT): RenderSettingsChannels {
    return {
        R: { index: 0, gamut, rgb: [1, 0, 0] },
        G: { index: 1, gamut, rgb: [0, 1, 0] },
        B: { index: 2, gamut, rgb: [0, 0, 1] },
    };
}

function channelSettings(channel: OmeZarrColorChannel, index: number) {
    return {
        index,
        gamut: clampGamutToDataRange(channel.range, channel.window),
        rgb: channel.rgb,
    };
}

/**
 * Builds render channels from a file's own omero metadata, keyed by channel label.
 * @param metadata metadata of the OME-Zarr file to render
 * @returns the file's channels, or {@link fallbackRGBChannels} if it has no omero metadata
 */
export function renderChannelsFromMetadata(metadata: OmeZarrMetadata): RenderSettingsChannels {
    const { colorChannels } = metadata;
    if (colorChannels.length === 0) {
        return fallbackRGBChannels();
    }
    return colorChannels.reduce((acc, channel, index) => {
        acc[channel.label ?? `ch${index}`] = channelSettings(channel, index);
        return acc;
    }, {} as RenderSettingsChannels);
}
