import type { box2D, OrthogonalCartesianAxes } from "@alleninstitute/vis-geometry";
import type { OmeZarrDataContext } from "../zarr/omezarr-fileset";

// represent a 2D slice of a volume
export type VoxelTile = {
    plane: OrthogonalCartesianAxes; // the plane in which the tile sits
    realBounds: box2D; // in the space given by the axis descriptions of the omezarr dataset
    bounds: box2D; // in voxels, in the plane
    orthoVal: number; // the value along the orthogonal axis to the plane (e.g. the slice index along Z relative to an XY plane)
    dataContext: OmeZarrDataContext; // the index in the resolution pyramid of the omezarr dataset
};

// a slice of a volume (as voxels suitable for display)
export type VoxelTileImage = {
    data: Float32Array;
    shape: number[];
};
