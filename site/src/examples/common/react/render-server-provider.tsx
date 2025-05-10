import { logger, RenderServer } from '@alleninstitute/vis-core';
import { createContext, useEffect, useRef, type PropsWithChildren } from 'react';

export const renderServerContext = createContext<RenderServer | null>(null);

export function RenderServerProvider(props: PropsWithChildren) {
    const server = useRef<RenderServer>(undefined);
    const { children } = props;
    useEffect(() => {
        server.current = new RenderServer([2048, 2048], ['oes_texture_float']);
        logger.info('server started...');
    }, []);
    return <renderServerContext.Provider value={server.current ?? null}>{children}</renderServerContext.Provider>;
}
