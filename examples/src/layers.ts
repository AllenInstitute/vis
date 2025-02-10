import {
	Box2D,
	Vec2,
	type box2D,
	type vec2,
} from "@alleninstitute/vis-geometry";
import REGL from "regl";
import {
	AsyncDataCache,
	ReglLayer2D,
	type FrameLifecycle,
	type NormalStatus,
} from "@alleninstitute/vis-scatterbrain";
import {
	renderDynamicGrid,
	renderSlide,
	type RenderSettings as SlideRenderSettings,
} from "./data-renderers/dynamicGridSlideRenderer";
import {
	renderGrid,
	renderSlice,
	type RenderSettings as SliceRenderSettings,
} from "./data-renderers/volumeSliceRenderer";
import {
	renderAnnotationLayer,
	type RenderSettings as AnnotationRenderSettings,
	type SimpleAnnotation,
} from "./data-renderers/simpleAnnotationRenderer";
import { buildPathRenderer } from "./data-renderers/lineRenderer";
import type { ColorMapping, RenderCallback } from "./data-renderers/types";
import {
	createZarrSlice,
	type AxisAlignedZarrSlice,
	type ZarrSliceConfig,
} from "./data-sources/ome-zarr/planar-slice";
import {
	createGridDataset,
	createSlideDataset,
	type DynamicGrid,
	type DynamicGridSlide,
	type ScatterPlotGridSlideConfig,
	type ScatterplotGridConfig,
} from "./data-sources/scatterplot/dynamic-grid";
import type { OptionalTransform } from "./data-sources/types";
import type { CacheEntry, AnnotationLayer, Layer } from "./types";
import { AppUi } from "./layers/layers";
import { createRoot } from "react-dom/client";
import {
	createZarrSliceGrid,
	type AxisAlignedZarrSliceGrid,
	type ZarrSliceGridConfig,
} from "./data-sources/ome-zarr/slice-grid";
import {
	renderAnnotationGrid,
	type LoopRenderer,
	type MeshRenderer,
	type RenderSettings as AnnotationGridRenderSettings,
} from "./data-renderers/annotation-renderer";
import {
	buildLoopRenderer,
	buildMeshRenderer,
} from "./data-renderers/mesh-renderer";
import { saveAs } from "file-saver";
import type {
	AnnotationGrid,
	AnnotationGridConfig,
} from "./data-sources/annotation/annotation-grid";
import { buildRenderer } from "./data-renderers/scatterplot";
import { sizeInUnits } from "@alleninstitute/vis-omezarr";
import type { ColumnRequest } from "./common/loaders/scatterplot/scatterbrain-loader";
import {
	buildVersaRenderer,
	type AxisAlignedPlane,
} from "./data-renderers/versa-renderer";
import { buildImageRenderer } from "./common/image-renderer";
import type { Camera } from "./common/camera";
const KB = 1000;
const MB = 1000 * KB;

declare global {
	interface Window {
		examples: Record<string, any>;
		demo: Demo;
	}
}

function destroyer(item: CacheEntry) {
	switch (item.type) {
		case "texture2D":
		case "vbo":
			item.data.destroy();
			break;
		case "mesh":
			item.data.points.destroy();
			break;
		default:
			// @ts-expect-error
			console.error(item.data, "implement a destroyer for this case!");
			break;
	}
}
function sizeOf(item: CacheEntry) {
	return 1;
}
function appendPoint(layer: AnnotationLayer, p: vec2) {
	const path = layer.data.paths[layer.data.paths.length - 1];
	if (path) {
		path.points.push(p);
		path.bounds = Box2D.union(path.bounds, Box2D.create(p, p));
	}
}
function startStroke(layer: AnnotationLayer, p: vec2) {
	layer.data.paths.push({
		bounds: Box2D.create(p, p),
		color: [1, 0, 0, 1],
		id: Math.random(),
		points: [p],
	});
}
export class Demo {
	camera: Camera;
	layers: Layer[];
	regl: REGL.Regl;
	selectedLayer: number;
	canvas: HTMLCanvasElement;
	mouse: "up" | "down";
	mode: "draw" | "pan";
	mousePos: vec2;
	cache: AsyncDataCache<string, string, CacheEntry>;
	imgRenderer: ReturnType<typeof buildImageRenderer>;
	plotRenderer: ReturnType<typeof buildRenderer>;
	sliceRenderer: ReturnType<typeof buildVersaRenderer>;
	pathRenderer: ReturnType<typeof buildPathRenderer>;
	loopRenderer: LoopRenderer;
	meshRenderer: MeshRenderer;
	stencilMeshRenderer: MeshRenderer;
	private refreshRequested: number = 0;
	private redrawRequested: number = 0;
	constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
		this.canvas = canvas;
		this.mouse = "up";
		this.regl = regl;
		this.mousePos = [0, 0];
		this.layers = [];
		this.mode = "pan";
		this.selectedLayer = 0;
		this.pathRenderer = buildPathRenderer(regl);
		this.plotRenderer = buildRenderer(regl);
		this.imgRenderer = buildImageRenderer(regl);
		this.sliceRenderer = buildVersaRenderer(regl);
		this.meshRenderer = buildMeshRenderer(regl, "use-stencil");
		this.stencilMeshRenderer = buildMeshRenderer(regl, "draw-stencil");
		this.loopRenderer = buildLoopRenderer(regl);

