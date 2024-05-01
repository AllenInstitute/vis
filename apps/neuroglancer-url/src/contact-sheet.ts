import { neuroglancerUrl, finalizeConfig, getImageLayer, getShaderCode, urlFromConfig } from './utils';

export function getContactSheetUrl(
    srcUrl: string,
    imgName: string,
    omeZarrShape: number[],
    xMm: number,
    yMm: number,
    zMm: number,
    redMin: number,
    redMax: number,
    greenMin: number,
    greenMax: number,
    blueMin: number,
    blueMax: number,
    crossSectionScale: number = 0.5
): string {
    const config = getContactSheetConfig(
        srcUrl,
        imgName,
        omeZarrShape,
        xMm,
        yMm,
        zMm,
        redMin,
        redMax,
        greenMin,
        greenMax,
        blueMin,
        blueMax,
        crossSectionScale
    );

    return urlFromConfig(neuroglancerUrl, config);
}

function getContactSheetConfig(
    srcUrl: string,
    imgName: string,
    omeZarrShape: number[],
    xMm: number,
    yMm: number,
    zMm: number,
    redMin: number,
    redMax: number,
    greenMin: number,
    greenMax: number,
    blueMin: number,
    blueMax: number,
    crossSectionScale: number = 0.5
): Record<string, any> {
    const [shaderCode, shaderControls] = getShaderCode(redMin, redMax, greenMin, greenMax, blueMin, blueMax);

    const source = createSourceGrid(srcUrl, omeZarrShape, xMm, yMm, zMm);

    const imgLayer = getImageLayer(imgName, source, shaderCode, shaderControls);

    const config = finalizeConfig(imgLayer, imgName, xMm, yMm, zMm);

    config['layout'] = 'xy';
    config['velocity'] = { z: { velocity: -10, atBoundary: 'reverse' } };

    const nz = omeZarrShape[-3];
    const sqrtNz = Math.round(Math.sqrt(nz));
    const ny = omeZarrShape[-2];
    const nx = omeZarrShape[-1];
    config['position'] = [(nx * sqrtNz) / 2, (ny * sqrtNz) / 2, -(nz - 1)];
    config['crossSectionScale'] = crossSectionScale;

    return config;
}

function createSourceGrid(srcUrl: string, omeZarrShape: number[], xMm: number, yMm: number, zMm: number): any[] {
    const nz = omeZarrShape[omeZarrShape.length - 3];
    const ny = omeZarrShape[omeZarrShape.length - 2];
    const nx = omeZarrShape[omeZarrShape.length - 1];
    const sqrtNz = Math.ceil(Math.sqrt(nz));
    const izToDxDy: { [key: number]: [number, number] } = {};
    let dx = 0;
    let dy = 0;
    for (let iz = 0; iz < nz; iz++) {
        izToDxDy[iz] = [dx, dy];
        dx++;
        if (dx >= sqrtNz) {
            dy++;
            dx = 0;
        }
    }

    const dimensions = {
        'c^': [1, ''],
        z: [0.001 * zMm, 'm'],
        y: [0.001 * yMm, 'm'],
        x: [0.001 * xMm, 'm'],
    };

    const srcList = [];
    for (let iz = 0; iz < nz; iz++) {
        const src = { url: srcUrl };
        const [dx, dy] = izToDxDy[iz];
        const matrix = [
            [1, 0, 0, 0, 0],
            [0, -1, 0, 0, -1 * iz],
            [0, 0, 1, 0, dy * ny],
            [0, 0, 0, 1, dx * nx],
        ];
        // @ts-expect-error
        src['transform'] = {
            outputDimensions: dimensions,
            matrix: matrix,
        };

        // @ts-expect-error
        src['subsources'] = {
            default: true,
        };
        // @ts-expect-error
        src['enableDefaultSubsources'] = false;

        srcList.push(src);
    }

    return srcList;
}
