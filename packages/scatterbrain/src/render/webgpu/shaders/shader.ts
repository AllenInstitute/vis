/**
 * This file defines the `WGSLShader` class, which represents a shader program in WGSL. 
 * It includes methods for serializing and deserializing the shader definition, as well 
 * as generating the WGSL source code from the defined declarations. The `shader` 
 * function is a simple helper function for creating a new `WGSLShader` instance from an
 * array of declarations.
 */

import type { Declaration } from "./declarations";

export class WGSLShader {
    #definition: { declarations: Declaration[] };

    constructor(declarations: Declaration[]) {
        this.#definition = { declarations };
    }

    static deserialize(serialized: string): WGSLShader {
        const definition = JSON.parse(serialized);
        return new WGSLShader(definition.declarations);
    }

    serialize(): string {
        return JSON.stringify(this.#definition);
    }

    asSource(): string {
        return this.#definition.declarations.map((d) => d.__gen()).join(';\n');
    }
}

export function shader(declarations: Declaration[]): WGSLShader {
    return new WGSLShader(declarations);
}
