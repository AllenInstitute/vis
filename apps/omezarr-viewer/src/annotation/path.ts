import type { vec2, vec4 } from "@vis/geometry"

export type Point = {
    point: vec2;
    pressure?: number;
}
// type SLLNode<T> = {
//     item: T;
//     next: SLLNode<T> | null;
// }
// type SLL<T> = {
//     head: SLLNode<T>|null;
//     tail: SLLNode<T>|null;
//     length
// }
export type Pen = {
    color: vec4;
    strokeWidth: number;
}
export type PathAnnotation = {
    path: Point[];
    pen: Pen;
}

// make a set of handlers that make a thing drawable...


// how would we generify drawing on top of something...
export type DrawingHost = {
    updateCurrentStroke: (point: Point) => void;
    newStroke: (point: Point) => void;
    // endStroke?
    currentTool: () => Pen | 'camera';
    pan: (screenDelta: vec2) => void;
    screenToDataSpace: (screen: vec2) => vec2;
    screenWidthToDataWidth: (w: number) => number;
}

export function initDrawableInterface(surface: HTMLElement, host: DrawingHost) {
    let buttonDown: boolean = false;
    let curPointerId: number | null;

    surface.onpointermove = (ev: PointerEvent) => {
        if (buttonDown && ev.pointerId === curPointerId) {
            if (host.currentTool() == 'camera') {
                // pan that camera!
                host.pan([ev.movementX, ev.movementY])
            } else {
                // draw with our current pen... hmmmm
                host.updateCurrentStroke({
                    point: host.screenToDataSpace([ev.x, ev.y]),
                    pressure: ev.pressure
                })
            }
        }
    }
    surface.onpointerdown = (ev: PointerEvent) => {
        if (curPointerId === null) {
            curPointerId = ev.pointerId;
            buttonDown = true;
            if (host.currentTool() !== 'camera') {
                host.newStroke({
                    point: host.screenToDataSpace([ev.x, ev.y]),
                    pressure: ev.pressure
                })
            }
        }
    }
    surface.onpointerup = (ev: PointerEvent) => {
        if (curPointerId === ev.pointerId) {
            curPointerId = null;
            buttonDown = false;
        }
    }


    return () => {
        // cleanup!
        // todo!
    }
}

// export function beginDrawing(pen: Pen, p: vec2, pressure?: number): PathAnnotation {
//     return {
//         pen,
//         path: [{
//             point: p,
//             pressure: pressure ?? 1.0
//         }]
//     }
// }
// export function continueDrawing(annotation: PathAnnotation, p: vec2, pressure?: number): PathAnnotation {
//     return {
//         ...annotation, path: [...annotation.path, {
//             point: p,
//             pressure: pressure ?? 1.0
//         }]
//     }
// }
