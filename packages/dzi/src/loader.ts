import {
	type vec2,
	type box2D,
	Box2D,
	type Interval,
	Vec2,
} from "@alleninstitute/vis-geometry";

type DziTilesRoot = `${string}_files/`;
// see https://learn.microsoft.com/en-us/previous-versions/windows/silverlight/dotnet-windows-silverlight/cc645077(v=vs.95)?redirectedfrom=MSDN
// TODO find a less ancient spec...
export type DziImage = {
	imagesUrl: DziTilesRoot; // lets say you found a dzi at http://blah.com/deepzoom.dzi
	// imagesUrl would be the path which contains all the files for the actual image tiles:
	// in this example:
	// http://blah.com/deepzoom_files/
	format: "jpeg" | "png" | "jpg" | "JPG" | "PNG";
	overlap: number; // in pixels, ADDED every side of any given tile (for example, with overlap=1 and tilesize=256, you could see a jpeg of size 258x258).
	// note that tiles on the edge wont have padding (on a per edge basis!)
	tileSize: number;
	size: {
		width: number;
		height: number;
	};
};
type TileIndex = {
	row: number;
	col: number;
};
export type DziTile = {
	url: string;
	index: TileIndex;
	relativeLocation: box2D;
	layer: number;
};
function tileUrl(dzi: DziImage, level: number, tile: TileIndex): string {
	return `${dzi.imagesUrl}${level.toFixed(0)}/${tile.col.toFixed(0)}_${tile.row.toFixed(0)}.${dzi.format}`;
}
// some quick notes on this deep zoom image format:
// 1. image / tile names are given by {column}_{row}.{format}
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
export function getVisibleTiles(
	dzi: DziImage,
	camera: { view: box2D; screenSize: vec2 },
): DziTile[] {
	const viewWidth = Box2D.size(camera.view)[0];
	const layer = firstSuitableLayer(
		dzi.size.width,
		camera.screenSize[0] / viewWidth,
	);
	const layerResolution = imageSizeAtLayer(dzi, layer);

	const availableTiles = tilesInLayer(dzi, layer);
	const baseLayer = findLargestSingleTileLayer(dzi);
	const baseIndex: TileIndex = { col: 0, row: 0 };
	const baseTile: DziTile = {
		index: baseIndex,
		layer: baseLayer,
		relativeLocation: Box2D.create([0, 0], [1, 1]),
		url: tileUrl(dzi, baseLayer, baseIndex),
	};

	// note that the tile boxes are in pixels relative to the layer in which they reside
	// the given view is assumed to be a parameter (in the space [0:1]) of the image as a whole
	// so, we must convert literal pixel boxes into their relative position in the image as a whole:
	const tileBoxAsParameter = (tile: box2D) =>
		Box2D.create(
			Vec2.div(tile.minCorner, layerResolution),
			Vec2.div(tile.maxCorner, layerResolution),
		);

	const tiles: DziTile[] = availableTiles
		.flatMap((row, rowIndex) => {
			return row.map((tile, colIndex) => {
				const index = { col: colIndex, row: rowIndex };
				return {
					index,
					layer,
					relativeLocation: tileBoxAsParameter(tile),
					url: tileUrl(dzi, layer, index),
				};
			});
			// filter out tiles which are not in view
		})
		.filter((t) => !!Box2D.intersection(t.relativeLocation, camera.view));
	return baseLayer < layer ? [baseTile, ...tiles] : tiles;
}
/**
 * NOTE: THE REMAINDER OF THIS FILE IS EXPORTED ONLY FOR TESTING PURPOSES
 * **/

// starting with the width of an image, and the width of the screen on which to display that image
// return the highest-numbered (aka highest resolution) dzi-layer folder which has a size that would be lower than the screen resolution
export function firstSuitableLayer(imageWidth: number, screenWidth: number) {
	const idealLayer = Math.ceil(Math.log2(screenWidth));
	const biggestRealLayer = Math.ceil(Math.log2(imageWidth));
	return Math.max(0, Math.min(biggestRealLayer, idealLayer));
}

/**
 *
 * @param dzi
 * @returns the index of the largest layer which contains only a single tile
 *
 */
function findLargestSingleTileLayer(dzi: DziImage): number {
	return Math.floor(Math.log2(dzi.tileSize));
}
export function tileWithOverlap(
	total: number,
	step: number,
	overlap: number,
): Interval[] {
	const blocks: Interval[] = [];
	let start = 0;
	while (start < total) {
		const next = Math.min(
			total,
			start + step + overlap + (start > 0 ? overlap : 0),
		);
		blocks.push({ min: start, max: next });
		if (next >= total) {
			return blocks;
		}
		start = next - 2 * overlap;
	}
	return blocks;
}
function boxFromRowCol(row: Interval, col: Interval) {
	return Box2D.create([col.min, row.min], [col.max, row.max]);
}

const logBaseHalf = (x: number) => Math.log2(x) / Math.log2(0.5);

export function imageSizeAtLayer(dzi: DziImage, layer: number) {
	const { size: dim } = dzi;
	const layerMaxSize = 2 ** (isFinite(layer) ? Math.max(0, layer) : 0);
	const size: vec2 = [dim.width, dim.height];
	// the question is how many times do we need to divide size
	// by 2 to make it less than layerMaxSize?
	// solve for N, X = the larger the image dimensions:
	// X * (0.5^N) <= maxLayerSize ...
	// 0.5^N = maxLayerSize/X ...
	// log_0.5(maxLayerSize/X) = N
	const bigger = Math.max(size[0], size[1]);
	const N = Math.ceil(logBaseHalf(layerMaxSize / bigger));
	return Vec2.ceil(Vec2.scale(size, 0.5 ** N));
}
export function tilesInLayer(dzi: DziImage, layer: number): box2D[][] {
	const { overlap, tileSize } = dzi;
	// figure out the effective size of a layer by dividing the total size by 2 until its less than our layerMax
	// note: if this all feels weird, its because I can find no reference implementation or specification, its a bit of reverse engineering
	const total: vec2 = imageSizeAtLayer(dzi, layer);
	const rows = tileWithOverlap(Math.ceil(total[1]), tileSize, overlap);
	const cols = tileWithOverlap(Math.ceil(total[0]), tileSize, overlap);
	return rows.map((r) => cols.map((c) => boxFromRowCol(r, c)));
}
