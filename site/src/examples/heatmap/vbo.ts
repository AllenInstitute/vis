import type { Resource } from "@alleninstitute/vis-core";
import type REGL from "regl";

export class VBO implements Resource {
    vbo: REGL.Buffer;
    constructor(buff: REGL.Buffer) {
        this.vbo = buff;
    }
    destroy() {
        this.vbo.destroy();
    }
    sizeInBytes() {
        return 400_000;
    }
}