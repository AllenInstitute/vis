import * as zarr from 'zarrita';
import { some } from 'lodash';
import { Box2D, type Interval, Vec2, type box2D, limit, type vec2 } from '@alleninstitute/vis-geometry';

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

// todo, there are other types of coordinate transforms, however we only support scale transforms for now
type ScaleTransform = {
    type: 'scale';
    scale: ReadonlyArray<number>;
};

function isScaleTransform(trn: unknown): trn is ScaleTransform {
    if (typeof trn === 'object' && trn !== null) {
        const scaleTransform = trn as ScaleTransform;
        return scaleTransform.type === 'scale' && scaleTransform.scale !== undefined;
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

async function getRawInfo(store: zarr.FetchStore) {
    const group = await zarr.open(store, { kind: 'group' });
    return group.attrs as ZarrAttrs;
    // TODO HACK ALERT: I am once again doing the thing that I hate, in which I promise to my friend Typescript that
    // the junk I just pulled out of this internet file is exactly what I expect it to be: :fingers_crossed:
}

async function mapAsync<T, R>(arr: ReadonlyArray<T>, fn: (t: T, index: number) => Promise<R>) {
    return Promise.all(arr.map((v, i) => fn(v, i)));
}
// return the mapping from path (aka resolution group???) to the dimensional shape of the data
async function loadMetadata(url: string) {
    const store = new zarr.FetchStore(url);
    const root = zarr.root(store);
    const attrs: ZarrAttrs = await getRawInfo(store);
    const addShapeToDesc = async (d: DatasetDesc) => ({
        ...d,
        shape: (await zarr.open(root.resolve(d.path), { kind: 'array' })).shape,
    });
    return {
        url,
        multiscales: await mapAsync(attrs.multiscales, async (attr) => ({
            ...attr,
            datasets: await mapAsync<DatasetDesc, DatasetWithShape>(attr.datasets, addShapeToDesc),
        })),
    };
}
export type AxisAlignedPlane = 'xy' | 'xz' | 'yz';
export type OmeDimension = 'x' | 'y' | 'z' | 't' | 'c';
export type PlaneMapping = { u: OmeDimension; v: OmeDimension };
// we could be tricky and try to statically prevent a uv mapping like xx or xy, but theres no real value in it
const uvTable = {
    xy: { u: 'x', v: 'y' },
    xz: { u: 'x', v: 'z' },
    yz: { u: 'y', v: 'z' },
} as const;

const sliceDimension = {
    xy: 'z',
    xz: 'y',
    yz: 'x',
} as const;
export function uvForPlane<T extends AxisAlignedPlane>(plane: T) {
    return uvTable[plane];
}
export function sliceDimensionForPlane(plane: AxisAlignedPlane) {
    return sliceDimension[plane];
}
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
    const realSize = sizeInUnits(plane, axes, datasets[0])!;

    const vxlPitch = (size: vec2) => Vec2.div(realSize, size);
    // size, in dataspace, of a pixel 1/res
    const pxPitch = Vec2.div(Box2D.size(relativeView), displayResolution);
    const dstToDesired = (a: vec2, goal: vec2) => {
        const diff = Vec2.sub(a, goal);
        if (diff[0] * diff[1] > 0) {
            // the res (a) is higher than our goal -
            // weight this heavily to prefer smaller than the goal
            return 1000 * Vec2.length(Vec2.sub(a, goal));
        }
        return Vec2.length(Vec2.sub(a, goal));
    };
    // we assume the datasets are ordered... hmmm TODO
    const choice = datasets.reduce(
        (bestSoFar, cur) =>
            dstToDesired(vxlPitch(planeSizeInVoxels(plane, axes, bestSoFar)!), pxPitch) >
            dstToDesired(vxlPitch(planeSizeInVoxels(plane, axes, cur)!), pxPitch)
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
    plane:
        | AxisAlignedPlane
        | {
              u: OmeDimension;
              v: OmeDimension;
          },
    axes: readonly AxisDesc[],
    dataset: DatasetWithShape
): vec2 | undefined {
    const planeUV = typeof plane === 'string' ? uvForPlane(plane) : plane;
    const vxls = planeSizeInVoxels(planeUV, axes, dataset);

    if (vxls === undefined) return undefined;
    let size: vec2 = vxls;
    // now, just apply the correct transforms, if they exist...

    dataset.coordinateTransformations.forEach((trn) => {
        if (isScaleTransform(trn)) {
            // try to apply it!
            const uIndex = indexOfDimension(axes, planeUV.u);
            const vIndex = indexOfDimension(axes, planeUV.v);
            size = Vec2.mul(size, [trn.scale[uIndex], trn.scale[vIndex]]);
        }
    });
    return size;
}
export function sizeInVoxels(dim: OmeDimension, axes: readonly AxisDesc[], dataset: DatasetWithShape) {
    const uI = indexFor(dim, axes);
    if (uI === -1) return undefined;

    return dataset.shape[uI];
}
export function planeSizeInVoxels(
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
        throw new Error('request does not match expected dimensions of ome-zarr dataset!');
    }

    return ordered.map((d, i) => {
        const bounds = { min: 0, max: shape[i] };
        if (d === null) {
            return d;
        } else if (typeof d === 'number') {
            return limit(bounds, d);
        }
        return zarr.slice(limit(bounds, d.min), limit(bounds, d.max));
    });
}

export async function explain(z: ZarrDataset) {
    console.dir(z);
    const root = zarr.root(new zarr.FetchStore(z.url));
    for (const d of z.multiscales[0].datasets) {
        zarr.open(root.resolve(d.path), { kind: 'array' }).then((arr) => {
            console.dir(arr);
        });
    }
}

export function indexOfDimension(axes: readonly AxisDesc[], dim: OmeDimension) {
    return axes.findIndex((ax) => ax.name === dim);
}
export async function getSlice(metadata: ZarrDataset, r: ZarrRequest, layerIndex: number) {
    // put the request in native order
    const root = zarr.root(new zarr.FetchStore(metadata.url));
    const scene = metadata.multiscales[0];
    const { axes } = scene;
    const level = scene.datasets[layerIndex] ?? scene.datasets[scene.datasets.length - 1];
    const arr = await zarr.open(root.resolve(level.path), { kind: 'array' });
    const result = await zarr.get(arr, buildQuery(r, axes, level.shape));
    if (typeof result == 'number') {
        throw new Error('oh noes, slice came back all weird');
    }
    return {
        shape: result.shape,
        buffer: result,
    };
}
export async function load(url: string) {
    return loadMetadata(url);
}
