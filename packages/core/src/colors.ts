import type { vec3, vec4 } from '@alleninstitute/vis-geometry';
import { logger } from './logger';

const RGB_COLOR_REGEX = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGBA_COLOR_REGEX = /^#?([0-9a-fA-F]{4}|[0-9a-fA-F]{8})$/;

// test with urls
// https://d3hik2dwvr9wk1.cloudfront.net/A549/organelle_box_crop_v1.zarr/ACTB/Live/003001
// https://d3hik2dwvr9wk1.cloudfront.net/A549/organelle_box_crop_v1.zarr/ACTB/MeOH/003002
// https://d3hik2dwvr9wk1.cloudfront.net/A549/organelle_box_crop_v1.zarr/ACTB/PFA/003000

export function makeRGBColorVector(colorHashStr: string, normalized = true): vec3 {
    if (!colorHashStr || !RGB_COLOR_REGEX.test(colorHashStr)) {
        logger.warn('invalid color hash string; returning black color vector (0, 0, 0)');
        return [0, 0, 0];
    }

    const hasHash = colorHashStr.charAt(0) === '#';
    const properColorHashStr = hasHash ? colorHashStr : `#${colorHashStr}`;

    const redCode =
        properColorHashStr.length === 4
            ? properColorHashStr.charAt(1) + properColorHashStr.charAt(1)
            : properColorHashStr.slice(1, 3);
    const greenCode =
        properColorHashStr.length === 4
            ? properColorHashStr.charAt(2) + properColorHashStr.charAt(2)
            : properColorHashStr.slice(3, 5);
    const blueCode =
        properColorHashStr.length === 4
            ? properColorHashStr.charAt(3) + properColorHashStr.charAt(3)
            : properColorHashStr.slice(5, 7);

    const divisor = normalized ? 255 : 1;
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
        const hashHash = colorHashStr.charAt(0) === '#';
        const properColorHashStr = hashHash ? colorHashStr : `#${colorHashStr}`;

        const redCode =
            properColorHashStr.length === 5
                ? properColorHashStr.charAt(1) + properColorHashStr.charAt(1)
                : properColorHashStr.slice(1, 3);
        const greenCode =
            properColorHashStr.length === 5
                ? properColorHashStr.charAt(2) + properColorHashStr.charAt(2)
                : properColorHashStr.slice(3, 5);
        const blueCode =
            properColorHashStr.length === 5
                ? properColorHashStr.charAt(3) + properColorHashStr.charAt(3)
                : properColorHashStr.slice(5, 7);
        const alphaCode =
            properColorHashStr.length === 5
                ? properColorHashStr.charAt(4) + properColorHashStr.charAt(4)
                : properColorHashStr.slice(7, 9);
        const divisor = normalized ? 255 : 1;
        return [
            Number.parseInt(redCode, 16) / divisor,
            Number.parseInt(greenCode, 16) / divisor,
            Number.parseInt(blueCode, 16) / divisor,
            Number.parseInt(alphaCode, 16) / divisor,
        ];
    }
    if (RGB_COLOR_REGEX.test(colorHashStr)) {
        const rgb = makeRGBColorVector(colorHashStr);
        return [rgb[0], rgb[1], rgb[2], normalized ? 1.0 : 255.0];
    }
    logger.warn('invalid color hash string; returning transparent black color vector (0, 0, 0, 0)');
    return [0, 0, 0, 0];
}
