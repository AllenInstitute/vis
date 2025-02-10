import React from 'react';
import {
	buildAsyncOmezarrRenderer,
	type ZarrDataset,
	type VoxelTile,
	defaultDecoder,
	type RenderSettings,
	type OmeZarrDataset,
} from '@alleninstitute/vis-omezarr';
import { type RenderFrameFn } from '@alleninstitute/vis-scatterbrain';
import { useContext, useEffect, useRef } from 'react';
import type { vec2, box2D } from '@alleninstitute/vis-geometry';
import { renderServerContext } from '~/common/react/render-server-provider';

interface OmezarrViewerProps {
	omezarr: OmeZarrDataset;
	id: string;
	screenSize: vec2;
	settings: RenderSettings;
	onWheel?: (e: WheelEvent) => void;
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
		if (server && server.regl) {
			renderer.current = buildAsyncOmezarrRenderer(server.regl, defaultDecoder);
		}
		return () => {
			if (c) {
				server?.destroyClient(c);
			}
		};
	}, [server]);

	// render frames
	useEffect(() => {
		if (server && renderer.current && canvas.current && omezarr) {
			const hey: RenderFrameFn<ZarrDataset, VoxelTile> = (target, cache, callback) => {
				if (renderer.current) {
					return renderer.current(omezarr, settings, callback, target, cache);
				}
				return null;
			};

			server.beginRendering(
				hey,
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
						default: {
							break;
						}
					}
				},
				canvas.current,
			);
		}
	}, [server, renderer, canvas, omezarr, settings]);

	// wheel event needs to be active for control + wheel zoom to work
	useEffect(() => {
		const c = canvas.current;
		const handleWheel = (e: WheelEvent) => onWheel?.(e);
		if (c) {
			c.addEventListener('wheel', handleWheel, { passive: false });
		}
		return () => {
			if (c) {
				c.removeEventListener('wheel', handleWheel);
			}
		};
	});

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
		/>
	);
}