		this.refreshRequested = 0;
		this.redrawRequested = 0;
		const [w, h] = [canvas.clientWidth, canvas.clientHeight];
		this.camera = {
			view: Box2D.create([0, 0], [(10 * w) / h, 10]),
			screen: [w, h],
			projection: "webImage",
		};
		this.initHandlers(canvas);
		// each entry in the cache is about 250 kb - so 4000 means we get 1GB of data
		this.cache = new AsyncDataCache<string, string, CacheEntry>(
			destroyer,
			sizeOf,
			4000,
		);
	}
	pickLayer(i: number) {
		if (i >= 0 && i < this.layers.length) {
			this.selectedLayer = i;
			if (this.layers[i].type !== "annotationLayer") {
				this.mode = "pan";
			}
		}
	}
	uiChange() {
		this.onCameraChanged();
	}
	setOpacity(what: "fill" | "stroke", value: number) {
		const layer = this.layers[this.selectedLayer];
		if (layer && layer.type === "annotationGrid") {
			layer.data[what].opacity = value;
			this.uiChange();
		}
	}
	setGamutChannel(channel: keyof ColorMapping, value: number[]) {
		const layer = this.layers[this.selectedLayer];
		if (
			layer &&
			(layer.type === "volumeSlice" || layer.type === "volumeGrid")
		) {
			layer.data.gamut[channel].gamut.min = value[0];
			layer.data.gamut[channel].gamut.max = value[1];
			this.uiChange();
		}
	}
	setSlice(param: number) {
		const layer = this.layers[this.selectedLayer];
		if (layer && layer.type === "volumeSlice") {
			layer.data = { ...layer.data, planeParameter: param };
			this.uiChange();
		}
	}
	setPlane(param: AxisAlignedPlane) {
		const layer = this.layers[this.selectedLayer];
		if (
			layer &&
			(layer.type === "volumeSlice" || layer.type === "volumeGrid")
		) {
			layer.data.plane = param;
			this.uiChange();
		}
	}
	setPointSize(s: number) {
		const layer = this.layers[this.selectedLayer];
		if (
			layer &&
			(layer.type === "scatterplot" || layer.type === "scatterplotGrid")
		) {
			layer.data.pointSize = s;
			this.uiChange();
		}
	}
	setColorByIndex(s: number) {
		const layer = this.layers[this.selectedLayer];
		if (
			layer &&
			(layer.type === "scatterplot" || layer.type === "scatterplotGrid")
		) {
			layer.data.colorBy.name = `${s.toFixed(0)}`;
			this.uiChange();
		}
	}
	addDynamicGrid(config: ScatterplotGridConfig) {
		return createGridDataset(config).then((data) => {
			if (data) {
				const [w, h] = this.camera.screen;
				const layer = new ReglLayer2D<
					DynamicGrid & OptionalTransform,
					SlideRenderSettings<CacheEntry>
				>(this.regl, this.imgRenderer, renderDynamicGrid<CacheEntry>, [w, h]);
				this.layers.push({
					type: "scatterplotGrid",
					data,
					render: layer,
				});
				this.camera = { ...this.camera, view: data.dataset.bounds };
				this.uiChange();
			}
		});
	}
	selectLayer(layer: number) {
		this.selectedLayer = Math.min(this.layers.length - 1, Math.max(0, layer));
		const yay = this.layers[this.selectedLayer];
		console.log("selected:", yay.data);
		this.uiChange();
	}

	deleteSelectedLayer() {
		const removed = this.layers.splice(this.selectedLayer, 1);
		removed.forEach((l) => l.render.destroy());
		this.uiChange();
	}
	addLayer(
		config:
			| ScatterplotGridConfig
			| ZarrSliceConfig
			| ZarrSliceGridConfig
			| ScatterPlotGridSlideConfig
			| AnnotationGridConfig,
	) {
		switch (config.type) {
			case "AnnotationGridConfig":
				return this.addAnnotationGrid(config);
			case "ScatterPlotGridConfig":
				return this.addDynamicGrid(config);
			case "ScatterPlotGridSlideConfig":
				return this.addScatterplot(config);
			case "ZarrSliceGridConfig":
				return this.addVolumeGrid(config);
			case "zarrSliceConfig":
				return this.addVolumeSlice(config);
		}
	}
	addAnnotation(data: SimpleAnnotation) {
		const [w, h] = this.camera.screen;
		this.layers.push({
			type: "annotationLayer",
			data,
			render: new ReglLayer2D<SimpleAnnotation, AnnotationRenderSettings>(
				this.regl,
				this.imgRenderer,
				renderAnnotationLayer,
				[w, h],
			),
		});
		this.uiChange();
	}
	addEmptyAnnotation() {
		const [w, h] = this.camera.screen;
		this.layers.push({
			type: "annotationLayer",
			data: {
				paths: [],
			},
			render: new ReglLayer2D<SimpleAnnotation, AnnotationRenderSettings>(
				this.regl,
				this.imgRenderer,
				renderAnnotationLayer,
				[w, h],
			),
		});
		this.uiChange();
	}
	private addScatterplot(config: ScatterPlotGridSlideConfig) {
		return createSlideDataset(config).then((data) => {
			if (data) {
				const [w, h] = this.camera.screen;
				const layer = new ReglLayer2D<
					DynamicGridSlide & OptionalTransform,
					SlideRenderSettings<CacheEntry>
				>(this.regl, this.imgRenderer, renderSlide<CacheEntry>, [w, h]);
				this.layers.push({
					type: "scatterplot",
					data,
					render: layer,
				});
				this.camera = { ...this.camera, view: data.dataset.bounds };
				this.uiChange();
			}
		});
	}
	private addVolumeSlice(config: ZarrSliceConfig) {
		const [w, h] = this.camera.screen;
		return createZarrSlice(config).then((data) => {
			const layer = new ReglLayer2D<
				AxisAlignedZarrSlice & OptionalTransform,
				Omit<SliceRenderSettings<CacheEntry>, "target">
			>(this.regl, this.imgRenderer, renderSlice<CacheEntry>, [w, h]);
			this.layers.push({
				type: "volumeSlice",
				data,
				render: layer,
			});
			const s = sizeInUnits(
				data.plane,
				data.dataset.multiscales[0].axes,
				data.dataset.multiscales[0].datasets[0],
			);
			this.camera = { ...this.camera, view: Box2D.create([0, 0], s!) };
			this.uiChange();
		});
	}
	private addAnnotationGrid(config: AnnotationGridConfig) {
		return createSlideDataset({
			slideId: slide32,
			colorBy: colorByGene,
			type: "ScatterPlotGridSlideConfig",
			url: config.url,
		}).then((data) => {
			if (data) {
				const { stroke, fill, levelFeature, annotationUrl } = config;
				const [w, h] = this.camera.screen;
				const grid: AnnotationGrid = {
					dataset: data?.dataset,
					levelFeature,
					annotationBaseUrl: annotationUrl,
					stroke: { ...stroke, width: 1 },
					fill,
					type: "AnnotationGrid",
				};
				this.layers.push({
					type: "annotationGrid",
					data: grid,
					render: new ReglLayer2D<
						AnnotationGrid,
						Omit<AnnotationGridRenderSettings<CacheEntry>, "target">
					>(this.regl, this.imgRenderer, renderAnnotationGrid, [w, h]),
				});
				// look at it!
				this.camera = { ...this.camera, view: data.dataset.bounds };
				this.uiChange();
			}
		});
	}
	private addVolumeGrid(config: ZarrSliceGridConfig) {
		const [w, h] = this.camera.screen;
		return createZarrSliceGrid(config).then((data) => {
			const layer = new ReglLayer2D<
				AxisAlignedZarrSliceGrid,
				Omit<SliceRenderSettings<CacheEntry>, "target">
			>(this.regl, this.imgRenderer, renderGrid<CacheEntry>, [w, h]);
			this.layers.push({
				type: "volumeGrid",
				data: data,
				render: layer,
			});
		});
	}
	async requestSnapshot(pxWidth: number) {
		// TODO: using a canvas to build a png is very fast (the browser does it for us)
		// however, it does require that the whole image be in memory at once - if you want truely high-res snapshots,
		// we should trade out some speed and use pngjs, which lets us pass in as little as a single ROW of pixels at a time
		// this would let us go slow(er), but use WAAAY less memory (consider the cost of a 12000x8000 pixel image is (before compression)) about 300 MB...
		const w = Math.max(
			8,
			Math.min(16000, Math.abs(Number.isFinite(pxWidth) ? pxWidth : 4000)),
		);
		const { view, screen, projection } = this.camera;
		const aspect = screen[1] / screen[0];
		const h = w * aspect;
		// make it be upside down!
		const pixels = await this.takeSnapshot(
			{
				view,
				screen: [w, h],
				projection: projection === "webImage" ? "cartesian" : "webImage",
			},
			this.layers,
		);
		// create an offscreen canvas...
		const cnvs = new OffscreenCanvas(w, h);
		const imgData = new ImageData(new Uint8ClampedArray(pixels.buffer), w, h);
		const ctx = cnvs.getContext("2d");
		ctx?.putImageData(imgData, 0, 0);
		const blob = await cnvs.convertToBlob();
		saveAs(blob, "neat.png");
	}
	private takeSnapshot(camera: Camera, layers: readonly Layer[]) {
		// render each layer, in order, given a snapshot buffer
		// once done, regl.read the whole thing, turn it to a png
		return new Promise<Uint8Array>((resolve, reject) => {
			const [width, height] = camera.screen;
			const target = this.regl.framebuffer(width, height);
			this.regl.clear({ framebuffer: target, color: [0, 0, 0, 1], depth: 1 });
			const renderers = {
				volumeSlice: this.sliceRenderer,
				scatterplot: this.plotRenderer,
				annotationLayer: this.pathRenderer,
				volumeGrid: this.sliceRenderer,
				scatterplotGrid: this.plotRenderer,
				annotationGrid: {
					loopRenderer: this.loopRenderer,
					meshRenderer: this.meshRenderer,
					stencilMeshRenderer: this.stencilMeshRenderer,
				},
			};

			const layerPromises: Array<() => FrameLifecycle> = [];
			const nextLayerWhenFinished: RenderCallback = (
				e: { status: NormalStatus } | { status: "error"; error: unknown },
			) => {
				const { status } = e;
				switch (status) {
					case "cancelled":
						reject("one of the layer tasks was cancelled");
						break;
					case "progress":
						if (Math.random() > 0.7) {
							console.log("...");
						}
						break;
					case "finished":
					case "finished_synchronously":
						// start the next layer
						const next = layerPromises.shift();
						if (!next) {
							// do the final read!
							const bytes = this.regl.read({ framebuffer: target });
							resolve(bytes);
						} else {
							// do the next layer
							next();
						}
				}
			};
			const settings = {
				cache: this.cache,
				camera,
				callback: nextLayerWhenFinished,
				regl: this.regl,
			};
			for (const layer of layers) {
				switch (layer.type) {
					case "volumeGrid":
						layerPromises.push(() =>
							renderGrid<CacheEntry>(target, layer.data, {
								...settings,
								renderer: renderers[layer.type],
							}),
						);
						break;
					case "annotationGrid":
						layerPromises.push(() =>
							renderAnnotationGrid(target, layer.data, {
								...settings,
								renderers: renderers[layer.type],
							}),
						);
						break;
					case "volumeSlice":
						layerPromises.push(() =>
							renderSlice(target, layer.data, {
								...settings,
								renderer: renderers[layer.type],
							}),
						);
						break;
					case "scatterplot":
						layerPromises.push(() =>
							renderSlide(target, layer.data, {
								...settings,
								renderer: renderers[layer.type],
							}),
						);
						break;
					case "annotationLayer":
						layerPromises.push(() =>
							renderAnnotationLayer(target, layer.data, {
								...settings,
								renderer: renderers[layer.type],
							}),
						);
						break;
					case "scatterplotGrid":
						layerPromises.push(() =>
							renderDynamicGrid<CacheEntry>(target, layer.data, {
								...settings,
								renderer: renderers[layer.type],
							}),
						);
						break;
				}
			}
			// start it up!
			const first = layerPromises.shift();
			if (first) {
				first();
			}
		});
	}
	private doReRender() {
		const { cache, camera } = this;
		const drawOnProgress: RenderCallback = (
			e: { status: NormalStatus } | { status: "error"; error: unknown },
		) => {
			const { status } = e;
			switch (status) {
				case "finished":
				case "progress":
				case "finished_synchronously":
				case "begun":
					this.requestReRender();
					break;
			}
		};
		const settings = {
			cache,
			camera,
			callback: drawOnProgress,
			regl: this.regl,
		};
		const renderers = {
			volumeSlice: this.sliceRenderer,
			scatterplot: this.plotRenderer,
			annotationLayer: this.pathRenderer,
			volumeGrid: this.sliceRenderer,
			scatterplotGrid: this.plotRenderer,
			annotationGrid: {
				loopRenderer: this.loopRenderer,
				meshRenderer: this.meshRenderer,
				stencilMeshRenderer: this.stencilMeshRenderer,
			},
		};
		for (const layer of this.layers) {
			// TODO all cases are identical - dry it up!
			if (layer.type === "scatterplot") {
				layer.render.onChange({
					data: layer.data,
					settings: {
						...settings,

						renderer: renderers[layer.type],
					},
				});
			} else if (layer.type === "volumeSlice") {
				layer.render.onChange({
					data: layer.data,
					settings: {
						...settings,
						renderer: renderers[layer.type],
					},
				});
			} else if (layer.type === "annotationLayer") {
				layer.render.onChange(
					{
						data: layer.data,
						settings: {
							...settings,
							renderer: renderers[layer.type],
						},
					},
					this.mode === "pan",
				); // dont cancel while drawing
			} else if (layer.type === "volumeGrid") {
				layer.render.onChange({
					data: layer.data,
					settings: {
						...settings,
						concurrentTasks: 3,
						cpuLimit: 25,
						renderer: renderers[layer.type],
					},
				});
			} else if (layer.type === "annotationGrid") {
				layer.render.onChange({
					data: layer.data,
					settings: {
						...settings,
						concurrentTasks: 2,
						renderers: renderers[layer.type],
					},
				});
			} else if (layer.type === "scatterplotGrid") {
				layer.render.onChange({
					data: layer.data,
					settings: {
						...settings,
						concurrentTasks: 3,
						cpuLimit: 25,
						renderer: renderers[layer.type],
					},
				});
			}
		}
	}
	onCameraChanged() {
		if (this.redrawRequested === 0) {
			this.redrawRequested = window.requestAnimationFrame(() => {
				this.doReRender();
				this.redrawRequested = 0;
			});
		}
		this.requestReRender();
	}
	requestReRender() {
		if (this.refreshRequested === 0) {
			this.refreshRequested = window.requestAnimationFrame(() => {
				this.refreshScreen();
				this.refreshRequested = 0;
				uiroot?.render(AppUi({ demo: this }));
			});
		}
	}
	mouseButton(click: "up" | "down", pos: vec2) {
		this.mouse = click;
		const curLayer = this.layers[this.selectedLayer];
		if (click === "down" && curLayer && curLayer.type === "annotationLayer") {
			startStroke(curLayer, this.toDataspace(pos));
		}
	}
	private toDataspace(px: vec2) {
		const { view } = this.camera;
		const o: vec2 = [px[0], this.canvas.clientHeight - px[1]];
		const p = Vec2.div(o, [this.canvas.clientWidth, this.canvas.clientHeight]);
		const c = Vec2.mul(p, Box2D.size(view));
		return Vec2.add(view.minCorner, c);
	}
	mouseMove(delta: vec2, pos: vec2) {
		const curLayer = this.layers[this.selectedLayer];
		if (this.mode === "pan") {
			if (this.mouse === "down") {
				// drag the view
				const { screen, view } = this.camera;
				const p = Vec2.div(delta, [
					this.canvas.clientWidth,
					this.canvas.clientHeight,
				]);
				const c = Vec2.mul(p, Box2D.size(view));
				this.camera = {
					...this.camera,
					view: Box2D.translate(view, c),
					screen,
				};
				this.onCameraChanged();
			}
		} else if (curLayer && curLayer.type === "annotationLayer") {
			if (this.mouse === "down") {
				appendPoint(curLayer, this.toDataspace(pos));
				this.onCameraChanged();
			}
		}

		this.mousePos = Vec2.add(this.mousePos, delta);
	}
	zoom(scale: number) {
		const { view, screen } = this.camera;
		const m = Box2D.midpoint(view);
		this.camera = {
			...this.camera,
			view: Box2D.translate(
				Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]),
				m,
			),
			screen,
		};
		this.onCameraChanged();
	}
	private initHandlers(canvas: HTMLCanvasElement) {
		canvas.onmousedown = (e: MouseEvent) => {
			this.mouseButton("down", [e.offsetX, canvas.clientHeight - e.offsetY]);
		};
		canvas.onmouseup = (e: MouseEvent) => {
			this.mouseButton("up", [e.offsetX, canvas.clientHeight - e.offsetY]);
		};
		canvas.onmousemove = (e: MouseEvent) => {
			// account for gl-origin vs. screen origin:
			this.mouseMove(
				[-e.movementX, -e.movementY],
				[e.offsetX, canvas.clientHeight - e.offsetY],
			);
		};
		canvas.onwheel = (e: WheelEvent) => {
			this.zoom(e.deltaY > 0 ? 1.1 : 0.9);
		};
		window.onkeyup = (e: KeyboardEvent) => {
			const layer = this.layers[this.selectedLayer];
			if (e.key === " ") {
				if (layer && layer.type === "annotationLayer") {
					// toggle the mode
					this.mode = this.mode === "draw" ? "pan" : "draw";
					this.uiChange();
				}
			}
			if (e.key === "d") {
				// start a new drawing!
				if (
					this.layers.length === 0 ||
					(layer && layer.type !== "annotationLayer")
				) {
					this.addEmptyAnnotation();
					this.selectLayer(this.layers.length - 1);
					this.mode = "draw";
					this.uiChange();
				}
			}
		};
	}

	refreshScreen() {
		const flipBox = (box: box2D): box2D => {
			const { minCorner, maxCorner } = box;
			return {
				minCorner: [minCorner[0], maxCorner[1]],
				maxCorner: [maxCorner[0], minCorner[1]],
			};
		};
		const flipped = Box2D.toFlatArray(flipBox(this.camera.view));
		this.regl.clear({ framebuffer: null, color: [0, 0, 0, 1], depth: 1 });
		for (const layer of this.layers) {
			const src = layer.render.getRenderResults("prev");
			if (src.bounds) {
				this.imgRenderer({
					box: Box2D.toFlatArray(src.bounds),
					img: src.texture,
					target: null,
					view: flipped,
				});
			}
			// annotations are often transparent and dont do well...
			if (
				layer.render.renderingInProgress() &&
				layer.type !== "annotationGrid"
			) {
				// draw our incoming frame overtop the old!
				const cur = layer.render.getRenderResults("cur");
				if (cur.bounds) {
					this.imgRenderer({
						box: Box2D.toFlatArray(cur.bounds),
						img: cur.texture,
						target: null,
						view: flipped,
					});
				}
			}
		}
	}
}

