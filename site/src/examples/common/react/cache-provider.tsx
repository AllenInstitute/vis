import { logger, SharedPriorityCache } from '@alleninstitute/vis-core';
import { createContext, useEffect, useRef, type PropsWithChildren } from 'react';

export const SharedCacheContext = createContext<SharedPriorityCache | null>(null);

export function SharedCacheProvider(props: PropsWithChildren) {
    const state = useRef<SharedPriorityCache>(undefined);
    const { children } = props;
    if (!state.current) {
        logger.info('server started...');
        state.current = new SharedPriorityCache(new Map(), 2000 * 1024 * 1024, 50);
    }
    useEffect(() => {
        return () => {
            logger.info('shared cache disposed...');
            state.current = undefined;
        };
    }, []);
    return <SharedCacheContext.Provider value={state.current ?? null}>{children}</SharedCacheContext.Provider>;
}
