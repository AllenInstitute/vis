import { logger, RenderServer } from '@alleninstitute/vis-core';
import { createContext, useState, type PropsWithChildren } from 'react';

export const renderServerContext = createContext<RenderServer | null>(null);

export function RenderServerProvider(props: PropsWithChildren) {
    const [server] = useState<RenderServer>(() => {
        const s = new RenderServer([2048, 2048], ['oes_texture_float']);
        logger.info('server started...');
        return s;
    });
    const { children } = props;
    return <renderServerContext.Provider value={server}>{children}</renderServerContext.Provider>;
}
