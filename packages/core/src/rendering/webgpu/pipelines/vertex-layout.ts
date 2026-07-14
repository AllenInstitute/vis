import type { VertexAttribute, VertexBufferLayout, VertexFormat, VertexStepMode } from '../native-types';
import { isBranded } from '../brand';
import {
    defaultVertexFormat,
    type VertexArrayKind,
    vertexFormatInfo,
} from '../shaders/vertex-format';
import type { VertexInputAttribute, VertexInputInterface } from '../shaders/vertex-interface';

// ---- Resolved layout data types --------------------------------------------------------------

/** A resolved attribute placed in a buffer: host name, wire format, and WGSL `@location`. */
export interface VertexAttributeDecl {
    readonly name: string;
    readonly format: VertexFormat;
    readonly location: number;
}

/** A resolved buffer: its step mode + the attributes packed into it (in order). */
export interface VertexBufferDecl {
    readonly stepMode: VertexStepMode;
    readonly attributes: readonly VertexAttributeDecl[];
}

/** Brand marking a resolved vertex-layout declaration. */
export const VERTEX_LAYOUT_BRAND: unique symbol = Symbol.for('vis-core.webgpu.VertexLayout');

/** The resolved layout: ordered buffers (index = WebGPU vertex buffer slot). Produced by
 *  `vertexLayout(...)`, consumed by pipeline state (`deriveVertexBufferLayouts`) and the typed
 *  drawable upload (`interleaveVertexBuffer`). */
export interface VertexLayoutDeclaration {
    readonly __brand: typeof VERTEX_LAYOUT_BRAND;
    readonly buffers: readonly VertexBufferDecl[];
}

/** Runtime discriminator for a `VertexLayoutDeclaration`. */
export function isVertexLayout(value: unknown): value is VertexLayoutDeclaration {
    return isBranded(value, VERTEX_LAYOUT_BRAND);
}

// ---- Layout authoring ------------------------------------------------------------------------

/** A reference to an interface attribute placed into a buffer: a bare `@location` (format
 *  defaulted from the WGSL type) or a `[location, format]` tuple to override the wire format. */
export type VertexAttributeRef = number | readonly [location: number, format: VertexFormat];

/** One buffer's grouping: its `stepMode` (default `'vertex'`) and the attributes it carries. */
export interface VertexBufferSpec {
    readonly stepMode?: VertexStepMode;
    readonly attributes: readonly VertexAttributeRef[];
}

/** Ergonomic `VertexBufferSpec` constructor: `buffer('instance', [2, [3, 'unorm8x4']])`. */
export function buffer(
    stepMode: VertexStepMode,
    attributes: readonly VertexAttributeRef[]
): VertexBufferSpec {
    return { stepMode, attributes };
}

function refParts(ref: VertexAttributeRef): readonly [number, VertexFormat | undefined] {
    return typeof ref === 'number' ? [ref, undefined] : [ref[0], ref[1]];
}

/**
 * Resolve a `VertexInputInterface` + buffer grouping into a concrete `VertexLayoutDeclaration`.
 *
 * Each attribute reference resolves to a `GPUVertexFormat` — defaulted from the interface
 * attribute's WGSL type, or taken from an explicit `[location, format]` override (validated to be
 * WGSL-type-compatible). Throws (aggregating every problem) when a referenced location is unknown,
 * placed more than once, format-incompatible, or when some interface `@location` attribute is left
 * unassigned. `@builtin` inputs are never placed (they aren't buffer-backed).
 *
 * Packing rules (WebGPU): attributes are packed tightly per buffer in listed order, each offset
 * aligned up to `min(4, componentByteSize)`; `arrayStride` is the packed size rounded up to a
 * multiple of 4; `stepMode` is omitted when `'vertex'` (the default) so a derived layout is
 * byte-for-byte identical to the hand-written equivalent, keeping the pipeline fingerprint stable.
 */
