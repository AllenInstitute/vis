import REGL, { type Framebuffer2D } from "regl";
import { type ZarrDataset, type ZarrRequest, getSlice, pickBestScale, sizeInUnits, planeSizeInVoxels, indexOfDimension } from "~/loaders/ome-zarr/zarr-data";
import { Box2D, type Interval, Vec2, type box2D, type vec2, type vec4 } from "@alleninstitute/vis-geometry";
import { omit, slice } from "lodash";
import type { Camera } from "./camera";
import type { NestedArray, TypedArray } from "zarr";

type Props = {
  target: Framebuffer2D | null;
  tile: vec4;
  view: vec4;
  rotation: number;
  Rgamut: vec2;
  Ggamut: vec2;
  Bgamut: vec2;
  viewport: REGL.BoundingBox;
  R: REGL.Texture2D;
  G: REGL.Texture2D;
  B: REGL.Texture2D;
};
function isTexture(obj: object | undefined): obj is Bfr {
  return (obj !== undefined && 'type' in obj && obj.type === 'texture2D')
}
export function buildVersaRenderer(regl: REGL.Regl) {
  const cmd = regl<
    {
      view: vec4;
      tile: vec4;
      rot: number;
      R: REGL.Texture2D;
      G: REGL.Texture2D;
      B: REGL.Texture2D;
      Rgamut: vec2;
      Ggamut: vec2;
      Bgamut: vec2;
    },
    { pos: REGL.BufferData },
    Props
  >({
    vert: ` precision highp float;
    attribute vec2 pos;
        
        uniform vec4 view;
        uniform vec4 tile;
        varying vec2 texCoord;
        uniform float rot;

        vec2 rotateObj(vec2 obj, float radians){
          return obj;
        }
        vec2 rotateTextureCoordinates(vec2 tx, float radians){
          vec2 xy = tx-vec2(0.5,0.5);
          mat2 R = mat2(
            vec2(cos(radians),-sin(radians)), 
            vec2(-sin(radians),cos(radians))
            );
          return ((R*xy)+vec2(0.5,0.5));
        }
        void main(){
           vec2 tileSize = tile.zw-tile.xy;

           texCoord = rotateTextureCoordinates(pos,rot);
           vec2 obj = rotateObj((pos.xy*tileSize+tile.xy),rot);

            vec2 p = (obj-view.xy)/(view.zw-view.xy);
            // now, to clip space
            p = (p*2.0)-1.0;
            gl_Position = vec4(p.x,p.y,0.0,1.0);
        }`,
    frag: `
    precision highp float;
    uniform sampler2D R;
    uniform sampler2D G;
    uniform sampler2D B; // for reasons which are pretty annoying
    // its more direct to do 3 separate channels...
    uniform vec2 Rgamut;
    uniform vec2 Ggamut;
    uniform vec2 Bgamut;
    
    varying vec2 texCoord;
    void main(){
            vec3 mins = vec3(Rgamut.x,Ggamut.x,Bgamut.x);
            vec3 maxs = vec3(Rgamut.y,Ggamut.y,Bgamut.y);
            vec3 span = maxs-mins;
            vec3 color = (vec3(
                texture2D(R, texCoord).r,
                texture2D(G, texCoord).r,
                texture2D(B, texCoord).r
            )-mins) /span;
            gl_FragColor = vec4(color, 1.0);
        }`,
    framebuffer: regl.prop<Props, "target">("target"),
    attributes: {
      pos: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    uniforms: {
      rot: regl.prop<Props, "rotation">("rotation"),
      tile: regl.prop<Props, "tile">("tile"),
      view: regl.prop<Props, "view">("view"),
      R: regl.prop<Props, "R">("R"),
      G: regl.prop<Props, "G">("G"),
      B: regl.prop<Props, "B">("B"),
      Rgamut: regl.prop<Props, "Rgamut">("Rgamut"),
      Ggamut: regl.prop<Props, "Ggamut">("Ggamut"),
      Bgamut: regl.prop<Props, "Bgamut">("Bgamut"),
    },
    depth: {
      enable: false,
    },
    count: 4,
    // viewport: regl.prop<Props, "viewport">("viewport"),
    primitive: "triangle fan",
    // ... more!
  });

  return (item: VoxelTile, settings: VoxelSliceRenderSettings, channels: Record<string, Bfr | object | undefined>) => {
    const { view, viewport, gamut, target, rotation } = settings;
    const { realBounds } = item;
    const { R, G, B } = channels;

    if (!isTexture(R) || !isTexture(G) || !isTexture(B)) {
      console.log("missing data: ", R, G, B);
      return;
    }

    cmd({
      target,
      rotation,
      view: [...view.minCorner, ...view.maxCorner],
      tile: [...realBounds.minCorner, ...realBounds.maxCorner],
      R: R.data,
      G: G.data,
      B: B.data,
      Rgamut: [gamut.R.gamut.min, gamut.R.gamut.max],
      Ggamut: [gamut.G.gamut.min, gamut.G.gamut.max],
      Bgamut: [gamut.B.gamut.min, gamut.B.gamut.max],
    });
  };
}
type Bfr = { type: 'texture2D', data: REGL.Texture2D };

type Tile = { bounds: box2D };
export type VoxelSliceRenderSettings = {
  regl: REGL.Regl;
  dataset: ZarrDataset;
  view: box2D;
  rotation: number;
  gamut: Record<"R" | "G" | "B", { gamut: Interval; index: number }>;
  viewport: REGL.BoundingBox;
  target: REGL.Framebuffer2D | null;
};
export type AxisAlignedPlane = "xy" | "yz" | "xz";
export type VoxelTile = {
  plane: AxisAlignedPlane;
  realBounds: box2D;
  bounds: box2D; // in voxels, in the plane
  planeIndex: number;
  layerIndex: number;
  // time and channel are always = 0, for now
};

function toZarrRequest(tile: VoxelTile, channel: number): ZarrRequest {
  const { plane, planeIndex, bounds } = tile;
  const { minCorner: min, maxCorner: max } = bounds;
  const u = { min: min[0], max: max[0] };
  const v = { min: min[1], max: max[1] };
  switch (plane) {
    case "xy":
      return {
        x: u,
        y: v,
        t: 0,
        c: channel,
        z: planeIndex,
      };
    case "xz":
      return {
        x: u,
        z: v,
        t: 0,
        c: channel,
        y: planeIndex,
      };
    case "yz":
      return {
        y: u,
        z: v,
        t: 0,
        c: channel,
        x: planeIndex,
      };
  }
}
export function cacheKeyFactory(col: string, item: VoxelTile, settings: VoxelSliceRenderSettings) {
  return `${settings.dataset.url}_${JSON.stringify(omit(item, "desiredResolution"))}_ch=${settings.gamut[col as "R" | "G" | "B"].index
    }`;
}
const LUMINANCE = "luminance";
export function requestsForTile(tile: VoxelTile, settings: VoxelSliceRenderSettings, signal?: AbortSignal) {
  const { dataset, regl } = settings;
  const handleResponse = (vxl: Awaited<ReturnType<typeof getSlice>>) => {
    const { shape, buffer } = vxl;
    const R = new Float32Array(buffer.flatten());// buffer.dtype === '<f4' ? new Float32Array(buffer.flatten()) : buffer.flatten(); //(buffer.get([0, null, null]) as NestedArray<TypedArray>).flatten();
    const r = regl.texture({
      data: R, // new Float32Array(buffer),
      width: shape[1],
      height: shape[0], // TODO this swap is sus
      format: LUMINANCE,
    });
    return r;
  };
  // lets hope the browser caches our 3x repeat calls to teh same data...
  return {
    R: async () => {
      const vxl = await getSlice(dataset, toZarrRequest(tile, settings.gamut.R.index), tile.layerIndex);
      return { type: 'texture2D', data: handleResponse(vxl) }
    },
    G: async () => {
      const vxl = await getSlice(dataset, toZarrRequest(tile, settings.gamut.G.index), tile.layerIndex);
      return { type: 'texture2D', data: handleResponse(vxl) }
    },
    B: async () => {
      const vxl = await getSlice(dataset, toZarrRequest(tile, settings.gamut.B.index), tile.layerIndex);
      return { type: 'texture2D', data: handleResponse(vxl) }
    },
  };
}

function getAllTiles(idealTilePx: vec2, layerSize: vec2) {
  // return the set of all our "tiles" of this layer, given the tilePx size
  const tiles: box2D[] = [];
  for (let x = 0; x < layerSize[0]; x += idealTilePx[0]) {
    for (let y = 0; y < layerSize[1]; y += idealTilePx[1]) {
      const xy: vec2 = [x, y];
      tiles.push(Box2D.create(xy, Vec2.min(Vec2.add(xy, idealTilePx), layerSize)));
    }
  }
  return tiles;
}
const uvTable = {
  xy: { u: "x", v: "y" },
  xz: { u: "x", v: "z" },
  yz: { u: "y", v: "z" },
} as const;
const sliceDimension = {
  xy: "z",
  xz: "y",
  yz: "x",
} as const;


export function getVisibleTiles(
  camera: Camera,
  plane: AxisAlignedPlane,
  planeIndex: number,
  dataset: ZarrDataset,
  offset?: vec2
): { layer: number; view: box2D; tiles: VoxelTile[] } {
  // const { axes, datasets } = dataset.multiscales[0];
  // const zIndex = indexOfDimension(axes, sliceDimension[plane]);
  const sliceSize = sizeInUnits(
    uvTable[plane],
    dataset.multiscales[0].axes,
    dataset.multiscales[0].datasets[0]
  )!;
  const thingy = pickBestScale(
    dataset,
    uvTable[plane],
    camera.view,
    camera.screen
  );
  // TODO: open the array, look at its chunks, use that size for the size of the tiles I request!
  const layerIndex = dataset.multiscales[0].datasets.indexOf(thingy);

  const size = planeSizeInVoxels(uvTable[plane], dataset.multiscales[0].axes, thingy);
  const realSize = sizeInUnits(uvTable[plane], dataset.multiscales[0].axes, thingy);
  if (!size || !realSize) return { layer: layerIndex, view: Box2D.create([0, 0], [1, 1]), tiles: [] };
  const scale = Vec2.div(realSize, size);
  // to go from a voxel-box to a real-box (easier than you think, as both have an origin at 0,0, because we only support scale...)
  const vxlToReal = (vxl: box2D) => Box2D.translate(Box2D.scale(vxl, scale), offset ?? [0, 0]);
  // const realToVxl = (real: box2D) => Box2D.scale(real, Vec2.div(size, realSize));

  // find the tiles, in voxels, to request...
  const allTiles = getAllTiles([256, 256], size);
  const inView = allTiles.filter((tile) => !!Box2D.intersection(camera.view, vxlToReal(tile)));
  // camera.view is in a made up dataspace, where 1=height of the current dataset
  // thus, we have to convert it into a voxel-space camera for intersections
  // const voxelView = realToVxl(camera.view);
  return {
    layer: layerIndex,
    view: camera.view,
    tiles: inView.map((uv) => ({
      plane,
      realBounds: vxlToReal(uv),
      bounds: uv,
      planeIndex,
      layerIndex,
    })),
  };
}
