import type { QueueOptions } from '@alleninstitute/vis-core';
import type {
    box2D,
    CartesianPlane,
    Interval,
    OrthogonalCartesianAxes,
    vec2,
    vec3,
} from '@alleninstitute/vis-geometry';
import type { OmeZarrDataContext } from '../zarr/omezarr-fileset';

// represent a 2D slice of a volume
export type PlanarVoxelTile = {
    plane: OrthogonalCartesianAxes; // the plane in which the tile sits
    realBounds: box2D; // in the space given by the axis descriptions of the omezarr dataset
    bounds: box2D; // in voxels, in the plane
    orthoVal: number; // the value along the orthogonal axis to the plane (e.g. the slice index along Z relative to an XY plane)
    dataContext: OmeZarrDataContext; // the index in the resolution pyramid of the omezarr dataset
};

// a slice of a volume (as voxels suitable for display)
export type PlanarVoxelTileImage = {
    data: Float32Array;
    shape: readonly number[];
};

export type PlanarRendererOptions = {
    numChannels?: number;
    queueOptions?: QueueOptions;
};

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
