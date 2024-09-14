
import { type vec2, type box2D, Box2D, type Interval, Vec2 } from '@alleninstitute/vis-geometry'
// todo rename me...

// see https://learn.microsoft.com/en-us/previous-versions/windows/silverlight/dotnet-windows-silverlight/cc645077(v=vs.95)?redirectedfrom=MSDN
// TODO find a less ancient spec...
export type DziImage = {
    imagesUrl: string; // lets say you found a dzi at http://blah.com/deepzoom.dzi
    // imagesUrl would be the path which contains all the files:
    // in this example:
    // http://blah.com/deepzoom_files/
    format: 'jpeg' | 'png',
    overlap: number, // in pixels, ADDED every side of any given tile (for example, with overlap=1 and tilesize=256, you could see a jpeg of size 258x258). 
    // note that tiles on the edge wont have padding (on a per edge basis!)
    tileSize: number,
    size: {
        width: number,
        height: number
    }
}
type TileIndex = {
    row: number;
    col: number;
}
export type DziTile = {
    url: string;
    index: TileIndex;
    relativeLocation: box2D;
    layer: number;
}
function tileUrl(dzi: DziImage, level: number, tile: TileIndex): string {
    return `${dzi.imagesUrl}${level.toFixed(0)}/${tile.row.toFixed(0)}_${tile.col.toFixed(0)}.${dzi.format}`
}
// some quick notes on this deepzoom image format:
// 1. image / tile names are given by {row}_{column}.{format}
// 2. a layer (which may contain multiple tiles) is a folder
// 2.1 that folder contains all the tiles for that layer.
//     layer 0 should contain a single image, 0_0, which is a single pixel!
//     the origin of this tile indexing system is the top left of the image.
//     the spec says that the "size" of a layer is 2*layer... but its closer to pow(2, layer).
//     note also that is more of a maximum size... for example I've seen 9/0_0.jpeg have a size of 421x363, both of those are lower than pow(2,9)=512
//     note also that overlap is ADDED to the tile-size, which is a weird choice, as tileSize seems like it must be a power of 2...🤷‍♀️

/**
 * 
 * @param dzi the dzi image to read tiles from
 * @param camera.view a parametric box [0:1] relative the the image as a whole. note that 0 is the TOP of the image.
 * @param camera.screenSize the size, in output pixels, at which the requested region will be displayed.
 * @return a list of tiles at the most appropriate resolution which may be fetched and displayed
 */
export function getVisibleTiles(dzi: DziImage, camera: { view: box2D, screenSize: vec2 }): DziTile[] {
    // TODO implement me

    return [{ url: tileUrl(dzi, 8, { row: 0, col: 0 }), index: { row: 0, col: 0 }, layer: 8, relativeLocation: Box2D.create([0, 0], [1, 1]) }]
}

export function tileWithOverlap(total: number, step: number, overlap: number): Interval[] {
    const blocks: Interval[] = []
    let start = 0;
    while (start < total) {
        const next = Math.min(total, start + step + overlap + (start > 0 ? overlap : 0));
        blocks.push({ min: start, max: next })
        if (next >= total) {
            return blocks;
        }
        start = next - (2 * overlap);
    }
    return blocks;
}
function boxFromRowCol(row: Interval, col: Interval) {
    return Box2D.create([col.min, row.min], [col.max, row.max])
}
export function imageSizeAtLayer(dzi: DziImage, layer: number) {
    const { overlap, size, tileSize } = dzi;
    const layerMaxSize = 2 ** layer;
    let total: vec2 = [size.width, size.height];
    while (total[0] > layerMaxSize || total[1] > layerMaxSize) {
        total = Vec2.ceil(Vec2.scale(total, 1 / 2));
    }
    return total;
}
export function tilesInLayer(dzi: DziImage, layer: number): box2D[] {
    const { overlap, size, tileSize } = dzi;
    const layerMaxSize = 2 ** layer;
    // figure out the effective size of a layer by dividing the total size by 2 until its less than our layerMax
    // note: if this all feels weird, its because I can find no reference implementation or specification, its a bit of reverse engineering
    const total: vec2 = imageSizeAtLayer(dzi, layer)
    const rows = tileWithOverlap(Math.ceil(total[1]), tileSize, overlap);
    const cols = tileWithOverlap(Math.ceil(total[0]), tileSize, overlap);
    return rows.flatMap(r => cols.map(c => boxFromRowCol(r, c)))
}