let theDemo: Demo;

function demoTime(thing: HTMLCanvasElement) {
	if (theDemo !== undefined) {
		return theDemo;
	}
	thing.width = thing.clientWidth;
	thing.height = thing.clientHeight;

	const offscreen = thing;
	const gl = offscreen.getContext("webgl", {
		alpha: true,
		preserveDrawingBuffer: true,
		antialias: true,
		premultipliedAlpha: true,
	});
	if (!gl) {
		throw new Error("WebGL not supported!");
	}
	const regl = REGL({
		gl,
		extensions: [
			"ANGLE_instanced_arrays",
			"OES_texture_float",
			"WEBGL_color_buffer_float",
		],
	});
	theDemo = new Demo(thing, regl);

	window["demo"] = theDemo;
	setupExampleData();
	uiroot.render(AppUi({ demo: theDemo }));
}
function setupExampleData() {
	// add a bunch of pre-selected layers to the window object for selection during demo time
	window.examples = {};
	const prep = (key: string, thing: any) => {
		window.examples[key] = thing;
	};
	prep("structureAnnotation", structureAnnotation);
	prep("tissuecyte396", tissuecyte396);
	prep("slide32", oneSlide);
	prep("versa1", versa1);
	prep("reconstructed", reconstructed);
	prep("tissuecyte", tissueCyteSlice);
}
const slide32 = "MQ1B9QBZFIPXQO6PETJ";
const colorByGene: ColumnRequest = { name: "88", type: "QUANTITATIVE" };
const merfish =
	"https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_slide_view_02142024-20240223021524/DTVLE1YGNTJQMWVMKEU/ScatterBrain.json";
