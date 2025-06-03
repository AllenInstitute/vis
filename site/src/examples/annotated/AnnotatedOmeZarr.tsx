import { Box3D, CartesianPlane, Vec2, type box2D, type Interval, type vec2 } from '@alleninstitute/vis-geometry';
import type { RenderFrameFn, RenderServer, buildAsyncRenderer } from '@alleninstitute/vis-core';
import {
  buildAsyncNGPointRenderer,
  type AnnotationChunk,
  type PointAnnotationInfo,
} from '@alleninstitute/vis-precomputed';
import { buildAsyncOmezarrRenderer, OmeZarrMetadata, type RenderSettingsChannels } from '@alleninstitute/vis-omezarr';
import { multithreadedDecoder } from '../common/loaders/ome-zarr/sliceWorkerPool';
import { CameraHelper, type HandlerProps } from './CameraHelper';
import { RenderClientHelper, type ServerRenderer } from './ClientHelper';

const compose = (ctx: CanvasRenderingContext2D, image: ImageData) => {
  ctx.putImageData(image, 0, 0);
};

class AnnotatedVolumeRenderer implements ServerRenderer<RenderProps & { cnvs: HTMLCanvasElement }> {
  omeRenderer: ReturnType<typeof buildAsyncOmezarrRenderer>;
  annoRenderer: ReturnType<typeof buildAsyncNGPointRenderer>;
  s: RenderServer;
  constructor(server: RenderServer) {
    this.s = server;
    this.omeRenderer = buildAsyncOmezarrRenderer(server.regl, multithreadedDecoder, {
      numChannels: 1,
      queueOptions: { maximumInflightAsyncTasks: 2 },
    });
    this.annoRenderer = buildAsyncNGPointRenderer(server.regl);
  }
  renderWithServer(props: RenderProps & { cnvs: HTMLCanvasElement }): void {
    const { camera, points, img, cnvs } = props;
    const { view } = camera;
    const channels = img.colorChannels.reduce((acc, val, index) => {
      acc[val.label ?? `${index}`] = {
        rgb: val.rgb,
        gamut: val.range,
        index,
      };
      return acc;
    }, {} as RenderSettingsChannels);
    const defaultInterval: Interval = { min: 0, max: 80 };
    const fallbackChannels: RenderSettingsChannels = {
      R: { rgb: [1.0, 0, 0], gamut: defaultInterval, index: 0 },
      G: { rgb: [0, 1.0, 0], gamut: defaultInterval, index: 1 },
      B: { rgb: [0, 0, 1.0], gamut: defaultInterval, index: 2 },
    };
    const renderPoints: RenderFrameFn<unknown, unknown> = (target, cache, callback) => {
      this.s.regl.clear({ framebuffer: target, color: [0.3, 0, 0, 1], depth: 1 });
      const rp = this.annoRenderer(
        points,
        {
          camera: { ...camera, view: Box3D.create([...view.minCorner, -1000], [...view.maxCorner, 1000]) },
          color: [1, 1, 0],
          outlineColor: [0, 0, 0],
          lodThreshold: 10,
          xyz: ['x', 'y', 'z'],
        },
        callback,
        target,
        cache
      );
      const op = this.omeRenderer(
        img,
        {
          camera,
          channels: Object.keys(channels).length > 0 ? channels : fallbackChannels,
          orthoVal: 200,
          plane: new CartesianPlane('xy'),
          tileSize: 256,
        },
        callback,
        target,
        cache
      );
      // return a lifecycle thingy that would cancel both:
      return {
        cancelFrame(reason) {
          rp.cancelFrame(reason);
          op.cancelFrame(reason);
        },
      };
    };

    this.s.beginRendering(
      renderPoints,
      (e) => {
        if (e.status === 'progress' || e.status === 'finished') {
          e.server.copyToClient(compose);
        }
      },
      cnvs
    );
  }
}
type RenderProps = {
  camera: { view: box2D; screenSize: vec2 };
  points: PointAnnotationInfo;
  img: OmeZarrMetadata;
};
function makeRenderer(server: RenderServer) {
  return new AnnotatedVolumeRenderer(server);
}
function RenderVoxelsAndDots(props: HandlerProps & RenderProps & { width: number; height: number }) {
  return <RenderClientHelper {...props} newRenderer={makeRenderer} />;
}

export function AnnotatedOmeZarrView(props: { screenSize: vec2; points: PointAnnotationInfo; img: OmeZarrMetadata }) {
  const { points, img, screenSize } = props;
  return (
    <CameraHelper
      screenSize={screenSize}
      width={screenSize[0]}
      height={screenSize[1]}
      points={points}
      img={img}
      Thing={RenderVoxelsAndDots}
    />
  );
}
