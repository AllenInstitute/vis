import { logger } from '@alleninstitute/vis-core';
import { createContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';

export const GpuContext = createContext<GPUDevice | null>(null);

export function GpuDeviceProvider(props: PropsWithChildren) {
    const { children } = props;
    const [device, setDevice] = useState<GPUDevice | null>(null);
    useEffect(() => {
        navigator.gpu.requestAdapter().then((adapter) => {
            adapter?.requestDevice().then((dev) => setDevice(dev));
        });
        return () => {
            device?.destroy();
            logger.info('gpu device released');
        };
    }, []);
    return <GpuContext.Provider value={device ?? null}>{children}</GpuContext.Provider>;
}
