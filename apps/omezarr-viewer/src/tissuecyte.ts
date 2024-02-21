// I am the scatterplot demo //
import { ImGui, ImGui_Impl } from "@zhobo63/imgui-ts";
import REGL from "regl";
import {
  type ZarrDataset,
  explain,
  getSlice,
  indexOfDimension,
  load,
  pickBestScale,
  sizeInUnits,
  sizeInVoxels,
} from "./zarr-data";
import { AsyncDataCache, beginLongRunningFrame } from "@alleninstitute/vis-scatterbrain";

import { Box2D, type Interval, Vec2, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import type { FrameLifecycle } from "@alleninstitute/vis-scatterbrain/lib/render-queue";
import type { Camera } from "./camera";
import { buildImageRenderer } from "./image-renderer";
import { ImVec2, ImVec4 } from "@zhobo63/imgui-ts/src/imgui";
import { colorMapWidget } from "./components/color-map";
import { initDrawableInterface } from "./annotation/path";
import {
  type AxisAlignedPlane,
  type VoxelSliceRenderSettings,
  type VoxelTile,
  buildVolumeSliceRenderer,
  cacheKeyFactory,
  getVisibleTiles,
  requestsForTile,
} from "./slice-renderer";
const creepy =
  "https://aind-open-data.s3.amazonaws.com/SmartSPIM_644106_2022-12-09_12-12-39_stitched_2022-12-16_16-55-11/processed/OMEZarr/Ex_488_Em_525.zarr";
const tissuecyte = "https://tissuecyte-visualizations.s3.amazonaws.com/data/230105/tissuecyte/1111175209/green/";
// const versa = "https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/";
// const b = "https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/ome_zarr/20231207.1/1282139033/";
// const scott = "https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/ome_zarr/20231204/1197986710/";
const file = tissuecyte;
type Channel = "R" | "G" | "B"; // we can support 3 visual channels at once
type ChannelColorSettings = {
  gamut: Interval;
  index: number;
};
class TissuecyteDemo {
  mouse: "up" | "down";
  mousePos: vec2;
  camera: Camera;
  channels: Record<Channel, ChannelColorSettings>;
  plane: AxisAlignedPlane;
  sliceParameter: number;
  canvas: HTMLCanvasElement;
  curFrame: FrameLifecycle | null;
  rotation: number;
  cache: AsyncDataCache<REGL.Texture2D>;
  regl: REGL.Regl;
  dataset: ZarrDataset;
  screenRenderer: ReturnType<typeof buildImageRenderer>;
  renderer: ReturnType<typeof buildVolumeSliceRenderer>;
  screenBuffer: { bounds: box2D; fbo: REGL.Framebuffer2D };
  datasets: string[];
  constructor(
    canvas: HTMLCanvasElement,
    dataset: ZarrDataset,
    regl: REGL.Regl,
    cache: AsyncDataCache<REGL.Texture2D>,
    urls: string[]
  ) {
    const [w, h] = [canvas.clientWidth, canvas.clientHeight];
    this.datasets = urls;

    const sliceSize = sizeInUnits({ u: "x", v: "y" }, dataset.multiscales[0].axes, dataset.multiscales[0].datasets[0])!;
    this.camera = {
      view: Box2D.create([0, 0], [(sliceSize[1] * w) / h, sliceSize[1]]),
      screen: [w, h],
    };
    this.screenBuffer = { bounds: this.camera.view, fbo: regl.framebuffer(w, h) };
    this.dataset = dataset;
    this.regl = regl;
    this.plane = "yz";
    this.mouse = "up";
    this.cache = cache;
    this.sliceParameter = 0.5;
    this.mousePos = [0, 0];
    this.channels = {
      R: {
        gamut: { min: 0, max: 2500 },
        index: 0,
      },
      //   G: {
      //     gamut: { min: 0, max: 0.21 },
      //     index: 1,
      //   },
      //   B: {
      //     gamut: { min: 0, max: 0.21 },
      //     index: 2,
      //   },
    };
    this.canvas = canvas;
    this.curFrame = null;
    this.rotation = (3 * Math.PI) / 2;
    this.renderer = buildVolumeSliceRenderer(regl);
    this.screenRenderer = buildImageRenderer(regl);
    const loop = () => {
      this.refreshScreen();
      window.requestAnimationFrame(loop);
    };
    window.requestAnimationFrame(loop);
  }
  setupEventHandlers() {
    const canvas = this.canvas;
  }

  private upsideDown(v: box2D) {
    const { minCorner, maxCorner } = v;
    return Box2D.create([minCorner[0], maxCorner[1]], [maxCorner[0], minCorner[1]]);
  }
  private renderFrame() {
    const { camera, plane, sliceParameter, dataset, cache, regl, channels, renderer } = this;
    const { layer, view, tiles } = getVisibleTiles(camera, plane, sliceParameter, dataset);
    // erase our buffer that holds the render'd dataset image - which lets the UI
    // re-render itself independantly
    regl.clear({ color: [0, 0, 0, 0], depth: 1, framebuffer: this.screenBuffer.fbo });

    // get the lowest-resolution view of the current slice - the idea being that we keep
    // it cached, and always draw it UNDER the actual layer we want to see, based on our zoom.
    // this prevents a flickering black frame when we zoom in to a new, higher resolution layer
    const {
      layer: baseLayer,
      view: baseView,
      tiles: baseTiles,
    } = getVisibleTiles({ ...camera, screen: [1, 1] }, plane, sliceParameter, dataset);
    if (layer === baseLayer) {
      this.curFrame = this.renderFrameHelper(baseView, baseTiles);
      // if the layer we WANT is actually the lowest res layer, then we're done here and now!
      return;
    }
    const baseSettings = {
      view: baseView,
      dataset,
      regl,
      target: this.screenBuffer.fbo,
      viewport: {
        x: 0,
        y: 0,
        width: this.canvas.clientWidth,
        height: this.canvas.clientHeight,
      },
      rotation: this.rotation,
      gamut: this.channels.R.gamut,
      //   gamut: channels,
    };

    const cached = baseTiles.reduce(
      (count, cur) => (cache.isCached(cacheKeyFactory("luminance", cur, baseSettings)) ? 1 + count : count),
      0
    );
    if (cached === 0) {
      this.curFrame = this.renderFrameHelper(view, tiles);
      return;
    }
    const frame = beginLongRunningFrame<REGL.Texture2D, VoxelTile, VoxelSliceRenderSettings>(
      3,
      33,
      baseTiles,
      cache,
      baseSettings,
      requestsForTile,
      renderer,
      (event) => {
        switch (event.status) {
          case "error":
            throw event.error; // error boundary might catch this
          case "progress":
            break;
          case "finished_synchronously":
          case "finished":
            console.log("finished base-layer... start real frame!");
            this.curFrame = this.renderFrameHelper(view, tiles);
            break;
          case "begun":
            break;
          case "cancelled":
            this.curFrame = this.renderFrameHelper(view, tiles);
            break;
          default:
        }
      },
      cacheKeyFactory
    );
    frame.cancelFrame();
  }
  // not my fav thing to do - but renderFrame and renderFrame helper are tightly linked
  // to accomplish our smoke&mirrors to avoid flickering as tiles load in -
  // the both make assumptions about state, and the contents of buffers. do not
  // call either of them!
  private renderFrameHelper(view: box2D, visibleTiles: VoxelTile[]) {
    const { camera, dataset, cache, regl, channels, renderer } = this;
    this.screenBuffer.bounds = camera.view;
    regl.clear({ depth: 1, framebuffer: this.screenBuffer.fbo });
    // const gamut = {
    //   R: channels.R.gamut,
    //   G: channels.G.gamut,
    //   B: channels.B.gamut,
    // };
    const frame = beginLongRunningFrame<REGL.Texture2D, VoxelTile, VoxelSliceRenderSettings>(
      3,
      33,
      visibleTiles,
      cache,
      {
        rotation: this.rotation,
        gamut: this.channels.R.gamut,
        view: view,
        dataset,
        regl,
        target: this.screenBuffer.fbo,
        viewport: {
          x: 0,
          y: 0,
          width: this.canvas.clientWidth,
          height: this.canvas.clientHeight,
        },
        // gamut: channels,
      },
      requestsForTile,
      renderer,
      (event) => {
        switch (event.status) {
          case "error":
            throw event.error; // error boundary might catch this
          case "progress":
            this.refreshScreen();
            break;
          case "finished_synchronously":
          case "finished":
            this.curFrame = null;
            this.refreshScreen();
            break;
          case "begun":
            this.refreshScreen();
            break;
          case "cancelled":
            break;
          default:
        }
      },
      cacheKeyFactory
    );
    return frame;
  }
  refreshScreen() {
    const now = performance.now();
    this.regl._refresh();
    this.regl.clear({ depth: 1, color: [0, 0, 0, 1], framebuffer: null });

    this.screenRenderer([
      {
        box: Box2D.toFlatArray(this.screenBuffer.bounds),
        img: this.screenBuffer.fbo,
        target: null,
        view: Box2D.toFlatArray(this.upsideDown(this.camera.view)),
      },
    ]);

    this.drawUI(now);

    this.regl._refresh();
  }

  drawUI(time: number) {
    let drawAgain = false;
    const effects: Array<() => void> = [];
    // imgui wants mutable access to stuff... which is pretty weird - imAccess is nice, but all the vector-style updaters are nasty
    try {
      ImGui_Impl.NewFrame(time);
      ImGui.NewFrame();
      ImGui.Begin("Settings");
      ImGui_Impl.ClearBuffer(new ImVec4(0.2, 0.2, 0.2, 1));
      //   ImGui_Impl.ClearBuffer(new ImVec4(0, 0, 0, 0));
      // TODO: count the available channels that we could use for color!
      Object.entries(this.channels).forEach(([channel, settings]) => {
        const result = colorMapWidget(
          channel,
          {
            gamut: settings.gamut,
            color: new ImGui.Vec4(channel === "R" ? 255 : 0, channel === "G" ? 255 : 0, channel === "B" ? 255 : 0, 255),
            useMe: true,
            index: settings.index,
          },
          3
        );
        if (result.changed) {
          this.channels[channel as Channel].gamut = result.gamut;
          this.channels[channel as Channel].index = result.index;
          drawAgain = true;
        }
      });
      const highlight = new ImVec4(0, 0.25, 0.65, 1.0);
      const regular = new ImVec4(0.2, 0.2, 0.2, 1.0);
      //   for (const thumb of this.sliceThumbs) {
      //     if (
      //       // here we dig deep into the guts of a regl-managed texture... not super safe, and regl's types are not really set up for this:
      //       ImGui.ImageButton(
      //         // @ts-expect-error
      //         thumb?.color[0]?._texture?.texture ?? null,
      //         new ImVec2(this.thumbWidth, THUMB_SIZE),
      //         new ImVec2(0, 0),
      //         new ImVec2(1, 1),
      //         // draw a little box around the selected slice:
      //         this.sliceIndex === this.sliceThumbs.indexOf(thumb) ? 3 : 0,
      //         this.sliceIndex === this.sliceThumbs.indexOf(thumb) ? highlight : regular
      //       )
      //     ) {
      //       drawAgain = true;
      //       effects.push(() => this.setSlice(this.sliceThumbs.indexOf(thumb)));
      //     }
      //     ImGui.SameLine();
      //   }
      let p = this.sliceParameter;
      if (
        ImGui.DragFloat(
          "slice",
          (v?: number) => {
            p = v ?? p;
            return p;
          },
          0.005,
          0.0,
          1.0,
          "%4f"
        )
      ) {
        effects.push(() => (this.sliceParameter = p));
        drawAgain = true;
      }
      ImGui.End();
      ImGui.EndFrame();
      ImGui.Render();

      ImGui_Impl.RenderDrawData(ImGui.GetDrawData());
      effects.forEach((fx) => fx());
      if (drawAgain) {
        window.setTimeout(() => this.rerender(), 5);
      }
    } catch (err) {
      console.warn(err);
    }
  }
  rerender() {
    if (this.curFrame !== null) {
      this.curFrame.cancelFrame();
    }
    this.renderFrame();
  }
  mouseButton(click: "up" | "down") {
    this.mouse = click;
  }
  mouseMove(delta: vec2) {
    if (this.mouse === "down") {
      // drag the view
      const { screen, view } = this.camera;
      const p = Vec2.div(delta, [this.canvas.clientWidth, this.canvas.clientHeight]);
      const c = Vec2.mul(p, Box2D.size(view));
      this.camera = { view: Box2D.translate(view, c), screen };
      this.rerender();
    }
    this.mousePos = Vec2.add(this.mousePos, delta);
  }
  changeSlice(delta: number) {
    this.sliceParameter += delta;
    this.rerender();
  }

  changeGamut(delta: number) {
    this.channels.R.gamut = { min: this.channels.R.gamut.min, max: this.channels.R.gamut.max * delta };
    this.rerender();
  }
  zoom(scale: number) {
    const { view, screen } = this.camera;
    const m = Box2D.midpoint(view);
    this.camera = {
      view: Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m),
      screen,
    };
    this.rerender();
  }
  nextAxis() {
    this.plane = this.plane == "xy" ? "xz" : this.plane === "xz" ? "yz" : "xy";
    this.rerender();
  }
  rotateTiles() {
    this.rotation += Math.PI / 2;
    this.rerender();
  }
}

