/* 
    The code here and the code that utilizes this is partially adapted from
    https://github.com/AllenInstitute/ome_zarr_converter/blob/main/src/ome_zarr_converter/neuroglancer/utils.py
*/
export function finalizeConfig(
    imgLayer: Record<string, any>,
    imgName: string,
    xMm: number,
    yMm: number,
    zMm: number,
    crossSectionScale: number = 50.0,
    layout: string = '4panel'
): Record<string, any> {
    const dimensions = {
        x: [0.001 * xMm, 'm'],
        y: [0.001 * yMm, 'm'],
        z: [0.001 * zMm, 'm'],
    };

    const config: Record<string, any> = {};
    config.dimensions = dimensions;
    config.crossSectionScale = crossSectionScale;
    config.projectionScale = 40000; // affects initial zoom of 3D view; larger is more zoomed out
    config.selectedLayer = { visible: true, layer: imgName };
    config.layout = layout;
    config.layers = [imgLayer];

    return config;
}

export const neuroglancerUrl = 'https://neuroglancer-demo.appspot.com/';

export function getSourceConfig(srcUrl: string, xMm: number, yMm: number, zMm: number): Record<string, any> {
    const source: Record<string, any> = {};
    source.url = srcUrl;
    source.transform = {
        outputDimensions: {
            'c^': [1, ''],
            z: [0.001 * zMm, 'm'],
            y: [0.001 * yMm, 'm'],
            x: [0.001 * xMm, 'm'],
        },
    };
    return source;
}

export function getImageLayer(
    layerName: string,
    source: any,
    shaderCode: string,
    shaderControls: any
): Record<string, any> {
    const layer: Record<string, any> = {};
    layer.type = 'image';
    layer.tab = 'rendering';
    layer.shader = shaderCode;
    layer.shaderControls = shaderControls;
    layer.source = source;
    layer.channelDimensions = { 'c^': [1, ''] };
    layer.name = layerName;
    layer.opacity = 1;
    return layer;
}

type NeuroglancerControls = {
    red_min: number;
    red_max: number;
    green_min: number;
    green_max: number;
    blue_min: number;
    blue_max: number;
};

export function getShaderCode(
    redMin: number,
    redMax: number,
    greenMin: number,
    greenMax: number,
    blueMin: number,
    blueMax: number
): [string, NeuroglancerControls] {
    const redMinStr = parseFloat(redMin.toString());
    const redMaxStr = parseFloat(redMax.toString());
    const greenMinStr = parseFloat(greenMin.toString());
    const greenMaxStr = parseFloat(greenMax.toString());
    const blueMinStr = parseFloat(blueMin.toString());
    const blueMaxStr = parseFloat(blueMax.toString());

    let code = '';
    code += `
    #uicontrol invlerp red_scale(range=[${redMinStr},${2 * redMaxStr}], channel=0)`;

    code += `
    #uicontrol invlerp green_scale(range=[${greenMinStr}, ${2 * greenMaxStr}], channel=1)`;

    code += `
    #uicontrol invlerp blue_scale(range=[${blueMinStr}, ${2 * blueMaxStr}], channel=2)`;

    code += `
    #uicontrol bool red_visible checkbox(default=true);
    #uicontrol bool green_visible checkbox(default=true);
    #uicontrol bool blue_visible checkbox(default=true);
    `;

    code += `
    void main() {
        float r;
        float r_scale=red_scale();
        if(!red_visible || (r_scale<=0.0) ){
            r=0.0;
         }
         else{
              r=r_scale;
         }
         if(r>1.0)r=1.0;

         float g;
         float g_scale=green_scale();
         if(!green_visible || (g_scale<=0.0)){
             g=0.0;
         }
         else{
              g=g_scale;
         }
         if(g>1.0)g=1.0;

         float b;
         float b_scale=blue_scale();
         if(!blue_visible || (b_scale<=0.0)){
             b=0.0;
         }
         else{
             b=b_scale;
         }
         if(b>1.0)b=1.0;

         emitRGB(vec3(r,g,b));
     }
     `;

    const controls: NeuroglancerControls = {
        red_min: redMin,
        red_max: redMax,
        green_min: greenMin,
        green_max: greenMax,
        blue_min: blueMin,
        blue_max: blueMax,
    };

    return [code, controls];
}

export function getNeuroglancerConfig(
    srcUrl: string,
    imgName: string,
    xMm: number,
    yMm: number,
    zMm: number,
    redMin: number,
    redMax: number,
    greenMin: number,
    greenMax: number,
    blueMin: number,
    blueMax: number,
    crossSectionScale: number = 50.0,
    layout: string = '4panel'
): Record<string, any> {
    const [shaderCode, shaderControls] = getShaderCode(redMin, redMax, greenMin, greenMax, blueMin, blueMax);

    const source = getSourceConfig(srcUrl, xMm, yMm, zMm);

    const imgLayer = getImageLayer(imgName, source, shaderCode, shaderControls);

    return finalizeConfig(imgLayer, imgName, xMm, yMm, zMm, crossSectionScale, layout);
}

export function urlFromConfig(url: string, config: Record<string, any>): string {
    return encodeURI(`${url}#!${JSON.stringify(config)}`);
}

export function getNeuroglancerUrl(
    srcUrl: string,
    imgName: string,
    xMm: number,
    yMm: number,
    zMm: number,
    redMin: number,
    redMax: number,
    greenMin: number,
    greenMax: number,
    blueMin: number,
    blueMax: number,
    crossSectionScale: number = 50.0,
    layout: string = '4panel'
): string {
    const config = getNeuroglancerConfig(
        srcUrl,
        imgName,
        xMm,
        yMm,
        zMm,
        redMin,
        redMax,
        greenMin,
        greenMax,
        blueMin,
        blueMax,
        crossSectionScale,
        layout
    );

    return urlFromConfig(neuroglancerUrl, config);
}