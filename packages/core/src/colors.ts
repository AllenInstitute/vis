import { type vec3 } from '@alleninstitute/vis-geometry';

const RGB_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function makeRGBColorVector(colorHashStr: string): vec3 {
    if (!colorHashStr || !RGB_COLOR_REGEX.test(colorHashStr)) {
        /* eslint-disable-next-line no-console */
        console.warn('invalid color hash string; returning black color vector (0, 0, 0)');
        return [0, 0, 0];
    }
    const redCode =
        colorHashStr.length === 4 ? colorHashStr.charAt(1) + colorHashStr.charAt(1) : colorHashStr.slice(1, 3);
    const greenCode =
        colorHashStr.length === 4 ? colorHashStr.charAt(2) + colorHashStr.charAt(2) : colorHashStr.slice(3, 5);
    const blueCode =
        colorHashStr.length === 4 ? colorHashStr.charAt(3) + colorHashStr.charAt(3) : colorHashStr.slice(5, 7);
    return [
        Number.parseInt(redCode, 16) / 255,
        Number.parseInt(greenCode, 16) / 255,
        Number.parseInt(blueCode, 16) / 255,
    ];
}
