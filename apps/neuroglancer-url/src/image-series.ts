import { urlFromConfig, getShaderCode, getSourceConfig, getImageLayer, neuroglancerUrl } from './utils';

export function getImageSeriesGridUrl(srcConfigList: any[]): string {
    const config = getImgGridConfig(srcConfigList);
    const url = urlFromConfig(neuroglancerUrl, config);
    return url;
}

function getImgGridConfig(srcConfigList: any[]): any {
    const xMm = srcConfigList[0]['x_mm'];
    const yMm = srcConfigList[0]['y_mm'];
    const zMm = srcConfigList[0]['z_mm'];

    const imgLayerList = srcConfigList.map((config) => getSingleImgLayer(config));

    const nLayers = srcConfigList.length;
    const nSide = Math.ceil(Math.sqrt(nLayers));

    if (imgLayerList.length < nSide ** 2) {
        imgLayerList.push(getBlankImgLayer(srcConfigList[0]));
    }

    const dimensions = {
        x: [0.001 * xMm, 'm'],
        y: [0.001 * yMm, 'm'],
        z: [0.001 * zMm, 'm'],
    };

    const config: any = {};
    config['dimensions'] = dimensions;
    config['crossSectionScale'] = 50.0;
    config['projectionScale'] = 40000;
    config['selectedLayer'] = {
        visible: true,
        layer: imgLayerList[0]['name'],
    };
    config['layers'] = imgLayerList;

    const layout: any = {};
    layout['type'] = 'row';

    const rowChildren: any[] = [];
    let thisRow: any = {};
    for (const img of imgLayerList) {
        if (!('type' in thisRow)) {
            thisRow['type'] = 'column';
            thisRow['children'] = [];
        }
        const thisCol = {
            type: 'viewer',
            layers: [img['name']],
            layout: 'xy',
        };
        thisRow['children'].push(thisCol);
        if (thisRow['children'].length >= nSide) {
            rowChildren.push(thisRow);
            thisRow = {};
        }
    }

    if (Object.keys(thisRow).length > 0) {
        while (thisRow['children'].length < nSide) {
            const dummy = {
                type: 'viewer',
                layers: ['blank'],
                layout: 'xy',
            };
            thisRow['children'].push(dummy);
        }
        rowChildren.push(thisRow);
    }

    layout['children'] = rowChildren;

    config['layout'] = layout;

    return config;
}

function getSingleImgLayer(srcConfig: any): any {
    const [shaderCode, shaderControls] = getShaderCode(
        srcConfig['red_min'],
        srcConfig['red_max'],
        srcConfig['green_min'],
        srcConfig['green_max'],
        srcConfig['blue_min'],
        srcConfig['blue_max']
    );

    const source = getSourceConfig(srcConfig['src_url'], srcConfig['x_mm'], srcConfig['y_mm'], srcConfig['z_mm']);

    const imgLayer = getImageLayer(srcConfig['img_name'], source, shaderCode, shaderControls);

    return imgLayer;
}

function getBlankImgLayer(srcConfig: any): any {
    const shaderCode = 'void main(){ emitRGB(vec3(0,0,0)); }';

    const source = getSourceConfig(srcConfig['src_url'], srcConfig['x_mm'], srcConfig['y_mm'], srcConfig['z_mm']);

    const imgLayer = getImageLayer('blank', source, shaderCode, {});

    return imgLayer;
}
