// lets make some easy to understand utils to access .zarr data stored in an s3 bucket somewhere
import { HTTPStore, NestedArray, type TypedArray, openArray, openGroup, slice } from "zarr";
import { some } from "lodash";
import { Box2D, type Interval, Vec2, type box2D, limit, type vec2 } from "@alleninstitute/vis-geometry";
// documentation for ome-zarr datasets (from which these types are built)
// can be found here:
// https://ngff.openmicroscopy.org/latest/#multiscale-md
//
export type ZarrDataset = Awaited<ReturnType<typeof loadMetadata>>;
type AxisDesc = {
  name: string; // x or y or z or time or ?
  type: string; // space or time or ?
  unit: string; // see list of possible units: https://ngff.openmicroscopy.org/latest/#axes-md
};

// todo, there are other types of coordinate transforms...
type ScaleTransform = {
  type: "scale";
  scale: ReadonlyArray<number>;
};

function isScaleTransform(trn: unknown): trn is ScaleTransform {
  if (typeof trn === "object" && trn !== null) {
    const scaleTransform = trn as ScaleTransform;
    return scaleTransform.type === "scale" && scaleTransform.scale !== undefined;
  }
  return false;
}
type DatasetDesc = {
  path: string;
  coordinateTransformations: ReadonlyArray<ScaleTransform | unknown>;
};
type DatasetWithShape = DatasetDesc & {
  shape: number[];
};
type ZarrAttr = {
  axes: ReadonlyArray<AxisDesc>;
  datasets: ReadonlyArray<DatasetDesc>;
};
type ZarrAttrs = {
  multiscales: ReadonlyArray<ZarrAttr>;
};

// function getSpatialDimensionShape(dataset: DatasetWithShape, axes: readonly AxisDesc[]) {
//   const dims = axes.reduce(
//     (shape, ax, i) => (ax.type === "spatial" ? { ...shape, [ax.name]: dataset.shape[i] } : shape),
//     {} as Record<string, number>
//   );
//   return dims;
// }
// function getSpatialOrdering
// function getBoundsInMillimeters(data: ZarrDataset) {
//   if (data.multiscales.length !== 1) {
//     throw new Error("cant support multi-scene zarr file...");
//   }
//   const scene = data.multiscales[0];
//   const { axes, datasets } = scene;
//   if (datasets.length < 1) {
//     throw new Error("malformed dataset - no voxels!");
//   }
//   const dataset = datasets[0];
//   const spatialResolution = getSpatialDimensionShape(dataset, axes);
//   // apply transforms
//   dataset.coordinateTransformations.forEach((trn) => {});
//   const dimensions = getNumVoxelsInXYZ(getXYZIndexing(axes), dataset.shape);

//   let bounds: box3D = Box3D.create([0, 0, 0], dimensions);
//   dataset.coordinateTransformations.forEach((trn) => {
//     // specification for coordinate transforms given here: https://ngff.openmicroscopy.org/latest/#trafo-md
//     // from the above doc, its not super clear if the given transformation is in the order of the axes metadata (https://ngff.openmicroscopy.org/latest/#axes-md)
//     // or some other order
//     // all files I've seen so far have both in xyz order, so its a bit ambiguous.
//     if (isScaleTransform(trn) && trn.scale.length >= 3) {
//       bounds = applyScaleToXYZBounds(bounds, trn, axes);
//     } else {
//       throw new Error(`unsupported coordinate transformation type - please implement`);
//     }
//   });
//   // finally - convert whatever the axes units are to millimeters, or risk crashing into mars
//   // get the units of each axis in xyz order...

//   return Box3D.map(bounds, (corner) => unitsToMillimeters(corner, axes));
// }

async function getRawInfo(store: HTTPStore) {
  const group = await openGroup(store);
  // TODO HACK ALERT: I am once again doing the thing that I hate, in which I promise to my friend Typescript that
  // the junk I just pulled out of this internet file is exactly what I expect it to be: :fingers_crossed:
  return group.attrs.asObject() as Promise<ZarrAttrs>;
}

async function mapAsync<T, R>(arr: ReadonlyArray<T>, fn: (t: T, index: number) => Promise<R>) {
  return Promise.all(arr.map((v, i) => fn(v, i)));
}
// return the mapping from path (aka resolution group???) to the dimensional shape of the data
async function loadMetadata(store: HTTPStore, attrs: ZarrAttrs) {
  const addShapeToDesc = async (d: DatasetDesc) => ({
    ...d,
    shape: (await openArray({ store, mode: "r", path: d.path })).shape,
  });
  return {
    url: store.url,
    multiscales: await mapAsync(attrs.multiscales, async (attr) => ({
      ...attr,
      datasets: await mapAsync<DatasetDesc, DatasetWithShape>(attr.datasets, addShapeToDesc),
    })),
  };
}

type OmeDimension = "x" | "y" | "z" | "t" | "c";

// function sizeOnScreen(full: box2D, relativeView: box2D, screen: vec2) {
//   const pxView = Box2D.scale(relativeView, Box2D.size(full));
//   const onScreen = Box2D.intersection(pxView, full);
//   if (!onScreen) return [0, 0];

//   const effective = Box2D.size(onScreen);
//   // as a parameter, how much is on screen?
//   const p = Vec2.div(effective, Box2D.size(full));
//   const limit = Vec2.mul(p, screen);