function setupEventHandlers(canvas: HTMLCanvasElement, demo: TissuecyteDemo) {
  canvas.onmousedown = (e: MouseEvent) => {
    if (ImGui.GetIO().WantCaptureMouse) return;
    demo.mouseButton("down");
  };
  canvas.onmouseup = (e: MouseEvent) => {
    if (ImGui.GetIO().WantCaptureMouse) return;
    demo.mouseButton("up");
  };
  canvas.onmousemove = (e: MouseEvent) => {
    if (ImGui.GetIO().WantCaptureMouse) return;
    // account for gl-origin vs. screen origin:
    demo.mouseMove([-e.movementX, -e.movementY]);
  };
  canvas.onwheel = (e: WheelEvent) => {
    if (e.shiftKey) {
      demo.changeGamut(e.deltaY > 0 ? 1.1 : 0.9);
    } else if (e.altKey) {
      demo.changeSlice(e.deltaY > 0 ? 0.01 : -0.01);
    } else {
      demo.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    }
  };
  canvas.onkeydown = (e: KeyboardEvent) => {
    switch (e.key) {
      case "a":
        demo.nextAxis();
        break;
      case "r":
        demo.rotateTiles();
        break;
      default:
    }
  };
}
function setupGui(canvas: HTMLCanvasElement | WebGL2RenderingContext | WebGLRenderingContext) {
  ImGui.default().then(() => {
    ImGui.CHECKVERSION();
    ImGui.CreateContext();
    const io: ImGui.IO = ImGui.GetIO();
    ImGui.StyleColorsDark();
    io.Fonts.AddFontDefault();
    ImGui_Impl.Init(canvas);
    ImGui_Impl.ClearBuffer(new ImVec4(0.2, 0.2, 0.2, 1));
  });
}
async function demotime() {
  const ui = document.getElementById("uiCanvas") as HTMLCanvasElement;
  const yay = document.getElementById("glCanvas") as HTMLCanvasElement;
  yay.width = 2000;
  yay.height = 2000;

  const gl = ui.getContext("webgl2", {
    alpha: true,
    preserveDrawingBuffer: true,
    antialias: true,
    premultipliedAlpha: true,
  }) as WebGL2RenderingContext;

  const regl = REGL({
    canvas: yay,
    attributes: {
      alpha: true,
      preserveDrawingBuffer: true,
      antialias: true,
      premultipliedAlpha: true,
    },
    extensions: ["ANGLE_instanced_arrays", "OES_texture_float", "WEBGL_color_buffer_float"],
  });
  ui.height = 2000;
  ui.width = 2000;
  const canvas: HTMLCanvasElement = regl._gl.canvas as HTMLCanvasElement;
  canvas.tabIndex = 3;
  setupGui(gl);
  const voxelSliceCache: AsyncDataCache<REGL.Texture2D> = new AsyncDataCache<REGL.Texture2D>();
  const zarr = await load(file);
  explain(zarr);

  const theDemo = new TissuecyteDemo(canvas, zarr, regl, voxelSliceCache, []);

  setupEventHandlers(canvas, theDemo);
  theDemo.rerender();
}

// since I am just included in a script tag in a raw html document, this is how we start:
demotime();
