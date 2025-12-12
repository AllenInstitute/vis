import type { vec2 } from '@alleninstitute/vis-geometry';
import { SharedCacheProvider } from '../common/react/priority-cache-provider';
import { useEffect, useRef } from 'react';

const screenSize: vec2 = [800, 800];

export function OmezarrDemo() {
    return (
        <SharedCacheProvider>
            <Demo screenSize={screenSize}></Demo>
        </SharedCacheProvider>
    );
}
type Props = {screenSize:vec2}
function Demo(props:Props) {
    const {screenSize} = props;
    const cnvs = useRef<HTMLCanvasElement>(null);
    // todo handlers, etc
    useEffect(()=>{
        // build the renderer
    },[cnvs.current])
    return (<canvas
                ref={cnvs}
                width={screenSize[0]}
                height={screenSize[1]}
            />)
}