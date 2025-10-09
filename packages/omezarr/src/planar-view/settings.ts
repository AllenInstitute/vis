import type { box2D, CartesianPlane, Interval, vec2, vec3 } from '@alleninstitute/vis-geometry';

export type PlanarRenderSettingsChannel = {
    index: number;
    gamut: Interval;
    rgb: vec3;
};

export type PlanarRenderSettingsChannels = {
    [key: string]: PlanarRenderSettingsChannel;
};

export type PlanarRenderSettings = {
    camera: {
        view: box2D;
        screenSize: vec2;
    };
    planeLocation: number;
    tileSize: number;
    plane: CartesianPlane;
    channels: PlanarRenderSettingsChannels;
};
