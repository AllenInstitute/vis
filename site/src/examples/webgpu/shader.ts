/**
 * Shader program for the demo: a shared camera uniform + a per-shape instance uniform (model
 * matrix + color), a single `position` vertex attribute, and vertex/fragment entry points. The
 * fragment stage reconstructs a flat per-face normal from screen-space derivatives for cheap
 * lambert shading, so no normal attribute is needed.
 */

import * as webgpu from '@alleninstitute/vis-core/src/rendering/webgpu';

const {
    bindings,
    buffer,
    builtin,
    fragmentEntry,
    group,
    location,
    member,
    param,
    returns,
    shader,
    slot,
    struct,
    vertexInput,
    vertexLayout,
} = webgpu;

/** Host-side shape of the shared `Camera` uniform (`mat4x4f` → 16 column-major floats). */
export type CameraUniforms = { viewProj: Float32Array };
/** Host-side shape of the per-shape `Instance` uniform. */
export type InstanceUniforms = { model: Float32Array; color: readonly number[] };

/** Build the shader program + binding graph + slots + vertex layout used by the renderer. */
export function buildShaderProgram() {
    const Camera = struct<CameraUniforms>('Camera', [member('viewProj', 'mat4x4f')]);
    const Instance = struct<InstanceUniforms>('Instance', [member('model', 'mat4x4f'), member('color', 'vec4f')]);

    // Shared camera (binding 0) + per-shape instance (binding 1), both in group 0.
    const cameraSlot = slot.uniform<CameraUniforms>('camera', Camera);
    const instanceSlot = slot.uniform<InstanceUniforms>('instance', Instance);

    // Vertex input: a single `position` attribute at @location(0).
    const VertexIn = struct('VertexIn', [member('position', 'vec3f', [location(0)])]);
    const VertexOut = struct('VertexOut', [
        member('clip', 'vec4f', [builtin('position')]),
        member('world', 'vec3f', [location(0)]),
    ]);

    const vin = vertexInput([param('vtx', VertexIn)]);

    const vs = vin.entry(
        'vs_main',
        () => `
            let world = (instance.model * vec4f(vtx.position, 1.0)).xyz;
            var out: VertexOut;
            out.world = world;
            out.clip = camera.viewProj * vec4f(world, 1.0);
            return out;
        `,
        returns(VertexOut)
    );

    const fs = fragmentEntry(
        'fs_main',
        [param('frag', VertexOut)],
        () => `
            // Flat face normal from screen-space derivatives of the world position.
            let normal = normalize(cross(dpdx(frag.world), dpdy(frag.world)));
            let lightDir = normalize(vec3f(0.4, 0.8, 0.6));
            let diffuse = clamp(dot(normal, lightDir), 0.0, 1.0);
            let shade = 0.25 + 0.75 * diffuse;
            return vec4f(instance.color.rgb * shade, instance.color.a);
        `,
        returns('vec4f', [location(0)])
    );

    const program = shader([Camera, Instance, VertexIn, VertexOut, cameraSlot, instanceSlot, vs, fs]);
    const graph = bindings(group(cameraSlot, instanceSlot), program);
    const layout = vertexLayout(vin, [buffer('vertex', [0])]);

    return { program, graph, cameraSlot, instanceSlot, layout };
}