//   return limit[0] * limit[1] < effective[0] * effective[1] ? limit : effective
// }
export type ZarrRequest = Record<OmeDimension, number | Interval | null>;
export function pickBestScale(
  dataset: ZarrDataset,
  plane: {
    u: OmeDimension;
    v: OmeDimension;
  },
  relativeView: box2D, // a box in data-unit-space
  // in the plane given above
  displayResolution: vec2
) {
  const datasets = dataset.multiscales[0].datasets;
  const axes = dataset.multiscales[0].axes;
  const vxlPitch = (size: vec2) => Vec2.div([1, 1], size);
  // size, in dataspace, of a pixel 1/res
  const pxPitch = Vec2.div(Box2D.size(relativeView), displayResolution);
  const dstToDesired = (a: vec2, goal: vec2) => Vec2.length(Vec2.sub(a, goal));
  // we assume the datasets are ordered... hmmm TODO
  const choice = datasets.reduce(
    (bestSoFar, cur) =>
      dstToDesired(vxlPitch(sizeInVoxels(plane, axes, bestSoFar)!), pxPitch) >
        dstToDesired(vxlPitch(sizeInVoxels(plane, axes, cur)!), pxPitch)
        ? cur
        : bestSoFar,
    datasets[0]
  );
  return choice ?? datasets[datasets.length - 1];
}
function indexFor(dim: OmeDimension, axes: readonly AxisDesc[]) {
  return axes.findIndex((axe) => axe.name === dim);
}
export function sizeInUnits(
  plane: {
    u: OmeDimension;
    v: OmeDimension;
  },
  axes: readonly AxisDesc[],
  dataset: DatasetWithShape
): vec2 | undefined {
  const vxls = sizeInVoxels(plane, axes, dataset);

  if (vxls === undefined) return undefined;
  let size: vec2 = vxls;
  // now, just apply the correct transforms, if they exist...

  dataset.coordinateTransformations.forEach((trn) => {
    if (isScaleTransform(trn)) {
      // try to apply it!
      const uIndex = indexOfDimension(axes, plane.u);
      const vIndex = indexOfDimension(axes, plane.v);
      size = Vec2.mul(size, [trn.scale[uIndex], trn.scale[vIndex]]);
    }
  });
  return size;
}
export function sizeInVoxels(
  plane: {
    u: OmeDimension;
    v: OmeDimension;
  },
  axes: readonly AxisDesc[],
  dataset: DatasetWithShape
): vec2 | undefined {
  // first - u&v must not refer to the same dimension,
  // and both should exist in the axes...
  const { u, v } = plane;
  if (u === v) return undefined;
  const uI = indexFor(u, axes);
  const vI = indexFor(v, axes);

  if (uI === -1 || vI === -1) return undefined;

  return [dataset.shape[uI], dataset.shape[vI]] as const;
}
// feel free to freak out if the request is over or under determined or whatever
function buildQuery(r: Readonly<ZarrRequest>, axes: readonly AxisDesc[], shape: number[]) {
  const ordered = axes.map((a) => r[a.name as OmeDimension]);
  // if any are undefined, throw up
  if (some(ordered, (a) => a === undefined)) {
    throw new Error("request does not match expected dimensions of ome-zarr dataset!");
  }

  return ordered.map((d, i) => {
    const bounds = { min: 0, max: shape[i] };
    if (d === null) {
      return d;
    } else if (typeof d === "number") {
      return limit(bounds, d);
    }
    return slice(limit(bounds, d.min), limit(bounds, d.max));
  });
}
function dieIfMalformed(r: ZarrRequest) {
  // deal with me later
  // TODO
}
export async function explain(z: ZarrDataset) {
  console.dir(z);
  const store = new HTTPStore(z.url);
  for (const d of z.multiscales[0].datasets) {
    openArray({ store, path: d.path, mode: "r" }).then((arr) => {
      console.dir(arr);
    });
  }
}

export function indexOfDimension(axes: readonly AxisDesc[], dim: OmeDimension) {
  return axes.findIndex((ax) => ax.name === dim);
}
export async function getSlice(metadata: ZarrDataset, r: ZarrRequest, layerIndex: number) {
  dieIfMalformed(r);
  // put the request in native order
  const store = new HTTPStore(metadata.url);
  const scene = metadata.multiscales[0];
  const { axes } = scene;
  const level = scene.datasets[layerIndex] ?? scene.datasets[scene.datasets.length - 1];
  const arr = await openArray({ store, path: level.path, mode: "r" });
  const result = await arr.get(buildQuery(r, axes, level.shape));
  if (typeof result == "number") {
    throw new Error("oh noes, slice came back all weird");
  }
  return {
    shape: result.shape,
    buffer: result,
  };
}
// export async function getRGBSlice(metadata: ZarrDataset, r: ZarrRequest, layerIndex: number) {
//   dieIfMalformed(r);
//   // put the request in native order
//   const store = new HTTPStore(metadata.url);
//   const scene = metadata.multiscales[0];
//   const { axes } = scene;
//   const level = scene.datasets[layerIndex] ?? scene.datasets[scene.datasets.length - 1];
//   const arr = await openArray({ store, path: level.path, mode: "r" });
//   const result = await arr.get(buildQuery(r, axes, level.shape));
//   if (typeof result == "number" || result.shape.length !== 2) {
//     throw new Error("oh noes, slice came back all weird");
//   }
//   return {
//     shape: result.shape as unknown as vec2,
//     buffer: result.flatten(),
//   };
// }

export async function load(url: string) {
  const store = new HTTPStore(url);
  return loadMetadata(store, await getRawInfo(store));
}