const ccf =
	"https://neuroglancer-vis-prototype.s3.amazonaws.com/mouse3/230524_transposed_1501/avg_template/";
const tissuecyte =
	"https://tissuecyte-visualizations.s3.amazonaws.com/data/230105/tissuecyte/1111175209/green/";
const tenx =
	"https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_tenx_01172024_stage-20240128193624/488I12FURRB8ZY5KJ8T/ScatterBrain.json";
const scottpoc =
	"https://tissuecyte-ome-zarr-poc.s3.amazonaws.com/40_128_128/1145081396";
const pretend = { min: 0, max: 500 };
const reconstructed: ScatterplotGridConfig = {
	colorBy: colorByGene,
	type: "ScatterPlotGridConfig",
	url: "https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_ccf_04112024-20240419205547/4STCSZBXHYOI0JUUA3M/ScatterBrain.json",
};
const oneSlide: ScatterPlotGridSlideConfig = {
	colorBy: colorByGene,
	slideId: slide32,
	type: "ScatterPlotGridSlideConfig",
	url: "https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_ccf_04112024-20240419205547/4STCSZBXHYOI0JUUA3M/ScatterBrain.json",
};
const tissuecyte396: ZarrSliceGridConfig = {
	type: "ZarrSliceGridConfig",
	gamut: {
		R: { index: 0, gamut: { max: 600, min: 0 } },
		G: { index: 1, gamut: { max: 500, min: 0 } },
		B: { index: 2, gamut: { max: 400, min: 0 } },
	},
	plane: "xy",
	slices: 142,
	url: scottpoc,
};
const tissueCyteSlice: ZarrSliceConfig = {
	type: "zarrSliceConfig",
	gamut: {
		R: { index: 0, gamut: { max: 600, min: 0 } },
		G: { index: 1, gamut: { max: 500, min: 0 } },
		B: { index: 2, gamut: { max: 400, min: 0 } },
	},
	plane: "xy",
	planeParameter: 0.5,
	url: scottpoc,
};
const versa1: ZarrSliceGridConfig = {
	url: "https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/",
	type: "ZarrSliceGridConfig",
	gamut: {
		R: { index: 0, gamut: { max: 20, min: 0 } },
		G: { index: 1, gamut: { max: 20, min: 0 } },
		B: { index: 2, gamut: { max: 20, min: 0 } },
	},
	plane: "xy",
	slices: 4,
};
const structureAnnotation: AnnotationGridConfig = {
	type: "AnnotationGridConfig",
	url: "https://bkp-2d-visualizations-stage.s3.amazonaws.com/wmb_ccf_04112024-20240419205547/4STCSZBXHYOI0JUUA3M/ScatterBrain.json",
	levelFeature: "73GVTDXDEGE27M2XJMT",
	annotationUrl:
		"https://stage-sfs.brain.devlims.org/api/v1/Annotation/4STCSZBXHYOI0JUUA3M/v3/TLOKWCL95RU03D9PETG/",
	stroke: {
		opacity: 1,
		overrideColor: [1, 0, 0, 1] as const,
	},
	fill: {
		opacity: 0.7,
	},
};
const uiroot = createRoot(document.getElementById("sidebar")!);

demoTime(document.getElementById("glCanvas") as HTMLCanvasElement);
