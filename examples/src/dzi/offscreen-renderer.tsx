import type { CacheContentType } from '@alleninstitute/vis-dzi';
import { AsyncDataCache } from '@alleninstitute/vis-scatterbrain';
import { createContext, useEffect, useRef, type PropsWithChildren } from 'react';
import REGL from 'regl';

type Fancy = {
    regl: REGL.Regl | null;
    cache: AsyncDataCache<string, string, CacheContentType> | null;
    canvas: OffscreenCanvas | null;
};
export const reglContext = createContext<Fancy>({ regl: null, cache: null, canvas: null });

function destroyer(item: CacheContentType) {
    switch (item.type) {
        case 'texture2D':
            item.data.destroy();
            break;
    }
}

export function ReglProvider(props: PropsWithChildren<{}>) {
    const canvas = useRef<OffscreenCanvas>();
    const cache = useRef<AsyncDataCache<string, string, CacheContentType>>();
    const reglCtx = useRef<REGL.Regl>();
    const { children } = props;
    useEffect(() => {
        canvas.current = new OffscreenCanvas(2048, 2048);
        const gl = canvas.current.getContext('webgl', {
            alpha: true,
            preserveDrawingBuffer: true,
            antialias: true,
            premultipliedAlpha: true,
        });
        if (!gl) {
            throw new Error('WebGL not supported!');
        }
        cache.current = new AsyncDataCache(destroyer, () => 1, 999);
        const regl = REGL({
            gl,
            extensions: ['ANGLE_instanced_arrays', 'OES_texture_float', 'WEBGL_color_buffer_float'],
        });
        console.log('offscreen webGL / REGL created!', regl);
        reglCtx.current = regl;
    }, []);
    return (
        <reglContext.Provider
            value={{ regl: reglCtx.current ?? null, cache: cache.current ?? null, canvas: canvas.current ?? null }}
        >
            {children}
        </reglContext.Provider>
    );
}
