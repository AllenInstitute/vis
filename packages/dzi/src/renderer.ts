import { Box2D, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import {
	type Renderer,
	type ReglCacheEntry,
	type CachedTexture,
	buildAsyncRenderer,
} from "@alleninstitute/vis-scatterbrain";
import type REGL from "regl";
import { type DziImage, type DziTile, getVisibleTiles } from "./loader";
import { buildTileRenderer } from "./tile-renderer";

export type RenderSettings = {
	camera: {
		/**
		 * a region of a dzi image, expressed as a relative parameter (eg. [0,0],[1,1] means the whole image)
		 */
		view: box2D;
		/**
		 * the resolution of the output screen on which to project the region of source pixels given by view
		 */
		screenSize: vec2;
	};
};

type GpuProps = {
	pixels: CachedTexture;
};
/**
 *
 * @param regl a valid REGL context (https://github.com/regl-project/regl)
 * @returns an object which can fetch tiles from a DeepZoomImage, determine the visibility of those tiles given a simple camera, and render said tiles
 * using regl (which uses webGL)
 */
export function buildDziRenderer(
	regl: REGL.Regl,
): Renderer<DziImage, DziTile, RenderSettings, GpuProps> {
	const renderCmd = buildTileRenderer(regl, { enable: false });
	const fetchDziTile = (
		tile: DziTile,
		_img: DziImage,
		_settings: RenderSettings,
		_abort?: AbortSignal,
	): Record<string, () => Promise<ReglCacheEntry>> => {
		return {
			pixels: () => {
				return new Promise<ReglCacheEntry>((resolve, reject) => {
					try {
						const img = new Image();
						img.crossOrigin = "anonymous";
						img.onload = (ev) => {
							resolve({
								type: "texture",
								texture: regl.texture(img),
								bytes: img.width * img.height * 4,
							}); // close enough
						};
						img.src = tile.url;
					} catch (err) {
						reject(err);
					}
				});
			},
		};
	};
	return {
		destroy: () => {}, // no private resources to destroy
		cacheKey: (item, _requestKey, _data, _settings) => `${item.url}`,
		fetchItemContent: fetchDziTile,
		getVisibleItems: (dzi, settings) => {
			return getVisibleTiles(dzi, settings.camera);
		},
		isPrepared: (cacheData): cacheData is GpuProps => {
			const pixels = cacheData["pixels"];
			return !!pixels && pixels.type === "texture";
		},
		renderItem: (target, tile, _dzi, settings, gpuData) => {
			const { pixels } = gpuData;
			const { camera } = settings;
			renderCmd({
				target,
				depth: -tile.layer / 1000,
				img: pixels.texture,
				tile: Box2D.toFlatArray(tile.relativeLocation),
				view: Box2D.toFlatArray(camera.view),
			});
		},
	};
}
/**
 *
 * @param regl  a valid REGL context (https://github.com/regl-project/regl)
 * @returns a function which creates a "Frame" of actions. each action represents loading
 * and subsequently rendering a tile of the image as requested via its configuration -
 * @see RenderSettings
 */
export function buildAsyncDziRenderer(regl: REGL.Regl) {
	return buildAsyncRenderer(buildDziRenderer(regl));
}
