import { Box2D, type Interval, PLANE_XY, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import {
  type OmeZarrMetadata,
  type VoxelTile,
  buildOmeZarrSliceRenderer,
  loadMetadata,
  sizeInUnits,
} from '@alleninstitute/vis-omezarr';
import type { Decoder, RenderSettings, RenderSettingsChannels } from '@alleninstitute/vis-omezarr';
import {
  FancySharedCache,
  logger,
  type Resource,
  type CachedTexture,
  type WebResource,
} from '@alleninstitute/vis-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import { pan, zoom } from '../common/camera';
import REGL from 'regl';
import { multithreadedDecoder } from '../common/loaders/ome-zarr/sliceWorkerPool';
type DemoOption = { value: string; label: string; res: WebResource };

class Tex implements Resource {
  texture: CachedTexture;
  constructor(tx: CachedTexture) {
    this.texture = tx;
  }
  destroy() {
    this.texture.texture.destroy();
  }
  sizeInBytes() {
    return this.texture.bytes;
  }
}
type Thing = {
  tile: VoxelTile;
  dataset: OmeZarrMetadata;
  settings: RenderSettings;
};
function mapValues<T extends Record<string, V>, V, R>(obj: T, fn: (v: V) => R): { [k in keyof T]: R } {
  return Object.keys(obj).reduce((acc, k) => {
    return { ...acc, [k]: fn(obj[k]) };
  }, {} as { [k in keyof T]: R });
}

function buildConnectedRenderer(regl: REGL.Regl, cache: FancySharedCache, decoder: Decoder, onData: () => void) {
  //@ts-expect-error
  const renderer = buildOmeZarrSliceRenderer(regl, decoder);
  const client = cache.registerClient<Thing, Record<string, Tex>>({
    cacheKeys: (item) => {
      const channelKeys = Object.keys(item.settings.channels);
      return channelKeys.reduce((chans, key) => {
        return { ...chans, [key]: renderer.cacheKey(item.tile, key, item.dataset, item.settings) };
      }, {});
    },
    fetch: (item) => {
      // the Renderer<...> type obscures the fact that these are always cached textures... TODO  fix that?
      // for now, this typecast is legit
      const channels = renderer.fetchItemContent(item.tile, item.dataset, item.settings) as Record<
        string,
        (sig: AbortSignal) => Promise<CachedTexture>
      >;
      return mapValues(channels, (v: (sig: AbortSignal) => Promise<CachedTexture>) => {
        return (sig: AbortSignal) => v(sig).then((tex) => new Tex(tex));
      });
    },
    isValue: (v): v is Record<string, Tex> =>
      renderer.isPrepared(
        mapValues(v, (tx: Resource | undefined) => (tx && tx instanceof Tex ? tx.texture : undefined))
      ),
    onDataArrived: onData,
  });
  return {
    render: (target: REGL.Framebuffer2D | null, dataset: OmeZarrMetadata, settings: RenderSettings) => {
      const items = renderer.getVisibleItems(dataset, settings);
      const baselayer = renderer.getVisibleItems(dataset, {
        ...settings,
        camera: { ...settings.camera, screenSize: [1, 1] },
      });
      regl.clear({ framebuffer: target, color: [1, 0, 0, 1], depth: 1 });
      client.setPriorities(
        new Set(items.map((tile) => ({ tile, dataset, settings }))),
        new Set(baselayer.map((tile) => ({ tile, dataset, settings })))
      );
      for (const tile of [...baselayer, ...items]) {
        const drawme = client.get({ tile, dataset, settings });
        if (drawme !== undefined) {
          console.log('draw thing: ', tile.bounds);
          renderer.renderItem(
            target,
            tile,
            dataset,
            settings,
            mapValues(drawme, (d: Tex) => d.texture)
          );
        } else {
          console.log('cache miss: ', tile.bounds);
        }
      }
    },
    destroy: () => {
      client.unsubscribeFromCache();
    },
  };
}
class Demo {
  cache: FancySharedCache;
  regl: REGL.Regl;
  constructor(regl: REGL.Regl, cache: FancySharedCache) {
    this.cache = cache;
    this.regl = regl;
  }
}

const demoOptions: DemoOption[] = [
  {
    value: 'opt1',
    label: 'VERSA OME-Zarr Example (HTTPS) (color channels: [R, G, B])',
    res: { type: 'https', url: 'https://neuroglancer-vis-prototype.s3.amazonaws.com/VERSA/scratch/0500408166/' },
  },
  {
    value: 'opt2',
    label: 'VS200 Example Image (S3) (color channels: [CFP, YFP])',
    res: {
      type: 's3',
      region: 'us-west-2',
      url: 's3://allen-genetic-tools/epifluorescence/1401210938/ome_zarr_conversion/1401210938.zarr/',
    },
  },
  {
    value: 'opt3',
    label: 'EPI Example Image (S3) (color channels: [R, G, B])',
    res: {
      type: 's3',
      region: 'us-west-2',
      url: 's3://allen-genetic-tools/epifluorescence/1383646325/ome_zarr_conversion/1383646325.zarr/',
    },
  },
  {
    value: 'opt4',
    label: 'STPT Example Image (S3) (color channels: [R, G, B])',
    res: {
      type: 's3',
      region: 'us-west-2',
      url: 's3://allen-genetic-tools/tissuecyte/823818122/ome_zarr_conversion/823818122.zarr/',
    },
  },
];

const screenSize: vec2 = [800, 800];

const defaultInterval: Interval = { min: 0, max: 80 };

function makeZarrSettings(screenSize: vec2, view: box2D, orthoVal: number, omezarr: OmeZarrMetadata): RenderSettings {
  const omezarrChannels = omezarr.colorChannels.reduce((acc, val, index) => {
    acc[val.label ?? `${index}`] = {
      rgb: val.rgb,
      gamut: val.range,
      index,
    };
    return acc;
  }, {} as RenderSettingsChannels);

  const fallbackChannels: RenderSettingsChannels = {
    R: { rgb: [1.0, 0, 0], gamut: defaultInterval, index: 0 },
    G: { rgb: [0, 1.0, 0], gamut: defaultInterval, index: 1 },
    B: { rgb: [0, 0, 1.0], gamut: defaultInterval, index: 2 },
  };

  return {
    camera: { screenSize, view },
    orthoVal,
    plane: PLANE_XY,
    tileSize: 256,
    channels: Object.keys(omezarrChannels).length > 0 ? omezarrChannels : fallbackChannels,
  };
}

export function OmezarrDemo() {
  const [omezarr, setOmezarr] = useState<OmeZarrMetadata | null>(null);
  const [view, setView] = useState(Box2D.create([0, 0], [1, 1]));
  const [planeIndex, setPlaneIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [renderer, setRenderer] = useState<ReturnType<typeof buildConnectedRenderer>>();
  const [tick, setTick] = useState<number>(0);
  const cnvs = useRef<HTMLCanvasElement>(null);

  const load = (res: WebResource) => {
    loadMetadata(res).then((v) => {
      setOmezarr(v);
      setPlaneIndex(Math.floor(v.maxOrthogonal(PLANE_XY) / 2));
      const dataset = v.getFirstShapedDataset(0);
      if (!dataset) {
        throw new Error('dataset 0 does not exist!');
      }
      const size = sizeInUnits(PLANE_XY, v.attrs.multiscales[0].axes, dataset);
      if (size) {
        logger.info('size', size);
        setView(Box2D.create([0, 0], size));
      }
    });
  };

  // you could put this on the mouse wheel, but for this demo we'll have buttons
  const handlePlaneIndex = (next: 1 | -1) => {
    setPlaneIndex((prev) => Math.max(0, Math.min(prev + next, (omezarr?.maxOrthogonal(PLANE_XY) ?? 1) - 1)));
  };

  const handleZoom = (e: WheelEvent) => {
    e.preventDefault();
    const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;
    const v = zoom(view, screenSize, zoomScale, [e.offsetX, e.offsetY]);
    setView(v);
  };

  const handlePan = (e: any) => {
    if (dragging) {
      const v = pan(view, screenSize, [e.movementX, -e.movementY]);
      setView(v);
    }
  };

  const handleMouseDown = () => {
    setDragging(true);
  };

  const handleMouseUp = () => {
    setDragging(false);
  };
  useEffect(() => {
    if (cnvs.current) {
      // do all setup as soon as we have a canvas reference
      // cnvs.current.addEventListener('mousedown', handleMouseDown);
      // cnvs.current.addEventListener('mouseup', handleMouseUp);
      // cnvs.current.addEventListener('mousemove', handlePan);
      cnvs.current.addEventListener('wheel', handleZoom);
      const regl = REGL({ canvas: cnvs.current, extensions: ['oes_texture_float'] });
      const cache = new FancySharedCache(new Map(), 1024 * 1024 * 2000, 10);
      const renderer = buildConnectedRenderer(regl, cache, multithreadedDecoder, () => {
        console.log('tick???!');
        requestAnimationFrame(() => {
          console.log('tick!');
          setTick(performance.now());
        });
      });
      setRenderer(renderer);
      load(demoOptions[3].res);
    }
  }, [cnvs]);
  useEffect(() => {
    if (omezarr && cnvs.current) {
      const settings = makeZarrSettings(screenSize, view, planeIndex, omezarr);
      console.log('draw with settings: ', settings);

      renderer?.render(null, omezarr, settings);
    }
  }, [omezarr, planeIndex, view, tick]);
  useEffect(() => {
    // const handleWheel = (e: WheelEvent) => onWheel?.(e);
    if (cnvs?.current) {
      cnvs.current.addEventListener('wheel', handleZoom, { passive: false });
    }
    return () => {
      if (cnvs?.current) {
        cnvs.current.removeEventListener('wheel', handleZoom);
      }
    };
  }, [handleZoom]);
  return (
    <div
      style={{
        display: 'block',
        width: screenSize[0],
        height: screenSize[1],
        backgroundColor: '#777',
      }}
    >
      <canvas
        ref={cnvs}
        width={screenSize[0]}
        height={screenSize[1]}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handlePan}
      />
    </div>
  );
}
