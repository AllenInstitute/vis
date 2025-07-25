import { logger, SharedPriorityCache } from '@alleninstitute/vis-core';
import { createContext, useEffect, useRef, type PropsWithChildren } from 'react';
import REGL from 'regl';

export const SharedCacheContext = createContext<{
    regl: REGL.Regl;
    cache: SharedPriorityCache;
} | null>(null);

export function SharedCacheProvider(props: PropsWithChildren) {
    const state = useRef<StateHelper>(undefined);
    const { children } = props;
    if (!state.current) {
        logger.info('server started...');
        state.current = new StateHelper(2000 * 1024 * 1024, 50, ['oes_texture_float']);
    }
    useEffect(() => {
        return () => {
            logger.info('shared cache disposed');
            state.current?.destroy();
            state.current = undefined;
        };
    }, []);
    return <SharedCacheContext.Provider value={state.current ?? null}>{children}</SharedCacheContext.Provider>;
}

class StateHelper {
    regl: REGL.Regl;
    cache: SharedPriorityCache;
    constructor(limitInBytes: number, maxFetches: number, extensions: string[]) {
        const canvas = new OffscreenCanvas(10, 10);
        const gl = canvas.getContext('webgl', {
            alpha: true,
            preserveDrawingBuffer: false,
            antialias: true,
            premultipliedAlpha: true,
        });
        if (!gl) {
            throw new Error('WebGL not supported!');
        }
        const regl = REGL({
            gl,
            extensions,
        });
        this.regl = regl;
        this.cache = new SharedPriorityCache(new Map(), limitInBytes, maxFetches);
    }
    destroy() {
        this.regl.destroy();
    }
}
