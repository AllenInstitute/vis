import { type vec3, type vec4 } from '@alleninstitute/vis-geometry';
import { logger } from './logger';

const RGB_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGBA_COLOR_REGEX = /^#([0-9a-fA-F]{4}|[0-9a-fA-F]{8})$/;

export function makeRGBColorVector(colorHashStr: string, normalized = true): vec3 {
    if (!colorHashStr || !RGB_COLOR_REGEX.test(colorHashStr)) {
        logger.warn('invalid color hash string; returning black color vector (0, 0, 0)');
        return [0, 0, 0];
    }
    const redCode =
        colorHashStr.length === 4 ? colorHashStr.charAt(1) + colorHashStr.charAt(1) : colorHashStr.slice(1, 3);
    const greenCode =
        colorHashStr.length === 4 ? colorHashStr.charAt(2) + colorHashStr.charAt(2) : colorHashStr.slice(3, 5);
    const blueCode =
        colorHashStr.length === 4 ? colorHashStr.charAt(3) + colorHashStr.charAt(3) : colorHashStr.slice(5, 7);
    const divisor = !!normalized ? 255 : 1;
    return [
        Number.parseInt(redCode, 16) / divisor,
        Number.parseInt(greenCode, 16) / divisor,
        Number.parseInt(blueCode, 16) / divisor,
    ];
}

export function makeRGBAColorVector(colorHashStr: string, normalized = true): vec4 {
    if (!colorHashStr) {
        logger.warn('invalid color hash string; returning transparent black color vector (0, 0, 0, 0)');
        return [0, 0, 0, 0];
    }
    if (RGBA_COLOR_REGEX.test(colorHashStr)) {
        const redCode =
            colorHashStr.length === 5 ? colorHashStr.charAt(1) + colorHashStr.charAt(1) : colorHashStr.slice(1, 3);
        const greenCode =
            colorHashStr.length === 5 ? colorHashStr.charAt(2) + colorHashStr.charAt(2) : colorHashStr.slice(3, 5);
        const blueCode =
            colorHashStr.length === 5 ? colorHashStr.charAt(3) + colorHashStr.charAt(3) : colorHashStr.slice(5, 7);
        const alphaCode =
            colorHashStr.length === 5 ? colorHashStr.charAt(4) + colorHashStr.charAt(4) : colorHashStr.slice(7, 9);
        const divisor = !!normalized ? 255 : 1;
        return [
            Number.parseInt(redCode, 16) / divisor,
            Number.parseInt(greenCode, 16) / divisor,
            Number.parseInt(blueCode, 16) / divisor,
            Number.parseInt(alphaCode, 16) / divisor,
        ];
    }
    if (RGB_COLOR_REGEX.test(colorHashStr)) {
        const rgb = makeRGBColorVector(colorHashStr);
        return [rgb[0], rgb[1], rgb[2], !!normalized ? 1.0 : 255.0];
    }
    logger.warn('invalid color hash string; returning transparent black color vector (0, 0, 0, 0)');
    return [0, 0, 0, 0];
}