export function vertexLayout(
    vin: VertexInputInterface,
    specs: readonly VertexBufferSpec[]
): VertexLayoutDeclaration {
    const byLocation = new Map<number, VertexInputAttribute>();
    for (const a of vin.attributes) byLocation.set(a.location, a);

    const errors: string[] = [];
    const placed = new Set<number>();
    const buffers: VertexBufferDecl[] = [];

    for (const spec of specs) {
        if (spec.attributes.length === 0) {
            errors.push('a vertex buffer must reference at least one attribute.');
        }
        const attrs: VertexAttributeDecl[] = [];
        for (const ref of spec.attributes) {
            const [loc, overrideFmt] = refParts(ref);
            const vinAttr = byLocation.get(loc);
            if (vinAttr === undefined) {
                errors.push(`@location(${loc}) is not declared by the vertex input interface.`);
                continue;
            }
            if (placed.has(loc)) {
                errors.push(`@location(${loc}) ('${vinAttr.name}') is assigned to more than one buffer.`);
                continue;
            }
            placed.add(loc);

            let format: VertexFormat;
            if (overrideFmt !== undefined) {
                const meta = vertexFormatInfo(overrideFmt);
                if (meta.wgslType !== vinAttr.wgslType) {
                    errors.push(
                        `@location(${loc}) ('${vinAttr.name}'): format '${overrideFmt}' presents as WGSL ` +
                            `'${meta.wgslType}' but the input declares '${vinAttr.wgslType}'.`
                    );
                    continue;
                }
                format = overrideFmt;
            } else {
                const def = defaultVertexFormat(vinAttr.wgslType);
                if (def === undefined) {
                    errors.push(
                        `@location(${loc}) ('${vinAttr.name}'): no default GPUVertexFormat for WGSL type ` +
                            `'${vinAttr.wgslType}' — specify one explicitly, e.g. [${loc}, 'unorm8x4'].`
                    );
                    continue;
                }
                format = def;
            }
            attrs.push({ name: vinAttr.name, format, location: loc });
        }
        buffers.push({ stepMode: spec.stepMode ?? 'vertex', attributes: attrs });
    }

    for (const a of vin.attributes) {
        if (!placed.has(a.location)) {
            errors.push(`@location(${a.location}) ('${a.name}') is not assigned to any vertex buffer.`);
        }
    }

    if (errors.length > 0) {
        throw new Error(`vertexLayout: invalid layout:\n  - ${errors.join('\n  - ')}`);
    }

    return { __brand: VERTEX_LAYOUT_BRAND, buffers };
}

// ---- Packing + derivation --------------------------------------------------------------------

function alignUp(value: number, alignment: number): number {
    return Math.ceil(value / alignment) * alignment;
}

/** One attribute after packing: its host name, wire format, and computed byte offset. */
export interface PackedAttribute {
    readonly name: string;
    readonly format: VertexFormat;
    readonly offset: number;
    readonly location: number;
}

/** A single buffer's packing result: stride + per-attribute offsets (keyed by host name). */
export interface BufferPacking {
    readonly arrayStride: number;
    readonly stepMode: VertexBufferDecl['stepMode'];
    readonly attributes: readonly PackedAttribute[];
}

/** Compute tight offsets + stride for one buffer declaration. Shared by the pipeline-layout
 *  derivation and the drawable's typed upload packer. */
export function packVertexBuffer(buffer: VertexBufferDecl): BufferPacking {
    if (buffer.attributes.length === 0) {
        throw new Error('packVertexBuffer: a vertex buffer must declare at least one attribute.');
    }
    let offset = 0;
    const attributes: PackedAttribute[] = [];
    for (const attr of buffer.attributes) {
        const meta = vertexFormatInfo(attr.format);
        offset = alignUp(offset, meta.alignment);
        attributes.push({ name: attr.name, format: attr.format, offset, location: attr.location });
        offset += meta.byteSize;
    }
    return { arrayStride: alignUp(offset, 4), stepMode: buffer.stepMode, attributes };
}

