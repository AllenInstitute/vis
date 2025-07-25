/** biome-ignore-all lint/correctness/useExhaustiveDependencies: <this is a demo, but not a demo of correct react-hook useage!> */
import { Box2D, composeRotation, type AxisAngle, type vec2 } from '@alleninstitute/vis-geometry';
import { useContext, useState, useRef, useCallback, useEffect } from 'react';
import { zoom, pan } from '../common/camera';
import { SharedCacheContext } from '../common/react/priority-cache-provider';
import { buildAnalyzer, buildConnectedRenderer, type Settings } from './ctxg';
import { loadDataset, loadScatterbrainJson } from '../common/loaders/scatterplot/scatterbrain-loader';

type Props = {
  screenSize: vec2;
  url: string;
  category: string;
  rows: number[];
  genes: number[];
};
export function HeatmapView(props: Props) {
  const { screenSize } = props;
  const server = useContext(SharedCacheContext);
  const [scatterplot, setScatterplot] = useState<ReturnType<typeof loadDataset> | null>(null);
  const [view, setView] = useState(Box2D.create([0, 0], [1, 1]));
  const [dragging, setDragging] = useState(false);
  const [rotation, setRotation] = useState<AxisAngle>({ axis: [0, 1, 0], radians: 0 });
  const [renderer, setRenderer] = useState<ReturnType<typeof buildConnectedRenderer>>();
  const [tick, setTick] = useState<number>(0);
  const cnvs = useRef<HTMLCanvasElement>(null);

  const load = async (url: string) => {
    return loadScatterbrainJson(url).then((metadata) => loadDataset(metadata, url));
  };

  // you could put this on the mouse wheel, but for this demo we'll have buttons

  const handleZoom = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();

      const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;
      const v = zoom(view, screenSize, zoomScale, [e.offsetX, e.offsetY]);
      setView(v);
    },
    [view, screenSize]
  );

  const handlePan = (e: React.MouseEvent) => {
    if (dragging) {
      // you can combine these, but its actually super annoying
      if (e.altKey) {
        setRotation(composeRotation({ axis: [1, 0, 0], radians: e.movementY / 100.0 }, rotation));
      } else if (e.ctrlKey) {
        setRotation(composeRotation({ axis: [0, 1, 0], radians: e.movementX / 100.0 }, rotation));
      } else {
        const v = pan(view, screenSize, [e.movementX, e.movementY]);
        setView(v);
      }
    }
  };

  const handleMouseDown = () => {
    setDragging(true);
  };

  const handleMouseUp = () => {
    setDragging(false);
  };
  useEffect(() => {
    if (cnvs.current && server && !renderer) {
      const { regl, cache } = server;
      const renderer = buildConnectedRenderer(regl, cache, () => {
        requestAnimationFrame(() => {
          setTick(performance.now());
        });
      });
      // initialize our testing thingy!

      setRenderer(renderer);
      load(props.url).then((data) => {
        setScatterplot(data);
        setView(Box2D.create([0, 0], [10, 10]));
      });
    }
  }, [cnvs.current]);

  useEffect(() => {
    if (scatterplot && cnvs.current && renderer && server) {
      const ctx = cnvs.current.getContext('2d');
      const settings: Parameters<typeof renderer.render>[1] = {
        cellSize: [1, 1],
        geneIndexes: props.genes.map((id) => id.toFixed(0)),
        rowCategory: props.category,
        rowFilterValues: props.rows,
        view,
        rotation,
      };
      if (ctx) {
        // if (!window.doCount) {
        //   const setup = buildAnalyzer(server.cache, () => {});
        //   const doCount = setup(
        //     { metadata: scatterplot, url: props.url },
        //     { geneIndexes: ['3461'], rowCategory: '8RBF4DUUJ5SW83JZYW8' }
        //   );
        //   window.doCount = doCount;
        // }

        renderer?.render({ metadata: scatterplot, url: props.url }, settings);
        requestAnimationFrame(() => {
          renderer?.copyPixels(ctx);
        });
      }
    }
  }, [scatterplot, view, tick, rotation]);

  useEffect(() => {
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
