// I'm sick of setting all this up over and over...

import { useContext, useEffect, useRef } from 'react';
import type { HandlerProps } from './CameraHelper';
import { RenderServer } from '@alleninstitute/vis-core';
import { renderServerContext } from '../common/react/render-server-provider';

export interface ServerRenderer<T> {
    renderWithServer(props: T & { cnvs: HTMLCanvasElement }): void;
}

type Props<T> = T &
    HandlerProps & {
        width: number;
        height: number;
        newRenderer: (server: RenderServer) => ServerRenderer<T>;
    };
export function RenderClientHelper<T>(props: Props<T>) {
    const { width, height, newRenderer, onMouseDown, onMouseLeave, onMouseMove, onMouseUp, onWheel, ...rest } = props;
    // add the handlers to our canvas, which we have to keep a reference to...
    const cnvs = useRef<HTMLCanvasElement>(null);
    const server = useContext(renderServerContext);
    const renderer = useRef<ServerRenderer<T> | undefined>(undefined);
    // we have to add the listener this way because onWheel is a passive listener by default
    // that means we can't preventDefault to stop scrolling
    useEffect(() => {
        const handleWheel = (e: WheelEvent) => onWheel?.(e);
        const canvas = cnvs;
        if (canvas?.current) {
            canvas.current.addEventListener('wheel', handleWheel, { passive: false });
        }
        return () => {
            if (canvas?.current) {
                canvas.current.removeEventListener('wheel', handleWheel);
            }
        };
    }, [onWheel]);

    // our once chance to initialize our renderer system
    useEffect(() => {
        if (server) {
            renderer.current = newRenderer(server);
        }
        return () => {
            if (server && cnvs.current) {
                server.destroyClient(cnvs.current);
            }
        };
    }, [server]);
    // something changed, render with GL
    useEffect(() => {
        if (server && renderer.current && cnvs.current) {
            renderer.current.renderWithServer({ ...props, cnvs: cnvs.current });
        }
    }, [...Object.values(rest)]);

    return (
        <canvas
            ref={cnvs}
            width={width}
            height={height}
            onMouseDown={onMouseDown}
            onMouseUp={onMouseUp}
            onMouseMove={onMouseMove}
            onMouseLeave={onMouseLeave}
        />
    );
}
