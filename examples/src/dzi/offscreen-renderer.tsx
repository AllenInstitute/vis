import { AsyncDataCache, RenderServer } from '@alleninstitute/vis-scatterbrain';
import { createContext, useEffect, useRef, type PropsWithChildren } from 'react';

export const reglContext = createContext<RenderServer | null>(null);

export function ReglProvider(props: PropsWithChildren<{}>) {
    const server = useRef<RenderServer>();
    const { children } = props;
    useEffect(() => {
        server.current = new RenderServer([1024, 1024], 5000);
    }, []);
    return <reglContext.Provider value={server.current}>{children}</reglContext.Provider>;
}
