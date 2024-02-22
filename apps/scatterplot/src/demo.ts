import { Box2D, Vec2, type box2D, type vec2 } from "@alleninstitute/vis-geometry";
import type { AsyncDataCache } from "@alleninstitute/vis-scatterbrain";
import REGL from "regl";
class Demo {
    camera: {
        view: box2D;
        screen: vec2;
    }
    regl: REGL.Regl;
    canvas: HTMLCanvasElement;
    mouse: 'up' | 'down'
    mousePos: vec2;
    constructor(canvas: HTMLCanvasElement, regl: REGL.Regl) {
        const [w, h] = [canvas.clientWidth, canvas.clientHeight];
        this.camera = {
            view: Box2D.create([0, 0], [(10 * w) / h, 10]),
            screen: [w, h]
        }
        this.canvas = canvas;
        this.mouse = 'down'
        this.regl = regl;
        this.mousePos = [0, 0]
    }
    mouseButton(click: "up" | "down") {
        this.mouse = click;
    }
    mouseMove(delta: vec2) {
        if (this.mouse === "down") {
            // drag the view
            const { screen, view } = this.camera;
            const p = Vec2.div(delta, [this.canvas.clientWidth, this.canvas.clientHeight]);
            const c = Vec2.mul(p, Box2D.size(view));
            this.camera = { view: Box2D.translate(view, c), screen };
            this.rerender();
        }
        this.mousePos = Vec2.add(this.mousePos, delta);
    }
    zoom(scale: number) {
        const { view, screen } = this.camera;
        const m = Box2D.midpoint(view);
        this.camera = {
            view: Box2D.translate(Box2D.scale(Box2D.translate(view, Vec2.scale(m, -1)), [scale, scale]), m),
            screen,
        };
        this.rerender();
    }
    rerender() {
        this.regl.clear({ color: [0, 0, 0.2, 1], depth: 1 })
    }
}
let theDemo: Demo;
function demoTime() {
    const thing = document.getElementById("glCanvas") as HTMLCanvasElement;
    thing.width = 2000;
    thing.height = 2000;
    const gl = thing.getContext("webgl", {
        alpha: true,
        preserveDrawingBuffer: true,
        antialias: true,
        premultipliedAlpha: true,
    }) as WebGL2RenderingContext;
    const regl = REGL({
        gl,
        // attributes: {},
        extensions: ["ANGLE_instanced_arrays", "OES_texture_float", "WEBGL_color_buffer_float"],
    });
    const canvas: HTMLCanvasElement = regl._gl.canvas as HTMLCanvasElement;
    theDemo = new Demo(canvas, regl);

    setupEventHandlers(canvas, theDemo);
}


function setupEventHandlers(canvas: HTMLCanvasElement, demo: Demo) {
    canvas.onmousedown = (e: MouseEvent) => {
        demo.mouseButton("down");
    };
    canvas.onmouseup = (e: MouseEvent) => {
        demo.mouseButton("up");
    };
    canvas.onmousemove = (e: MouseEvent) => {
        // account for gl-origin vs. screen origin:
        demo.mouseMove([-e.movementX, -e.movementY]);
    };
    canvas.onwheel = (e: WheelEvent) => {
        demo.zoom(e.deltaY > 0 ? 1.1 : 0.9);
    };
}


demoTime();