import type { box2D, vec2 } from '@alleninstitute/vis-geometry';
import {
  type RenderSettings,
  type VoxelTile,
  type OmeZarrMetadata,
  buildAsyncOmezarrRenderer,
} from '@alleninstitute/vis-omezarr';
import type { RenderFrameFn } from '@alleninstitute/vis-core';
import { useContext, useEffect, useRef } from 'react';
import { renderServerContext } from '~/common/react/render-server-provider';
import { multithreadedDecoder } from '~/common/loaders/ome-zarr/sliceWorkerPool';

interface OmezarrViewerProps {
  omezarr: OmeZarrMetadata;
  id: string;
  screenSize: vec2;
  settings: RenderSettings;
  onWheel?: (e: React.WheelEvent<HTMLCanvasElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
}

export type OmezarrViewerState = {
  planeIndex: number;
  view: box2D;
};

function compose(ctx: CanvasRenderingContext2D, image: ImageData) {
  ctx.putImageData(image, 0, 0);
}

export function OmezarrViewer({
  omezarr,
  id,
  settings,
  onWheel,
  onMouseDown,
  onMouseUp,
  onMouseMove,
  onMouseLeave,
}: OmezarrViewerProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const server = useContext(renderServerContext);
  const renderer = useRef<ReturnType<typeof buildAsyncOmezarrRenderer>>();

  // setup renderer and delete it when component goes away
  useEffect(() => {
    const c = canvas?.current;
    if (server?.regl && omezarr) {
      const numChannels = omezarr.colorChannels.length || 3;
      renderer.current = buildAsyncOmezarrRenderer(server.regl, multithreadedDecoder, { numChannels });
    }
    return () => {
      if (c) {
        server?.destroyClient(c);
      }
    };
  }, [server, omezarr]);

  // render frames
  useEffect(() => {
    if (server && renderer.current && canvas.current && omezarr) {
      const renderFrame: RenderFrameFn<OmeZarrMetadata, VoxelTile> = (target, cache, callback) => {
        if (renderer.current) {
          return renderer.current(omezarr, settings, callback, target, cache);
        }
        return null;
      };

      server.beginRendering(
        renderFrame,
        (e) => {
          switch (e.status) {
            case 'begin':
              server.regl?.clear({
                framebuffer: e.target,
                color: [0, 0, 0, 0],
                depth: 1,
              });
              break;
            case 'progress':
              // wanna see the tiles as they arrive?
              e.server.copyToClient(compose);
              break;
            case 'finished': {
              e.server.copyToClient(compose);
              break;
            }
            case 'cancelled':
              console.log('frame cancelled!');
              break;
            default: {
              break;
            }
          }
        },
        canvas.current
      );
    }
  }, [server, omezarr, settings]);

  return (
    <canvas
      id={id}
      ref={canvas}
      width={settings.camera.screenSize[0]}
      height={settings.camera.screenSize[1]}
      onMouseDown={onMouseDown}
      onMouseUp={onMouseUp}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onWheel={onWheel}
    />
  );
}