/** Derive the concrete `GPUVertexBufferLayout[]` for pipeline state from a layout declaration. */
export function deriveVertexBufferLayouts(layout: VertexLayoutDeclaration): VertexBufferLayout[] {
    return layout.buffers.map((buf) => {
        const packed = packVertexBuffer(buf);
        const attributes: VertexAttribute[] = packed.attributes.map((a) => ({
            format: a.format,
            offset: a.offset,
            shaderLocation: a.location,
        }));
        return {
            arrayStride: packed.arrayStride,
            // Omit stepMode when 'vertex' (the WebGPU default) so derived layouts match hand-written
            // ones byte-for-byte, keeping the pipeline fingerprint stable.
            ...(packed.stepMode !== 'vertex' && { stepMode: packed.stepMode }),
            attributes,
        };
    });
}

// ---- Typed interleave packer (drawable upload path) ------------------------------------------

/** Host data for one vertex attribute: a flat `ArrayLike<number>` of `count * elementsPerVertex`
 *  values. For `float16` supply raw half-float bits; for normalized (`unorm*`/`snorm*`) formats
 *  supply pre-encoded integers — floats are not auto-quantized. */
export type VertexAttrData = ArrayLike<number>;

function writeComponent(
    dv: DataView,
    byteOffset: number,
    kind: VertexArrayKind,
    value: number
): void {
    switch (kind) {
        case 'u8':
            dv.setUint8(byteOffset, value);
            return;
        case 'i8':
            dv.setInt8(byteOffset, value);
            return;
        case 'u16':
            dv.setUint16(byteOffset, value, true);
            return;
        case 'i16':
            dv.setInt16(byteOffset, value, true);
            return;
        case 'u32':
            dv.setUint32(byteOffset, value, true);
            return;
        case 'i32':
            dv.setInt32(byteOffset, value, true);
            return;
        case 'f32':
            dv.setFloat32(byteOffset, value, true);
            return;
    }
}

/** Interleave per-attribute host arrays into one tightly-packed buffer matching `buffer`'s
 *  derived layout. Every attribute must be present in `data` and agree on the vertex count.
 *  Returns the packed `ArrayBuffer` ready for `queue.writeBuffer`. */
export function interleaveVertexBuffer(
    buffer: VertexBufferDecl,
    data: Readonly<Record<string, VertexAttrData>>
): ArrayBuffer {
    const { arrayStride, attributes } = packVertexBuffer(buffer);

    let count = -1;
    for (const attr of attributes) {
        const meta = vertexFormatInfo(attr.format);
        const src = data[attr.name];
        if (src === undefined) {
            throw new Error(`interleaveVertexBuffer: missing data for attribute '${attr.name}'.`);
        }
        if (src.length % meta.elementsPerVertex !== 0) {
            throw new Error(
                `interleaveVertexBuffer: attribute '${attr.name}' length ${src.length} is not a ` +
                    `multiple of ${meta.elementsPerVertex} (elements per vertex for '${attr.format}').`
            );
        }
        const c = src.length / meta.elementsPerVertex;
        if (count === -1) count = c;
        else if (count !== c) {
            throw new Error(
                `interleaveVertexBuffer: attribute '${attr.name}' implies ${c} vertices but a prior ` +
                    `attribute implied ${count}. All attributes in a buffer must share a vertex count.`
            );
        }
    }
    if (count <= 0) {
        throw new Error('interleaveVertexBuffer: vertex count resolved to 0.');
    }

    const dest = new ArrayBuffer(count * arrayStride);
    const dv = new DataView(dest);
    for (const attr of attributes) {
        const meta = vertexFormatInfo(attr.format);
        const componentByteSize = meta.byteSize / meta.elementsPerVertex;
        const src = data[attr.name] as VertexAttrData;
        for (let v = 0; v < count; v++) {
            const base = v * arrayStride + attr.offset;
            for (let e = 0; e < meta.elementsPerVertex; e++) {
                writeComponent(
                    dv,
                    base + e * componentByteSize,
                    meta.arrayKind,
                    src[v * meta.elementsPerVertex + e] as number
                );
            }
        }
    }
    return dest;
}
