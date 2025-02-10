import { type box2D, Box2D, Vec2 } from "@alleninstitute/vis-geometry";
import {
	buildAsyncOmezarrRenderer,
	defaultDecoder,
	type VoxelTile,
	type ZarrDataset,
	type RenderSettings,
} from "@alleninstitute/vis-omezarr";
import type { RenderFrameFn } from "@alleninstitute/vis-scatterbrain";
import React, { useCallback, useState } from "react";
import { useContext, useEffect, useRef } from "react";
import { renderServerContext } from "~/common/react/render-server-provider";
type Props = {
	omezarr: ZarrDataset | undefined;
};
const settings: RenderSettings = {
	tileSize: 256,
	// in a "real" app, you'd most likely expose sliders to control how the data in the file
	// gets mapped to pixel/color intensity on the screen. for now, we just use hardcoded data
	gamut: {
		R: { gamut: { min: 0, max: 80 }, index: 0 },
		G: { gamut: { min: 0, max: 100 }, index: 1 },
		B: { gamut: { min: 0, max: 100 }, index: 2 },
	},
	plane: "xy",
	planeIndex: 3,
	camera: {
		// the omezarr renderer expects a box in whatever space is given by the omezarr file itself in its
		// axes metadata = for example, millimeters. if you load a volume that says its 30mm X 30mm X 10mm,
		// and you want to view XY slices and have them fit perfectly on your screen, then a box
		// like [0,0],[30,30] would be appropriate!
		view: Box2D.create([0, 0], [250, 120]),
		screenSize: [500, 500],
	},
};
// this example uses the RenderServer utility - this lets you render to canvas elements without having to
// initialize WebGL on that canvas itself, at a small cost to performance. the compose function is the configurable
// step used to get the pixels from WebGL to the target canvas.
function compose(ctx: CanvasRenderingContext2D, image: ImageData) {
	ctx.putImageData(image, 0, 0);
}

export function SliceView(props: Props) {
	const { omezarr } = props;
	const server = useContext(renderServerContext);
	const cnvs = useRef<HTMLCanvasElement>(null);
	const renderer = useRef<ReturnType<typeof buildAsyncOmezarrRenderer>>();
	const [view, setView] = useState<box2D>(Box2D.create([0, 0], [250, 120]));
	useEffect(() => {
		if (server && server.regl) {
			renderer.current = buildAsyncOmezarrRenderer(server.regl, defaultDecoder);
		}
		return () => {
			if (cnvs.current) {
				server?.destroyClient(cnvs.current);
			}
		};
	}, [server]);

	useEffect(() => {
		if (server && renderer.current && cnvs.current && omezarr) {
			const renderFn: RenderFrameFn<ZarrDataset, VoxelTile> = (
				target,
				cache,
				callback,
			) => {
				if (renderer.current) {
					return renderer.current(
						omezarr,
						{ ...settings, camera: { ...settings.camera, view } },
						callback,
						target,
						cache,
					);
				}
				return null;
			};
			server.beginRendering(
				renderFn,
				// here's where we handle lifecycle events in that rendering function (its async and slow because it may have to fetch data from far away)
				(e) => {
					switch (e.status) {
						case "begin":
							server.regl?.clear({
								framebuffer: e.target,
								color: [0, 0, 0, 0],
								depth: 1,
							});
							break;
						case "progress":
							e.server.copyToClient(compose);
							break;
						case "finished": {
							// the bare minimum event handling would be this: copy webGL's work to the target canvas using the compose function
							e.server.copyToClient(compose);
						}
					}
				},
				cnvs.current,
			);
		}
	}, [server, renderer.current, cnvs.current, omezarr, view]);
	const pan = useCallback(
		(e: React.MouseEvent<HTMLCanvasElement>) => {
			if (e.ctrlKey) {
				const pos = Vec2.div(
					[-e.movementX, -e.movementY],
					settings.camera.screenSize,
				);
				const scaledOffset = Vec2.mul(pos, Box2D.size(view));
				const v = Box2D.translate(view, scaledOffset);
				setView(v);
			}
		},
		[view],
	);
	return (
		<canvas
			id={"hey there"}
			ref={cnvs}
			onMouseMove={pan}
			onWheel={(e) => {
				const scale = e.deltaY > 0 ? 1.1 : 0.9;
				const m = Box2D.midpoint(view);
				const v = Box2D.translate(
					Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]),
					m,
				);
				setView(v);
			}}
			width={settings.camera.screenSize[0]}
			height={settings.camera.screenSize[1]}
		></canvas>
	);
}
