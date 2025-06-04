import { Box2D, type box2D, type vec2 } from '@alleninstitute/vis-geometry';
import { useContext, useEffect, useRef, useState, type ComponentType } from 'react';
import { pan, zoom } from '../common/camera';

type Camera = {
    camera: {
        view: box2D;
        screenSize: vec2;
    };
};
export type HandlerProps = {
    onWheel?: (e: WheelEvent) => void;
    onMouseDown?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseUp?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseMove?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
    onMouseLeave?: (e: React.MouseEvent<HTMLCanvasElement>) => void;
};
type InnerProps<T extends Camera> = HandlerProps & T;
type Props<T extends Camera> = Omit<T, 'camera'> & {
    screenSize: vec2;
    Thing: ComponentType<InnerProps<T>>;
};
export function CameraHelper<T extends Camera>(props: Props<T>) {
    const { screenSize, Thing } = props;
    const [view, setView] = useState<box2D>(Box2D.create([0, 0], [10000, 10000]));
    const [dragging, setDragging] = useState(false);

    const handleZoom = (e: WheelEvent) => {
        e.preventDefault();
        const zoomScale = e.deltaY > 0 ? 1.1 : 0.9;
        const v = zoom(view, screenSize, zoomScale, [e.offsetX, e.offsetY]);
        setView(v);
    };

    const handlePan = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (dragging) {
            const v = pan(view, screenSize, [e.movementX, e.movementY]);
            setView(v);
        }
    };

    const handleMouseDown = () => {
        setDragging(true);
    };

    const handleMouseUp = () => {
        setDragging(false);
    };

    return (
        //@ts-expect-error I've stared at this for a while... its fine
        <Thing
            {...props}
            camera={{ view, screenSize }}
            onMouseDown={handleMouseDown}
            onMouseUp={handleMouseUp}
            onMouseMove={handlePan}
            onMouseLeave={handleMouseUp}
            onWheel={handleZoom}
        />
    );
}
