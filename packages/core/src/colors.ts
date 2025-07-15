import type { vec3, vec4 } from '@alleninstitute/vis-geometry';
import { logger } from './logger';

// Tests for optional #, then 3 or 6 hex digits
const RGB_COLOR_REGEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
// Tests for optional #, then 4 or 8 hex digits
const RGBA_COLOR_REGEX = /^#?([0-9a-fA-F]{4}|[0-9a-fA-F]{8})$/;

/**
 * Converts a color hash string to a vec3 RGB color vector.
 *
 * @param colorHashStr A string representing a color in hex format, e.g., '#f00' or 'ff0000'.
 * @param normalized A boolean indicating whether to normalize the color values to the range [0, 1]. Defaults to true.
 * @returns A vec3 array representing the RGB color vector. If the input is invalid, returns [0, 0, 0].
 */
export function makeRGBColorVector(colorHashStr: string, normalized = true): vec3 {
    if (!colorHashStr || !RGB_COLOR_REGEX.test(colorHashStr)) {
        logger.warn('invalid color hash string; returning black color vector (0, 0, 0)');
        return [0, 0, 0];
    }
    const hasHash = colorHashStr.charAt(0) === '#';
    const sanitizedColorHashStr = hasHash ? colorHashStr : `#${colorHashStr}`;

    const redCode =
        sanitizedColorHashStr.length === 4
            ? sanitizedColorHashStr.charAt(1) + sanitizedColorHashStr.charAt(1)
            : sanitizedColorHashStr.slice(1, 3);
    const greenCode =
        sanitizedColorHashStr.length === 4
            ? sanitizedColorHashStr.charAt(2) + sanitizedColorHashStr.charAt(2)
            : sanitizedColorHashStr.slice(3, 5);
    const blueCode =
        sanitizedColorHashStr.length === 4
            ? sanitizedColorHashStr.charAt(3) + sanitizedColorHashStr.charAt(3)
            : sanitizedColorHashStr.slice(5, 7);

    const divisor = normalized ? 255 : 1;
    return [
        Number.parseInt(redCode, 16) / divisor,
        Number.parseInt(greenCode, 16) / divisor,
        Number.parseInt(blueCode, 16) / divisor,
    ];
}

/**
 * Converts a color hash string to a vec4 RGBA color vector.
 *
 * @param colorHashStr A string representing a color in hex format, e.g., '#f00f' or 'ff0000ff'.
 * @param normalized A boolean indicating whether to normalize the color values to the range [0, 1]. Defaults to true.
 * @returns A vec3 array representing the RGB color vector. If the input is invalid, returns [0, 0, 0, 0].
 */
export function makeRGBAColorVector(colorHashStr: string, normalized = true): vec4 {
    if (!colorHashStr) {
        logger.warn('invalid color hash string; returning transparent black color vector (0, 0, 0, 0)');
        return [0, 0, 0, 0];
    }

    if (RGBA_COLOR_REGEX.test(colorHashStr)) {
        const hashHash = colorHashStr.charAt(0) === '#';
        const sanitizedColorHashStr = hashHash ? colorHashStr : `#${colorHashStr}`;

        const redCode =
            sanitizedColorHashStr.length === 5
                ? sanitizedColorHashStr.charAt(1) + sanitizedColorHashStr.charAt(1)
                : sanitizedColorHashStr.slice(1, 3);
        const greenCode =
            sanitizedColorHashStr.length === 5
                ? sanitizedColorHashStr.charAt(2) + sanitizedColorHashStr.charAt(2)
                : sanitizedColorHashStr.slice(3, 5);
        const blueCode =
            sanitizedColorHashStr.length === 5
                ? sanitizedColorHashStr.charAt(3) + sanitizedColorHashStr.charAt(3)
                : sanitizedColorHashStr.slice(5, 7);
        const alphaCode =
            sanitizedColorHashStr.length === 5
                ? sanitizedColorHashStr.charAt(4) + sanitizedColorHashStr.charAt(4)
                : sanitizedColorHashStr.slice(7, 9);
        const divisor = normalized ? 255 : 1;
        return [
            Number.parseInt(redCode, 16) / divisor,
            Number.parseInt(greenCode, 16) / divisor,
            Number.parseInt(blueCode, 16) / divisor,
            Number.parseInt(alphaCode, 16) / divisor,
        ];
    }
    if (RGB_COLOR_REGEX.test(colorHashStr)) {
        const rgb = makeRGBColorVector(colorHashStr, normalized);
        return [...rgb, normalized ? 1.0 : 255.0];
    }
    logger.warn('invalid color hash string; returning transparent black color vector (0, 0, 0, 0)');
    return [0, 0, 0, 0];
}
