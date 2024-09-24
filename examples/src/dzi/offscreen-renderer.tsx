import { RenderServer } from '@alleninstitute/vis-scatterbrain';
import React, { createContext, useEffect, useRef, type PropsWithChildren } from 'react';

export const renderServerContext = createContext<RenderServer | null>(null);

export function ReglProvider(props: PropsWithChildren<{}>) {
    const server = useRef<RenderServer>();
    const { children } = props;
    useEffect(() => {
        server.current = new RenderServer([4096, 4096]);
    }, []);
    return <renderServerContext.Provider value={server.current ?? null}>{children}</renderServerContext.Provider>;
}
