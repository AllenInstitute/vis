
// lets help the compiler to know that these two types are related:
export type TaggedFloat32Array = {
    type: 'float';
    data: Float32Array;
};

export type TaggedUint32Array = {
    type: 'uint32';
    data: Uint32Array;
};
export type TaggedInt32Array = {
    type: 'int32';
    data: Int32Array;
};

export type TaggedUint16Array = {
    type: 'uint16';
    data: Uint16Array;
};
export type TaggedInt16Array = {
    type: 'int16';
    data: Int16Array;
};

export type TaggedUint8Array = {
    type: 'uint8';
    data: Uint8Array;
};
export type TaggedInt8Array = {
    type: 'int8';
    data: Int8Array;
};
export type TaggedTypedArray =
    | TaggedFloat32Array
    | TaggedUint32Array
    | TaggedInt32Array
    | TaggedUint16Array
    | TaggedInt16Array
    | TaggedUint8Array
    | TaggedInt8Array;
export type WebGLSafeBasicType = TaggedTypedArray['type']

export const BufferConstructors = {
    uint8: Uint8Array,
    uint16: Uint16Array,
    uint32: Uint32Array,
    int8: Int8Array,
    int16: Int16Array,
    int32: Int32Array,
    float: Float32Array,
} as const;

const SizeInBytes = {
    uint8: 1,
    uint16: 2,
    uint32: 4,
    int8: 1,
    int16: 2,
    int32: 4,
    float: 4,
} as const;
export function sizeInBytes(type: WebGLSafeBasicType) {
    return SizeInBytes[type];
}
export function MakeTaggedBufferView(type: WebGLSafeBasicType, buffer: ArrayBuffer): TaggedTypedArray {
    // note that TS is not smart enough to realize the mapping here, so we have 7 identical, spoonfed
    // cases....
    switch (type) {
        case 'uint8':
            return { type, data: new BufferConstructors[type](buffer) };
        case 'int8':
            return { type, data: new BufferConstructors[type](buffer) };
        case 'uint16':
            return { type, data: new BufferConstructors[type](buffer) };
        case 'int16':
            return { type, data: new BufferConstructors[type](buffer) };
        case 'uint32':
            return { type, data: new BufferConstructors[type](buffer) };
        case 'int32':
            return { type, data: new BufferConstructors[type](buffer) };
        case 'float':
            return { type, data: new BufferConstructors[type](buffer) };
        default: {
            // will be a compile error if we ever add any basic types
            const unreachable: never = type;
            throw new Error(`unsupported type requested: ${unreachable}`);
        }
    }
}
